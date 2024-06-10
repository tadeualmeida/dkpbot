const schedule = require('node-schedule');
const { 
    refreshDkpPointsCache, 
    refreshEligibleUsersCache, 
    getEventParticipantsFromCache, 
    clearEventParticipantsCache, 
    getDkpParameterFromCache, 
    refreshDkpRankingCache,
    addActiveEventToCache,
    removeActiveEventFromCache
} = require('./cacheManagement');
const Event = require('../schema/Event');
const { sendMessageToConfiguredChannels } = require('./channelUtils');
const { Dkp, updateDkpTotal } = require('../schema/Dkp');

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

    // Remove o evento ativo do cache e limpa o cache de participantes
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

        // Atualiza o DKP dos participantes
        const dkpParameter = await getDkpParameterFromCache(guildId, parameterName);
        const bulkOperations = participants.map(participant => ({
            updateOne: {
                filter: { guildId, userId: participant.userId },
                update: {
                    $inc: { points: dkpParameter.points },
                    $push: { transactions: { type: 'add', amount: dkpParameter.points, description: `Event ${eventCode} ended` } }
                },
                upsert: true // Garante que novos documentos sejam criados se não existirem
            }
        }));

        if (bulkOperations.length > 0) {
            await Dkp.bulkWrite(bulkOperations);
            await updateDkpTotal(bulkOperations.length * dkpParameter.points, guildId);
        }

        const participantMentions = participants.map(participant => `<@${participant.userId}>`).join(', ');
        const participantCount = participants.length;

        await sendMessageToConfiguredChannels(interaction, `The event with parameter **${parameterName}** and code **${eventCode}** has ended after ${eventTimer} minutes.\nParticipants (${participantCount}): ${participantMentions || 'No participants.'}`, 'event');
        await refreshDkpPointsCache(guildId); // Atualiza o cache após o término do evento
        await refreshEligibleUsersCache(guildId); // Atualiza o cache de usuários elegíveis
        await refreshDkpRankingCache(guildId);

        console.log(`Event with code ${eventCode} for guild ${guildId} has been ended.`);
        clearEventParticipantsCache(guildId, eventCode); // Limpa o cache de participantes
        removeActiveEventFromCache(guildId, eventCode); // Remove o evento ativo do cache
    });
}

module.exports = { scheduleJob, cancelScheduledJob, scheduleEventEnd };
