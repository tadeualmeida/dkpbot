const validator = require('validator');
const {
    createEventStartedEmbed,
    createEventEndedEmbed,
    createJoinEventEmbed,
    createErrorEmbed,
    createMultipleResultsEmbed,
    createInfoEmbed,
} = require('../utils/embeds');
const Event = require('../schema/Event');
const { getDkpParameterFromCache, refreshDkpPointsCache } = require('../utils/cacheManagement');
const { generateRandomCode } = require('../utils/codeGenerator');
const schedule = require('node-schedule');
const { Dkp, updateDkpTotal } = require('../schema/Dkp');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');

// Mapa para armazenar os jobs agendados
const scheduledJobs = new Map();

async function handleEventCommands(interaction) {
    try {
        if (interaction.commandName === 'event') {
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'start') {
                await startEvent(interaction);
            } else if (subcommand === 'end') {
                await endEvent(interaction);
            } else if (subcommand === 'list') {
                await listEvent(interaction);
            } else if (subcommand === 'cancel') {
                await cancelEvent(interaction);
            }
        } else if (interaction.commandName === 'join') {
            await joinEvent(interaction);
        }
    } catch (error) {
        console.error('Error handling event commands:', error);
        await interaction.reply({ embeds: [createErrorEmbed('An error occurred while handling the event command.')], ephemeral: true });
    }
}

async function startEvent(interaction) {
    const parameterName = validator.escape(interaction.options.getString('parameter'));
    const guildId = interaction.guildId;
    const dkpParameter = await getDkpParameterFromCache(guildId, parameterName);

    if (!dkpParameter) {
        await interaction.reply({ embeds: [createErrorEmbed(`No DKP parameter found with name '${parameterName}'. Please define it first using '/config dkp'.`)], ephemeral: true });
        return;
    }

    const activeEventWithSameParameter = await Event.findOne({ guildId, isActive: true, parameterName });
    if (activeEventWithSameParameter) {
        await interaction.reply({ embeds: [createErrorEmbed(`An event with the parameter '${parameterName}' is already active. Please end it before starting a new one with the same parameter.`)], ephemeral: true });
        return;
    }

    const eventCode = generateRandomCode();
    const userId = interaction.user.id;
    const userDisplayName = interaction.member ? interaction.member.displayName : 'N/A';

    const newEvent = new Event({
        guildId,
        parameterName,
        code: eventCode,
        participants: [{
            userId,
            username: userDisplayName,
            discordUsername: interaction.user.username,
            joinedAt: new Date()
        }],
        isActive: true
    });
    await newEvent.save();

    // Atualiza o DKP do usuário que iniciou o evento
    const userDkp = await Dkp.findOneAndUpdate(
        { guildId, userId },
        {
            $inc: { points: dkpParameter.points },
            $push: { transactions: { type: 'add', amount: dkpParameter.points, description: `Joined event ${eventCode}` } }
        },
        { new: true, upsert: true }
    );

    if (dkpParameter.points !== 0) {
        await updateDkpTotal(dkpParameter.points, guildId);
    }

    // Agenda para tornar o evento inativo após 10 minutos
    const job = schedule.scheduleJob(Date.now() + 600000, async function () {
        console.log(`Disabling event with code ${eventCode}.`);
        const eventToEnd = await Event.findOne({ guildId, code: eventCode, isActive: true });
        if (eventToEnd) {
            eventToEnd.isActive = false;
            await eventToEnd.save();

            const participantMentions = eventToEnd.participants.map(participant => `<@${participant.userId}>`).join(', ');
            const participantCount = eventToEnd.participants.length;

            await sendMessageToConfiguredChannels(interaction, `The event with parameter **${parameterName}** and code **${eventCode}** has ended after 10 minutes.\nParticipants (${participantCount}): ${participantMentions || 'No participants.'}`, 'event');
            await refreshDkpPointsCache(guildId); // Atualiza o cache após o término do evento
        }
        // Remove o job do mapa
        scheduledJobs.delete(eventCode);
    });

    // Armazena o job agendado no mapa
    scheduledJobs.set(eventCode, job);

    const eventStartedEmbed = createEventStartedEmbed(parameterName, eventCode);
    const joinEventEmbed = createJoinEventEmbed(dkpParameter, userDkp, eventCode);

    await interaction.reply({ embeds: [eventStartedEmbed, joinEventEmbed], ephemeral: true });
    await sendMessageToConfiguredChannels(interaction, `User <@${userId}> has started an event with parameter **${parameterName}**.\nEvent code: **${eventCode}**.\nYou have automatically joined the event.`, 'event');
}

async function endEvent(interaction) {
    const eventCodeToEnd = validator.escape(interaction.options.getString('code'));
    const guildId = interaction.guildId;
    const eventToEnd = await Event.findOne({ guildId, code: eventCodeToEnd, isActive: true });
    if (!eventToEnd || !eventToEnd.isActive) {
        await interaction.reply({ content: "Event not found or already ended.", ephemeral: true });
        return;
    }

    eventToEnd.isActive = false;
    await eventToEnd.save();

    const participantMentions = eventToEnd.participants.map(participant => `<@${participant.userId}>`).join(', ');
    const participantCount = eventToEnd.participants.length;

    await interaction.reply({ embeds: [createEventEndedEmbed()], ephemeral: true });
    await sendMessageToConfiguredChannels(interaction, `User <@${interaction.user.id}> has ended an event with parameter **${eventToEnd.parameterName}**.\nEvent code: **${eventCodeToEnd}**.\nParticipants (${participantCount}): ${participantMentions || 'No participants.'}`, 'event');
    await refreshDkpPointsCache(guildId); // Atualiza o cache após o término do evento

    // Cancela o job agendado para o evento
    const job = scheduledJobs.get(eventCodeToEnd);
    if (job) {
        job.cancel();
        scheduledJobs.delete(eventCodeToEnd);
    }
}

async function cancelEvent(interaction) {
    const eventCode = validator.escape(interaction.options.getString('code')).toUpperCase();
    const guildId = interaction.guildId;
    const eventToCancel = await Event.findOne({ guildId, code: eventCode, isActive: true });
    
    if (!eventToCancel) {
        await interaction.reply({ embeds: [createErrorEmbed('No active event found with the provided code.')], ephemeral: true });
        return;
    }

    // Remover pontos de todos os participantes
    const dkpParameter = await getDkpParameterFromCache(guildId, eventToCancel.parameterName);
    const bulkOperations = eventToCancel.participants.map(participant => ({
        updateOne: {
            filter: { guildId, userId: participant.userId },
            update: {
                $inc: { points: -dkpParameter.points },
                $push: { transactions: { type: 'remove', amount: dkpParameter.points, description: `Event ${eventCode} canceled` } }
            }
        }
    }));

    if (bulkOperations.length > 0) {
        await Dkp.bulkWrite(bulkOperations);
        await updateDkpTotal(-bulkOperations.length * dkpParameter.points, guildId);
    }

    eventToCancel.isActive = false;
    await eventToCancel.save();

    const participantMentions = eventToCancel.participants.map(participant => `<@${participant.userId}>`).join(', ');
    const participantCount = eventToCancel.participants.length;

    await interaction.reply({ embeds: [createInfoEmbed('Event Canceled', `The event with parameter **${eventToCancel.parameterName}** and code **${eventCode}** has been canceled.\nParticipants (${participantCount}): ${participantMentions || 'No participants.'}`)], ephemeral: true });
    await sendMessageToConfiguredChannels(interaction, `The event with parameter **${eventToCancel.parameterName}** and code **${eventCode}** has been canceled by <@${interaction.user.id}>.\nParticipants (${participantCount}): ${participantMentions || 'No participants.'}`, 'event');
    await refreshDkpPointsCache(guildId); // Atualiza o cache após o cancelamento do evento

    // Cancela o job agendado para o evento
    const job = scheduledJobs.get(eventCode);
    if (job) {
        job.cancel();
        scheduledJobs.delete(eventCode);
    }
}

async function joinEvent(interaction) {
    let eventCode = validator.escape(interaction.options.getString('code')).toUpperCase();
    const guildId = interaction.guildId;
    const event = await Event.findOne({ guildId, code: eventCode, isActive: true });

    if (!event) {
        await interaction.reply({ embeds: [createErrorEmbed('No active event found with the provided code.')], ephemeral: true });
        return;
    }

    if (event.participants.some(p => p.userId === interaction.user.id)) {
        await interaction.reply({ embeds: [createErrorEmbed('You have already joined this event.')], ephemeral: true });
        return;
    }

    const dkpParameter = await getDkpParameterFromCache(guildId, event.parameterName);

    event.participants.push({
        userId: interaction.user.id,
        username: interaction.member ? interaction.member.displayName : 'N/A',
        discordUsername: `${interaction.user.username}`,
        joinedAt: new Date()
    });

    const userDkp = await Dkp.findOneAndUpdate(
        { guildId, userId: interaction.user.id },
        {
            $inc: { points: dkpParameter.points },
            $push: { transactions: { type: 'add', amount: dkpParameter.points, description: `Joined event ${eventCode}` } }
        },
        { new: true, upsert: true }
    );

    await event.save();

    if (dkpParameter.points !== 0) {
        await updateDkpTotal(dkpParameter.points, guildId);
    }

    const joinEventEmbed = createJoinEventEmbed(dkpParameter, userDkp, eventCode);

    await interaction.reply({ embeds: [joinEventEmbed], ephemeral: true });
}

async function listEvent(interaction) {
    const eventCode = validator.escape(interaction.options.getString('code'));
    const guildId = interaction.guildId;
    const event = await Event.findOne({ guildId, code: eventCode });

    if (!event) {
        await interaction.reply({ content: `Event with code ${eventCode} not found.`, ephemeral: true });
        return;
    }

    const descriptions = event.participants.map(p => `${p.username}`);
    await interaction.reply({ embeds: [createMultipleResultsEmbed('info', `Participants for Event ${eventCode}`, descriptions)], ephemeral: true });
}

module.exports = { handleEventCommands };
