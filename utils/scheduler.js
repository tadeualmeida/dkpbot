//utils/scheduler.js

const schedule = require('node-schedule');
const {
  refreshDkpPointsCache,
  refreshEligibleUsersCache,
  getEventParticipantsFromCache,
  clearEventParticipantsCache,      // keep this import
  getDkpParameterFromCache,
  refreshDkpRankingCache,
  removeActiveEventFromCache
} = require('./cacheManagement');
const { sendMessageToConfiguredChannels } = require('./channelUtils');
const { createBulkOperations, updateDkpTotal } = require('./generalUtils');
const Dkp   = require('../schema/Dkp');
const Event = require('../schema/Event');

const scheduledJobs = new Map();

/**
 * Internal: schedule a job to end an event after `durationMinutes`.
 */
function scheduleJob(guildId, gameKey, eventCode, parameterName, durationMinutes, interaction) {
  const jobKey = `${guildId}-${gameKey}-${eventCode}`;
  const runAt  = Date.now() + durationMinutes * 60_000;
  const job    = schedule.scheduleJob(runAt, async () => {
    try {
      await processEventEnd(guildId, gameKey, eventCode, parameterName, interaction);
    } catch (error) {
      console.error(`Error executing job ${jobKey}:`, error);
    } finally {
      scheduledJobs.delete(jobKey);
    }
  });
  scheduledJobs.set(jobKey, job);
}

/**
 * Cancel a previously scheduled event‐end job.
 */
function cancelScheduledJob(guildId, gameKey, eventCode) {
  const jobKey = `${guildId}-${gameKey}-${eventCode}`;
  const job    = scheduledJobs.get(jobKey);
  if (job) {
    job.cancel();
    scheduledJobs.delete(jobKey);
    // cleanup caches
    removeActiveEventFromCache(guildId, gameKey, eventCode);
    clearEventParticipantsCache(guildId, gameKey, eventCode);  // fixed name here
  }
}

/**
 * Process automatic event end:
 *  - Persist participants into the Event doc
 *  - Award DKP to each participant
 *  - Send a log embed
 *  - Refresh & clear caches
 */
async function processEventEnd(guildId, gameKey, eventCode, parameterName, interaction) {
  // 1) Mark event inactive in DB
  const eventDoc = await Event.findOneAndUpdate(
    { guildId, gameKey, code: eventCode, isActive: true },
    { isActive: false },
    { new: true }
  );
  if (!eventDoc) {
    console.log(`Event ${eventCode} for ${gameKey}@${guildId} already inactive or not found.`);
    return;
  }

  // 2) Get participants from cache
  const participants = await getEventParticipantsFromCache(guildId, gameKey, eventCode);
  if (!Array.isArray(participants) || participants.some(p => !p.userId)) {
    console.error(`Invalid participants data for event ${eventCode}.`);
    return;
  }

  // 3) Persist final participants list
  eventDoc.participants = participants;
  await eventDoc.save();

  // 4) Load DKP parameter points
  const dkpParam = await getDkpParameterFromCache(guildId, gameKey, parameterName);
  if (!dkpParam || typeof dkpParam.points !== 'number') {
    console.error(`Invalid DKP parameter '${parameterName}' for game '${gameKey}'.`);
    return;
  }

  // 5) Build correct participant-change entries
  const changes = participants.map(p => ({
    userId: p.userId,
    pointChange: dkpParam.points
  }));

  // 6) Bulk-write DKP transactions
  const ops = createBulkOperations(changes, guildId, gameKey, dkpParam.points, `Event ${eventCode} ended`);
  if (ops.length) {
    await Dkp.bulkWrite(ops);
    await updateDkpTotal(ops.length * dkpParam.points, guildId, gameKey);
  }

  // 7) Send end-of-event log
  const mentions = participants.map(p => p.username).join('**, **') || 'No participants.';
  await sendMessageToConfiguredChannels(
    interaction,
    `Event **${eventCode}** for **${gameKey}** ended (param **${parameterName}**).\nParticipants (${participants.length}): **${mentions}**`,
    'event',
    gameKey
  );

  // 8) Refresh and clear caches
  await refreshDkpPointsCache(guildId, gameKey);
  await refreshEligibleUsersCache(guildId, gameKey);
  await refreshDkpRankingCache(guildId, gameKey);

  clearEventParticipantsCache(guildId, gameKey, eventCode);
  removeActiveEventFromCache(guildId, gameKey, eventCode);
}

/**
 * Public: schedule an event to end
 */
function scheduleEventEnd(guildId, gameKey, eventCode, parameterName, durationMinutes, interaction) {
  scheduleJob(guildId, gameKey, eventCode, parameterName, durationMinutes, interaction);
}

module.exports = {
  scheduleEventEnd,
  cancelScheduledJob,
  processEventEnd
};
