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
const { getDkpParameterFromCache, refreshDkpPointsCache } = require('../utils/cacheManagement'); // Adicionei refreshDkpPointsCache aqui
const { generateRandomCode } = require('../utils/codeGenerator');
const schedule = require('node-schedule');
const { Dkp, DkpTotal, updateDkpTotal } = require('../schema/Dkp');
const ChannelConfig = require('../schema/ChannelConfig');

async function handleEventCommands(interaction) {
    switch (interaction.commandName) {
        case 'event':
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'start') {
                await startEvent(interaction);
            } else if (subcommand === 'end') {
                await endEvent(interaction);
            } else if (subcommand === 'list') {
                await listEvent(interaction);
            }
            break;
        case 'join':
            await joinEvent(interaction);
            break;
    }
}

async function sendMessageToConfiguredChannels(interaction, description) {
    const channelConfig = await ChannelConfig.findOne({ guildId: interaction.guildId });
    if (channelConfig && channelConfig.channels.length > 0) {
        channelConfig.channels.forEach(async (channelId) => {
            const channel = interaction.client.channels.cache.get(channelId);
            if (channel) {
                await channel.send({ embeds: [createInfoEmbed('Event Info', description)] });
            }
        });
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

    const newEvent = new Event({
        guildId,
        parameterName,
        code: eventCode,
        participants: [],
        isActive: true
    });
    await newEvent.save();

    // Agenda para tornar o evento inativo após 10 minutos
    schedule.scheduleJob(Date.now() + 600000, async function() {
        console.log(`Disabling event with code ${eventCode}.`);
        const eventToEnd = await Event.findOne({ guildId, code: eventCode, isActive: true });
        if (eventToEnd) {
            eventToEnd.isActive = false;
            await eventToEnd.save();

            const participantMentions = eventToEnd.participants.map(participant => `<@${participant.userId}>`).join(', ');
            const participantCount = eventToEnd.participants.length;

            await sendMessageToConfiguredChannels(interaction, `The event with parameter **${parameterName}** and code **${eventCode}** has ended after 10 minutes.\nParticipants (${participantCount}): ${participantMentions || 'No participants.'}`);
            await refreshDkpPointsCache(guildId); // Atualiza o cache após o término do evento
        }
    });

    await interaction.reply({ embeds: [createEventStartedEmbed(parameterName, eventCode)], ephemeral: true });
    await sendMessageToConfiguredChannels(interaction, `User <@${interaction.user.id}> has started an event with parameter **${parameterName}**.\nEvent code: **${eventCode}**.`);
}

async function endEvent(interaction) {
    const eventCodeToEnd = validator.escape(interaction.options.getString('code'));
    const guildId = interaction.guildId;
    const eventToEnd = await Event.findOne({ guildId: guildId, code: eventCodeToEnd, isActive: true });
    if (!eventToEnd || !eventToEnd.isActive) {
        await interaction.reply({ content: "Event not found or already ended.", ephemeral: true });
        return;
    }

    eventToEnd.isActive = false;
    await eventToEnd.save();

    const participantMentions = eventToEnd.participants.map(participant => `<@${participant.userId}>`).join(', ');
    const participantCount = eventToEnd.participants.length;

    await interaction.reply({ embeds: [createEventEndedEmbed()], ephemeral: true });
    await sendMessageToConfiguredChannels(interaction, `User <@${interaction.user.id}> has ended an event with parameter **${eventToEnd.parameterName}**.\nEvent code: **${eventCodeToEnd}**.\nParticipants (${participantCount}): ${participantMentions || 'No participants.'}`);
    await refreshDkpPointsCache(guildId); // Atualiza o cache após o término do evento
}

async function joinEvent(interaction) {
    const eventCode = validator.escape(interaction.options.getString('code'));
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

    // Adiciona o ID do usuário como uma string simples
    event.participants.push({
        userId: interaction.user.id,
        username: interaction.member ? interaction.member.displayName : 'N/A',
        discordUsername: `${interaction.user.username}`,
        joinedAt: new Date()
    });

    // Atualiza o DKP do usuário
    const userDkp = await Dkp.findOneAndUpdate(
        { guildId: guildId, userId: interaction.user.id },
        {
            $inc: { points: dkpParameter.points },
            $push: { transactions: { type: 'add', amount: dkpParameter.points, description: `Joined event ${eventCode}` } }
        },
        { new: true, upsert: true }
    );

    await event.save();

    if (dkpParameter.points !== 0) {
        await updateDkpTotal(dkpParameter.points, guildId); // Certifique-se de que o guildId está sendo passado
    }

    await interaction.reply({ embeds: [createJoinEventEmbed(dkpParameter, userDkp)], ephemeral: true });
}

async function listEvent(interaction) {
    const eventCode = validator.escape(interaction.options.getString('code'));
    const guildId = interaction.guildId;
    const event = await Event.findOne({ guildId: guildId, code: eventCode });

    if (!event) {
        await interaction.reply({ content: `Event with code ${eventCode} not found.`, ephemeral: true });
        return;
    }

    const descriptions = event.participants.map(p => `${p.username}`);
    await interaction.reply({ embeds: [createMultipleResultsEmbed('info', `Participants for Event ${eventCode}`, descriptions)], ephemeral: true });
}

module.exports = { handleEventCommands };
