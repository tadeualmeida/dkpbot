// schedule.js

const schedule = require('node-schedule');
const { 
    refreshDkpPointsCache, 
    refreshEligibleUsersCache, 
    getEventParticipantsFromCache, 
    clearEventParticipantsCache, 
    getDkpParameterFromCache, 
    refreshDkpRankingCache,
    removeActiveEventFromCache
} = require('./cacheManagement');
const { sendMessageToConfiguredChannels } = require('./channelUtils');
const { createBulkOperations, updateDkpTotal } = require('./generalUtils');
const Dkp = require('../schema/Dkp');
const Event = require('../schema/Event');

const scheduledJobs = new Map();

async function scheduleJob(guildId, jobId, duration, callback) {
    const jobKey = `${guildId}-${jobId}`;
    const job = schedule.scheduleJob(Date.now() + duration * 60000, async () => {
        try {
            await callback();
        } catch (error) {
            console.error(`Error executing job ${jobKey}:`, error);
        } finally {
            scheduledJobs.delete(jobKey);
        }
    });
    scheduledJobs.set(jobKey, job);
}

function cancelScheduledJob(guildId, jobId) {
    const jobKey = `${guildId}-${jobId}`;
    const job = scheduledJobs.get(jobKey);
    if (job) {
        job.cancel();
        scheduledJobs.delete(jobKey);
        removeActiveEventFromCache(guildId, jobId);
        clearEventParticipantsCache(guildId, jobId);
    }
}

async function processEventEnd(guildId, eventCode, parameterName, interaction) {
    const eventToEnd = await Event.findOne({ guildId, code: eventCode, isActive: true });
    if (!eventToEnd) {
        console.log(`Event with code ${eventCode} for guild ${guildId} was not found or is already inactive.`);
        return;
    }

    const participants = getEventParticipantsFromCache(guildId, eventCode);
    if (participants.some(p => !p.userId)) {
        console.error(`One or more participants in event ${eventCode} have an undefined userId.`);
        return;
    }

    eventToEnd.participants = participants;
    eventToEnd.isActive = false;
    await eventToEnd.save();

    const dkpParameter = await getDkpParameterFromCache(guildId, parameterName);
    if (!dkpParameter || typeof dkpParameter.points !== 'number') {
        console.error(`DKP parameter points for ${parameterName} is invalid or undefined.`);
        return;
    }

    const bulkOperations = createBulkOperations(participants, guildId, dkpParameter.points, `Event ${eventCode} ended`);
    if (bulkOperations.length > 0) {
        await Dkp.bulkWrite(bulkOperations);
        await updateDkpTotal(bulkOperations.length * dkpParameter.points, guildId);
    }

    const participantMentions = participants.map(p => p.username).join('**, **');
    const participantCount = participants.length;

    await sendMessageToConfiguredChannels(interaction, `The event with parameter **${parameterName}** and code **${eventCode}** has ended.\nParticipants (${participantCount}): **${participantMentions || 'No participants.'}**`, 'event');
    await refreshDkpPointsCache(guildId);
    await refreshEligibleUsersCache(guildId);
    await refreshDkpRankingCache(guildId);

    clearEventParticipantsCache(guildId, eventCode);
    removeActiveEventFromCache(guildId, eventCode);
}

async function scheduleEventEnd(eventCode, parameterName, guildId, interaction, eventTimer) {
    await scheduleJob(guildId, eventCode, eventTimer, async () => {
        console.log(`Ending event ${eventCode} for guild ${guildId} after ${eventTimer} minutes.`);
        await processEventEnd(guildId, eventCode, parameterName, interaction);
    });
}

module.exports = { scheduleJob, cancelScheduledJob, scheduleEventEnd };
