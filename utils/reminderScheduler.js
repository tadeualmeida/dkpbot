// utils/reminderScheduler.js

const schedule = require('node-schedule');
const Reminder = require('../schema/Reminder');
const { sendMessageToConfiguredChannels } = require('./channelUtils');
const { parseDuration } = require('./timeUtils');

// In-memory map of scheduled reminder jobs
const scheduledReminders = new Map();

/**
 * Reagenda todos os reminders persistidos no Mongo,
 * removendo imediatamente os que já expiraram.
 *
 * @param {import('discord.js').Client} client — instância do Discord.Client
 */
async function bootstrapReminders(client) {
  const now = new Date();

  // Busca **todos** os reminders
  const all = await Reminder.find({}).lean();

  for (const rem of all) {
    // Se já expirou, remove do banco
    if (rem.targetTimestamp <= now) {
      await Reminder.deleteOne({ _id: rem._id });
      console.log(`[REMINDER] Expired reminder ${rem._id} removed from DB`);
      continue;
    }

    // Senão, reagenda
    try {
      scheduleReminder(
        rem.guildId,
        rem.gameKey,
        rem.parameterName,
        rem.intervals,
        rem.targetTimestamp,
        { client, guildId: rem.guildId }
      );
      console.log(`[REMINDER] Bootstrapped reminder ${rem._id} for parameter "${rem.parameterName}"`);
    } catch (err) {
      console.error(`[REMINDER] Failed to bootstrap reminder ${rem._id}:`, err);
    }
  }
}

/**
 * Schedule reminders at specified intervals before a target time,
 * and persist them to the database.
 *
 * @param {string} guildId
 * @param {string} gameKey
 * @param {string} parameterName
 * @param {string[]} intervals      e.g. ['1h','30m','10m']
 * @param {Date|number} targetTime  When the countdown ends (Date or ms timestamp)
 * @param {CommandInteraction} interaction
 */
async function scheduleReminder(
  guildId,
  gameKey,
  parameterName,
  intervals,
  targetTime,
  interaction
) {
  const baseKey = `${guildId}:${gameKey}:${parameterName}`;
  const ts      = targetTime instanceof Date ? targetTime : new Date(targetTime);

  // 1) Upsert into MongoDB (create if missing, update if exists)
  try {
    await Reminder.findOneAndUpdate(
      { guildId, gameKey, parameterName },
      { targetTimestamp: ts, intervals },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error('💥 Reminder upsert failed:', err);
    throw err;
  }

  // 2) Clear only in-memory jobs; DB record remains
  for (const [key, job] of scheduledReminders.entries()) {
    if (key.startsWith(baseKey)) {
      job.cancel();
      scheduledReminders.delete(key);
    }
  }

  // 3) Schedule each interval alert (without @here)
  for (const intervalStr of intervals) {
    const ms = parseDuration(intervalStr);
    if (isNaN(ms)) continue;

    const runAt = new Date(ts.getTime() - ms);
    if (runAt <= Date.now()) continue;

    const jobKey = `${baseKey}:interval:${intervalStr}`;
    const job = schedule.scheduleJob(runAt, async () => {
      await sendMessageToConfiguredChannels(
        interaction,
        `⌛ Reminder: **${parameterName}** will spawn in **${intervalStr}**.`,
        'reminder',
        gameKey
      );
      scheduledReminders.delete(jobKey);
    });
    scheduledReminders.set(jobKey, job);
  }

  // 4) Schedule the final “NOW” alert (with @here). After sending, delete the DB record.
  const finalKey = `${baseKey}:final`;
  if (ts > Date.now()) {
    const finalJob = schedule.scheduleJob(ts, async () => {
      await sendMessageToConfiguredChannels(
        interaction,
        `@here 🔔 Reminder: **${parameterName}** is spawning now! Group up and get ready!`,
        'reminder',
        gameKey
      );
      scheduledReminders.delete(finalKey);

      // 5) Cleanup DB record since it has fired
      await Reminder.deleteOne({ guildId, gameKey, parameterName });
    });
    scheduledReminders.set(finalKey, finalJob);
  }
}

/**
 * Cancel all scheduled reminders (in-memory jobs) for a given guild+game+parameter.
 * Does **not** remove the DB record—that only happens if the user explicitly calls cancel.
 *
 * @param {string} guildId
 * @param {string} gameKey
 * @param {string} parameterName
 */
function clearScheduledJobs(guildId, gameKey, parameterName) {
  const baseKey = `${guildId}:${gameKey}:${parameterName}`;
  for (const [key, job] of scheduledReminders.entries()) {
    if (key.startsWith(baseKey)) {
      job.cancel();
      scheduledReminders.delete(key);
    }
  }
}

/**
 * Cancel all scheduled reminders (in-memory jobs) and also remove the DB record.
 * Use this when the user explicitly wants to cancel.
 *
 * @param {string} guildId
 * @param {string} gameKey
 * @param {string} parameterName
 */
async function cancelScheduledReminder(guildId, gameKey, parameterName) {
  clearScheduledJobs(guildId, gameKey, parameterName);
  await Reminder.deleteOne({ guildId, gameKey, parameterName });
}

module.exports = {
  scheduleReminder,
  cancelScheduledReminder,
  bootstrapReminders
};
