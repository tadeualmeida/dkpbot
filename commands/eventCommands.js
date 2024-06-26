// eventCommands.js

const validator = require('validator');
const {
    createCombinedEventEmbed,
    createEventEndedEmbed,
    createJoinEventEmbed,
    createMultipleResultsEmbed,
    createInfoEmbed,
} = require('../utils/embeds');
const Event = require('../schema/Event');
const { 
    getDkpParameterFromCache, 
    refreshDkpPointsCache, 
    getEventTimerFromCache, 
    addParticipantToEventCache, 
    getEventParticipantsFromCache, 
    clearEventParticipantsCache, 
    getDkpPointsFromCache, 
    refreshDkpRankingCache,
    addActiveEventToCache,
    removeActiveEventFromCache,
    getActiveEventsFromCache,
    getGuildConfigFromCache
} = require('../utils/cacheManagement');
const { generateRandomCode } = require('../utils/codeGenerator');
const { Dkp, updateDkpTotal } = require('../schema/Dkp');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');
const { scheduleEventEnd, cancelScheduledJob } = require('../utils/scheduler');
const { createBulkOperations, replyWithError } = require('../utils/generalUtils');

async function handleEventCommands(interaction) {
    try {
        if (interaction.commandName === 'event') {
            const subcommand = interaction.options.getSubcommand(false);
            if (!subcommand) {
                await replyWithError(interaction, null, 'No subcommand specified.');
                return;
            }
            switch (subcommand) {
                case 'start': await startEvent(interaction); break;
                case 'end': await endEvent(interaction); break;
                case 'list': await listEvent(interaction); break;
                case 'cancel': await cancelEvent(interaction); break;
            }
        } else if (interaction.commandName === 'join') {
            await joinEvent(interaction);
        }
    } catch (error) {
        console.error('Error handling event commands:', error);
        await replyWithError(interaction, 'Error', 'An error occurred while handling the event command.');
    }
}

async function startEvent(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const parameterName = validator.escape(interaction.options.getString('parameter'));
    const guildId = interaction.guildId;
    const dkpParameter = await getDkpParameterFromCache(guildId, parameterName);
    const eventTimer = await getEventTimerFromCache(guildId);

    if (!dkpParameter) {
        await replyWithError(interaction, null, `No DKP parameter found with name '${parameterName}'. Please define it first using '/config dkp'.`);
        return;
    }

    if (getActiveEventsFromCache(guildId).some(event => event.parameterName === parameterName && event.isActive)) {
        await replyWithError(interaction, null, `An event with the parameter '${parameterName}' is already active. Please end it before starting a new one with the same parameter.`);
        return;
    }

    const eventCode = generateRandomCode();
    const userId = interaction.user.id;
    const userDisplayName = interaction.member ? interaction.member.displayName : interaction.user.username;
    const userDkp = await getDkpPointsFromCache(guildId, userId);
    const totalPoints = userDkp ? userDkp.points + dkpParameter.points : dkpParameter.points;

    const newEvent = new Event({ guildId, parameterName, code: eventCode, participants: [], isActive: true });
    await newEvent.save();
    addActiveEventToCache(guildId, newEvent);

    addParticipantToEventCache(guildId, eventCode, { userId, username: userDisplayName, discordUsername: interaction.user.username, joinedAt: new Date() });
    await scheduleEventEnd(eventCode, parameterName, guildId, interaction, eventTimer);

    const guildConfig = await getGuildConfigFromCache(guildId);
    const combinedEventEmbed = createCombinedEventEmbed(parameterName, eventCode, dkpParameter, { points: totalPoints }, guildConfig);

    const guildName = guildConfig?.guildName ? guildConfig.guildName.toUpperCase() : 'Event';
    const message = `User **${userDisplayName}** has started an event with parameter **${parameterName}**.\n\n${guildName} CODE: **${eventCode}**`;

    await interaction.editReply({ embeds: [combinedEventEmbed], ephemeral: true });
    await sendMessageToConfiguredChannels(interaction, message, 'event');
}

async function endEvent(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const eventCodeToEnd = validator.escape(interaction.options.getString('code'));
    const guildId = interaction.guildId;

    const eventToEnd = getActiveEventsFromCache(guildId).find(event => event.code === eventCodeToEnd && event.isActive);
    if (!eventToEnd) {
        await replyWithError(interaction, null, "Event not found or already ended.");
        return;
    }

    const participants = getEventParticipantsFromCache(guildId, eventCodeToEnd);
    eventToEnd.participants = participants;
    eventToEnd.isActive = false;
    await Event.updateOne({ guildId, code: eventCodeToEnd }, { $set: { isActive: false, participants } });

    const dkpParameter = await getDkpParameterFromCache(guildId, eventToEnd.parameterName);
    if (!dkpParameter || typeof dkpParameter.points !== 'number') {
        await replyWithError(interaction, null, "Invalid DKP parameter points.");
        return;
    }

    const bulkOperations = createBulkOperations(participants, guildId, dkpParameter.points, `Event ${eventCodeToEnd} ended`);

    if (bulkOperations.length > 0) {
        await Dkp.bulkWrite(bulkOperations);
        await updateDkpTotal(bulkOperations.length * dkpParameter.points, guildId);
    }

    const participantMentions = participants.map(participant => participant.username).join('**, **');
    const participantCount = participants.length;

    await interaction.editReply({ embeds: [createEventEndedEmbed()], ephemeral: true });
    await sendMessageToConfiguredChannels(interaction, `User **${interaction.member.displayName}** has ended an event with parameter **${eventToEnd.parameterName}**.\nEvent code: **${eventCodeToEnd}**.\nParticipants (${participantCount}): **${participantMentions || 'No participants.'}**`, 'event');
    await refreshDkpPointsCache(guildId);
    await refreshDkpRankingCache(guildId);

    clearEventParticipantsCache(guildId, eventCodeToEnd);
    removeActiveEventFromCache(guildId, eventCodeToEnd);
    cancelScheduledJob(guildId, eventCodeToEnd);
}

async function cancelEvent(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const eventCode = validator.escape(interaction.options.getString('code')).toUpperCase();
    const guildId = interaction.guildId;

    const eventToCancel = getActiveEventsFromCache(guildId).find(event => event.code === eventCode && event.isActive);
    if (!eventToCancel) {
        await replyWithError(interaction, null, 'No active event found with the provided code.');
        return;
    }

    eventToCancel.isActive = false;
    await Event.updateOne({ guildId, code: eventCode }, { $set: { isActive: false } });

    const participants = getEventParticipantsFromCache(guildId, eventCode);
    const participantMentions = participants.map(participant => participant.username).join('**, **');
    const participantCount = participants.length;

    await interaction.editReply({ embeds: [createInfoEmbed('Event Canceled', `The event with parameter **${eventToCancel.parameterName}** and code **${eventCode}** has been canceled.\nParticipants (${participantCount}): **${participantMentions || 'No participants.'}`)], ephemeral: true });
    await sendMessageToConfiguredChannels(interaction, `The event with parameter **${eventToCancel.parameterName}** and code **${eventCode}** has been canceled by **${interaction.member.displayName}**.\nParticipants (${participantCount}): **${participantMentions || 'No participants.'}`, 'event');
    await refreshDkpPointsCache(guildId);
    await refreshDkpRankingCache(guildId);

    clearEventParticipantsCache(guildId, eventCode);
    removeActiveEventFromCache(guildId, eventCode);
    cancelScheduledJob(guildId, eventCode);
}

async function joinEvent(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const eventCode = validator.escape(interaction.options.getString('code')).toUpperCase();
    const guildId = interaction.guildId;

    const event = getActiveEventsFromCache(guildId).find(event => event.code === eventCode && event.isActive);
    if (!event) {
        await replyWithError(interaction, null, 'No active event found with the provided code.');
        return;
    }

    const participants = getEventParticipantsFromCache(guildId, eventCode);

    if (participants.some(p => p.userId === interaction.user.id)) {
        await replyWithError(interaction, null, 'You have already joined this event.');
        return;
    }

    if (participants[0]?.userId === interaction.user.id) {
        await replyWithError(interaction, null, 'You have already joined the event you created.');
        return;
    }

    const userId = interaction.user.id;
    const userDisplayName = interaction.member ? interaction.member.displayName : interaction.user.username;
    const dkpParameter = await getDkpParameterFromCache(guildId, event.parameterName);
    const userDkp = await getDkpPointsFromCache(guildId, userId);
    const totalPoints = userDkp ? userDkp.points + dkpParameter.points : dkpParameter.points;

    addParticipantToEventCache(guildId, eventCode, {
        userId,
        username: userDisplayName,
        discordUsername: interaction.user.username,
        joinedAt: new Date()
    });

    const joinEventEmbed = createJoinEventEmbed(dkpParameter, { points: totalPoints }, eventCode);

    await interaction.editReply({ embeds: [joinEventEmbed], ephemeral: true });
}

async function listEvent(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const eventCode = validator.escape(interaction.options.getString('code'));
    const guildId = interaction.guildId;

    const event = getActiveEventsFromCache(guildId).find(event => event.code === eventCode) || await Event.findOne({ guildId, code: eventCode });
    if (!event) {
        await interaction.editReply({ content: `Event with code ${eventCode} not found.`, ephemeral: true });
        return;
    }

    const participants = getEventParticipantsFromCache(guildId, eventCode).length > 0 ? getEventParticipantsFromCache(guildId, eventCode) : event.participants;
    const descriptions = participants.map(p => `${p.username}`);

    await interaction.editReply({ embeds: [createMultipleResultsEmbed('info', `Participants for Event ${eventCode}`, descriptions)], ephemeral: true });
}

module.exports = { handleEventCommands };
