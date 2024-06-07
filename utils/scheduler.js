// utils/scheduler.js

const schedule = require('node-schedule');
const { refreshDkpPointsCache } = require('./cacheManagement');
const Event = require('../schema/Event');
const { sendMessageToConfiguredChannels } = require('./channelUtils');

const scheduledJobs = new Map();

async function scheduleJob(guildId, jobId, duration, callback) {
    const jobKey = `${guildId}-${jobId}`;
    const job = schedule.scheduleJob(Date.now() + duration * 60000, async function () {
        try {
            await callback();
        } catch (error) {
            console.error(`Error executing job ${jobKey}:`, error);
        } finally {
            // Remove o job do mapa
            scheduledJobs.delete(jobKey);
        }
    });

    // Armazena o job agendado no mapa
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
}

async function scheduleEventEnd(eventCode, parameterName, guildId, interaction, eventTimer) {
    console.log(`Scheduling event end for event ${eventCode} in ${eventTimer} minutes.`);
    await scheduleJob(guildId, eventCode, eventTimer, async () => {
        console.log(`Attempting to end event with code ${eventCode} for guild ${guildId}.`);
        const eventToEnd = await Event.findOne({ guildId, code: eventCode, isActive: true });
        if (eventToEnd) {
            eventToEnd.isActive = false;
            await eventToEnd.save();

            const participantMentions = eventToEnd.participants.map(participant => `<@${participant.userId}>`).join(', ');
            const participantCount = eventToEnd.participants.length;

            await sendMessageToConfiguredChannels(interaction, `The event with parameter **${parameterName}** and code **${eventCode}** has ended after ${eventTimer} minutes.\nParticipants (${participantCount}): ${participantMentions || 'No participants.'}`, 'event');
            await refreshDkpPointsCache(guildId); // Atualiza o cache após o término do evento
            console.log(`Event with code ${eventCode} for guild ${guildId} has been ended.`);
        } else {
            console.log(`Event with code ${eventCode} for guild ${guildId} was not found or is already inactive.`);
        }
    });
}

module.exports = { scheduleJob, cancelScheduledJob, scheduleEventEnd };
