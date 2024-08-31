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
const Dkp = require('../schema/Dkp');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');
const { scheduleEventEnd, cancelScheduledJob } = require('../utils/scheduler');
const { createBulkOperations, replyWithError, updateDkpTotal } = require('../utils/generalUtils');

async function handleEventCommands(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

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
                case 'rank': await handleEventRank(interaction); break;
            }
        } else if (interaction.commandName === 'join') {
            await joinEvent(interaction);
        }
    } catch (error) {
        console.error('Error handling event commands:', error);
        if (!interaction.replied && !interaction.deferred) {
            await replyWithError(interaction, 'Error', 'An error occurred while handling the event command.');
        }
    }
}

async function startEvent(interaction) {
    try {
        const parameterName = validator.escape(interaction.options.getString('parameter'));
        const guildId = interaction.guildId;
        const [dkpParameter, eventTimer, activeEvents, guildConfig] = await Promise.all([
            getDkpParameterFromCache(guildId, parameterName),
            getEventTimerFromCache(guildId),
            getActiveEventsFromCache(guildId),
            getGuildConfigFromCache(guildId)
        ]);

        if (!dkpParameter) {
            return await replyWithError(interaction, null, `No DKP parameter found with name '${parameterName}'.`);
        }

        if (activeEvents.some(event => event.parameterName === parameterName && event.isActive)) {
            return await replyWithError(interaction, null, `An event with the parameter '${parameterName}' is already active.`);
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

        const combinedEventEmbed = createCombinedEventEmbed(parameterName, eventCode, dkpParameter, { points: totalPoints }, guildConfig);
        const guildName = guildConfig?.guildName ? guildConfig.guildName.toUpperCase() : 'Event';
        const message = `User **${userDisplayName}** has started an event with parameter **${parameterName}**.\n\n${guildName} CODE: **${eventCode}**`;

        await interaction.editReply({ embeds: [combinedEventEmbed], ephemeral: true });
        await sendMessageToConfiguredChannels(interaction, message, 'event');
    } catch (error) {
        console.error('Error starting event:', error);
        if (!interaction.replied && !interaction.deferred) {
            await replyWithError(interaction, null, 'An error occurred while starting the event.');
        }
    }
}

async function endEvent(interaction) {
    try {
        const eventCodeToEnd = validator.escape(interaction.options.getString('code'));
        const guildId = interaction.guildId;

        const eventToEnd = getActiveEventsFromCache(guildId).find(event => event.code === eventCodeToEnd && event.isActive);
        if (!eventToEnd) return await replyWithError(interaction, null, "Event not found or already ended.");

        const participants = getEventParticipantsFromCache(guildId, eventCodeToEnd);
        eventToEnd.participants = participants;
        eventToEnd.isActive = false;
        await Event.updateOne({ guildId, code: eventCodeToEnd }, { $set: { isActive: false, participants } });

        const dkpParameter = await getDkpParameterFromCache(guildId, eventToEnd.parameterName);
        if (!dkpParameter || typeof dkpParameter.points !== 'number') return await replyWithError(interaction, null, "Invalid DKP parameter points.");

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
    } catch (error) {
        console.error('Error ending event:', error);
        if (!interaction.replied && !interaction.deferred) {
            await replyWithError(interaction, null, 'An error occurred while ending the event.');
        }
    }
}

async function cancelEvent(interaction) {
    try {
        const eventCode = validator.escape(interaction.options.getString('code')).toUpperCase();
        const guildId = interaction.guildId;

        const eventToCancel = getActiveEventsFromCache(guildId).find(event => event.code === eventCode && event.isActive);
        if (!eventToCancel) return await replyWithError(interaction, null, 'No active event found with the provided code.');

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
    } catch (error) {
        console.error('Error canceling event:', error);
        if (!interaction.replied && !interaction.deferred) {
            await replyWithError(interaction, null, 'An error occurred while canceling the event.');
        }
    }
}

async function joinEvent(interaction) {
    try {
        const eventCode = validator.escape(interaction.options.getString('code')).toUpperCase();
        const guildId = interaction.guildId;

        const event = getActiveEventsFromCache(guildId).find(event => event.code === eventCode && event.isActive);
        if (!event) return await replyWithError(interaction, null, 'No active event found with the provided code.');

        const participants = getEventParticipantsFromCache(guildId, eventCode);
        if (participants.some(p => p.userId === interaction.user.id)) {
            return await replyWithError(interaction, null, 'You have already joined this event.');
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

        await interaction.editReply({ embeds: [createJoinEventEmbed(dkpParameter, { points: totalPoints }, eventCode)], ephemeral: true });
    } catch (error) {
        console.error('Error joining event:', error);
        if (!interaction.replied && !interaction.deferred) {
            await replyWithError(interaction, null, 'An error occurred while joining the event.');
        }
    }
}

async function listEvent(interaction) {
    try {
        const eventCode = validator.escape(interaction.options.getString('code'));
        const guildId = interaction.guildId;

        const event = getActiveEventsFromCache(guildId).find(event => event.code === eventCode) || await Event.findOne({ guildId, code: eventCode });
        if (!event) {
            await interaction.editReply({ content: `Event with code ${eventCode} not found.`, ephemeral: true });
            return;
        }

        const participants = getEventParticipantsFromCache(guildId, eventCode).length > 0 ? getEventParticipantsFromCache(guildId, eventCode) : event.participants;
        await interaction.editReply({ embeds: [createMultipleResultsEmbed('info', `Participants for Event ${eventCode}`, participants.map(p => p.username))], ephemeral: true });
    } catch (error) {
        console.error('Error listing event participants:', error);
        if (!interaction.replied && !interaction.deferred) {
            await replyWithError(interaction, null, 'An error occurred while listing the event participants.');
        }
    }
}

async function handleEventRank(interaction) {
    try {
        const guildId = interaction.guildId;
        const parameterName = interaction.options.getString('parameter');

        const dkpParameter = await getDkpParameterFromCache(guildId, parameterName);
        if (!dkpParameter) {
            return await interaction.editReply({ content: `No DKP parameter found with name '${parameterName}'.`, ephemeral: true });
        }

        const events = await Event.find({ guildId, parameterName });

        if (events.length === 0) {
            return await interaction.editReply({ embeds: [createInfoEmbed('No Events Found', `No events found for parameter '${parameterName}'.`)], ephemeral: true });
        }

        const participantScores = {};
        events.forEach(event => {
            event.participants.forEach(participant => {
                if (!participantScores[participant.userId]) {
                    participantScores[participant.userId] = { username: participant.username, points: 0 };
                }
                participantScores[participant.userId].points += dkpParameter.points;
            });
        });

        const sortedParticipants = Object.values(participantScores).sort((a, b) => b.points - a.points);

        const descriptions = sortedParticipants.map((participant, index) => `${index + 1}. **${participant.username}** - ${participant.points} points`);

        if (descriptions.length === 0) {
            await interaction.editReply({ embeds: [createInfoEmbed('No Participants', 'No participants found for the specified parameter.')], ephemeral: true });
        } else {
            const embedTitle = `DKP Ranking for '${parameterName}'`;
            const embeds = createRankEmbeds(descriptions, embedTitle);       
            await interaction.editReply({ embeds, ephemeral: true });
        }
    } catch (error) {
        console.error('Error handling event rank:', error);
        if (!interaction.replied && !interaction.deferred) {
            await replyWithError(interaction, null, 'An error occurred while processing the event rank.');
        }
    }
}

function createRankEmbeds(descriptions, title) {
    const embeds = [];
    const chunkSize = 50;

    for (let i = 0; i < descriptions.length; i += chunkSize) {
        const chunk = descriptions.slice(i, i + chunkSize);
        embeds.push(createMultipleResultsEmbed('info', `${title} - ${i + 1} to ${i + chunk.length}`, chunk));
    }

    return embeds;
}

module.exports = { handleEventCommands };
