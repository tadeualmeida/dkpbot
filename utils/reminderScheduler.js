//utils/reminderScheduler.js

const schedule   = require('node-schedule');
const Reminder   = require('../schema/Reminder');
const { sendMessageToConfiguredChannels } = require('./channelUtils');
const { parseDuration, formatDuration }  = require('./timeUtils');

// In‐memory map of scheduled reminder jobs
const scheduledReminders = new Map();

/**
 * Schedule reminders at specified intervals before a target time,
 * and persist them to the database.
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

  // 1) Upsert no MongoDB (cria ou atualiza)
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

  // 2) Limpa apenas os jobs em memória, NÃO remove do DB
  for (const [key, job] of scheduledReminders.entries()) {
    if (key.startsWith(baseKey)) {
      job.cancel();
      scheduledReminders.delete(key);
    }
  }

  // 3) Agenda alertas de intervalo (sem @here)
  for (const intervalStr of intervals) {
    const ms = parseDuration(intervalStr);
    if (isNaN(ms)) continue;
    const runAt = new Date(ts.getTime() - ms);
    if (runAt <= Date.now()) continue;

    const jobKey = `${baseKey}:interval:${intervalStr}`;
    const job = schedule.scheduleJob(runAt, async () => {
      await sendMessageToConfiguredChannels(
        interaction,
        `⌛ Reminder: **${parameterName}** will spawn in **${intervalStr}** please go to the boss location and save your safe/regroup teleport.`,
        'reminder',
        gameKey
      );
      scheduledReminders.delete(jobKey);
    });
    scheduledReminders.set(jobKey, job);
  }

  // 4) Agenda o alerta final (com @here) e aí sim apaga do DB após disparar
  const finalKey = `${baseKey}:final`;
  if (ts > Date.now()) {
    const finalJob = schedule.scheduleJob(ts, async () => {
      await sendMessageToConfiguredChannels(
        interaction,
        `@here \n
        🔔 Reminder: **${parameterName}** is about to spawn! Group up NOW at saved location. Get in discord voice!`,
        'reminder',
        gameKey
      );
      scheduledReminders.delete(finalKey);

      // 5) Agora sim remove o documento, pois o reminder expirou
      await Reminder.deleteOne({ guildId, gameKey, parameterName });
    });
    scheduledReminders.set(finalKey, finalJob);
  }
}

/**
 * Cancela apenas os jobs em memória e **não** remove o registro do DB.
 * A remoção do documento só deve ocorrer em caso de cancelamento
 * explícito (veja função abaixo) ou no alerta final.
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
 * Cancel all scheduled reminders (in‐memory jobs) and also remove do DB
 * *quando o usuário pedir explicitamente*.
 */
async function cancelScheduledReminder(
  guildId,
  gameKey,
  parameterName
) {
  clearScheduledJobs(guildId, gameKey, parameterName);

  // Remove do banco
  await Reminder.deleteOne({ guildId, gameKey, parameterName });
}

module.exports = {
  scheduleReminder,
  cancelScheduledReminder
};
