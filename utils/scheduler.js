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
const Event = require('../schema/Event');
const { sendMessageToConfiguredChannels } = require('./channelUtils');
const { Dkp, updateDkpTotal } = require('../schema/Dkp');
const { createBulkOperations } = require('./generalUtils');

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
        console.log(`Scheduled job ${jobKey} cancelled.`);
    }
    removeActiveEventFromCache(guildId, jobId);
    clearEventParticipantsCache(guildId, jobId);
}

async function scheduleEventEnd(eventCode, parameterName, guildId, interaction, eventTimer) {
    console.log(`Scheduling event end for event ${eventCode} in ${eventTimer} minutes.`);
    await scheduleJob(guildId, eventCode, eventTimer, async () => {
        console.log(`Attempting to end event with code ${eventCode} for guild ${guildId}.`);

        const eventToEnd = await Event.findOne({ guildId, code: eventCode, isActive: true });
        if (!eventToEnd) {
            console.log(`Event with code ${eventCode} for guild ${guildId} was not found or is already inactive.`);
            return;
        }

        const participants = getEventParticipantsFromCache(guildId, eventCode);
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

        const participantMentions = participants.map(participant => participant.username).join('**, **');
        const participantCount = participants.length;

        await sendMessageToConfiguredChannels(interaction, `The event with parameter **${parameterName}** and code **${eventCode}** has ended after ${eventTimer} minutes.\nParticipants (${participantCount}): **${participantMentions || 'No participants.'}**`, 'event');
        await refreshDkpPointsCache(guildId);
        await refreshEligibleUsersCache(guildId);
        await refreshDkpRankingCache(guildId);

        console.log(`Event with code ${eventCode} for guild ${guildId} has been ended.`);
        clearEventParticipantsCache(guildId, eventCode);
        removeActiveEventFromCache(guildId, eventCode);
    });
}

module.exports = { scheduleJob, cancelScheduledJob, scheduleEventEnd };
