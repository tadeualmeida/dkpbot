// commands/reminderCommands.js

const { parseDuration, formatDuration } = require('../utils/timeUtils');
const { loadGuildConfig }                = require('../utils/config');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');
const {
  scheduleReminder,
  cancelScheduledReminder
} = require('../utils/reminderScheduler');
const { createErrorEmbed, createInfoEmbed } = require('../utils/embeds');

/**
 * /reminder game:<game> parameter:<p1,p2,…> time:<t1,t2,…>
 *
 * - game:      key of the game to use
 * - parameter: comma-separated list of reminder keys (pre-configured)
 * - time:      comma-separated list of durations (e.g. "1h30m", "45m")
 */
async function handleReminderCommand(interaction) {
  const guildId   = interaction.guildId;
  const gameKey   = interaction.options.getString('game')?.toLowerCase();
  const rawParams = interaction.options.getString('parameter');
  const rawTimes  = interaction.options.getString('time');

  await interaction.deferReply({ ephemeral: true });

  // 1️⃣ Load guild config and validate game
  const cfg     = await loadGuildConfig(guildId);
  const gameCfg = cfg.games.find(g => g.key === gameKey);
  if (!gameCfg) {
    return interaction.editReply({
      embeds: [ createErrorEmbed(
        'Unknown Game',
        `No configuration found for game **${gameKey}**.`
      ) ]
    });
  }

  // 2️⃣ Parse params & times
  const params = rawParams.split(',').map(s => s.trim()).filter(Boolean);
  const times  = rawTimes.split(',').map(s => s.trim()).filter(Boolean);

  // 3️⃣ Validate each param
  for (const p of params) {
    if (!Array.isArray(gameCfg.reminders) || !gameCfg.reminders.includes(p)) {
      return interaction.editReply({
        embeds: [ createErrorEmbed(
          'Unknown Parameter',
          `Reminder parameter **${p}** is not configured for **${gameCfg.name}**.`
        ) ]
      });
    }
  }

  // 4️⃣ Match params ↔ times
  let scheduleList;
  if (times.length === 1) {
    scheduleList = params.map(p => ({ param: p, time: times[0] }));
  } else if (times.length === params.length) {
    scheduleList = params.map((p, i) => ({ param: p, time: times[i] }));
  } else {
    return interaction.editReply({
      embeds: [ createErrorEmbed(
        'Mismatched Counts',
        `You provided ${params.length} parameter(s) but ${times.length} time value(s).`
      ) ]
    });
  }

  // 5️⃣ Cancel existing reminders
  for (const { param } of scheduleList) {
    await cancelScheduledReminder(guildId, gameKey, param);
  }

  // 6️⃣ Schedule new ones & build confirmation lines
  const lines = [];
  for (const { param, time } of scheduleList) {
    const ms = parseDuration(time);
    if (isNaN(ms) || ms <= 0) {
      return interaction.editReply({
        embeds: [ createErrorEmbed(
          'Invalid Time',
          `Could not parse duration **${time}**. Use formats like \`1h30m\`, \`45m\`, or \`10s\`.`
        ) ]
      });
    }

    await scheduleReminder(
      guildId,
      gameKey,
      param,
      gameCfg.reminderIntervals || [],
      Date.now() + ms,
      interaction
    );

    const targetAt = new Date(Date.now() + ms).toLocaleString();
    const ivals    = (gameCfg.reminderIntervals || [])
      .map(i => formatDuration(parseDuration(i)))
      .join(', ') || 'none';

    lines.push(
      `• **${param}** in **${time}** (at ${targetAt}); pre-alerts at [${ivals}]`
    );
  }

  // 7️⃣ Log in the reminder channel
  const logLines = scheduleList
    .map(({ param, time }) =>
      `• **${interaction.member.displayName}** → **${param}** in ${time}`
    ).join('\n');

  await sendMessageToConfiguredChannels(
    interaction,
    `New reminder(s) for **${gameCfg.name}**:\n${logLines}`,
    'reminder',
    gameKey
  );

  // 8️⃣ Reply with confirmation
  return interaction.editReply({
    embeds: [ createInfoEmbed(
      'Reminder Scheduled',
      lines.join('\n')
    ) ]
  });
}

module.exports = { handleReminderCommand };
