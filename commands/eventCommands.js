//commands/eventCommands.js

const validator = require('validator');
const {
  createCombinedEventEmbed,
  createEventEndedEmbed,
  createJoinEventEmbed,
  createMultipleResultsEmbed,
  createInfoEmbed,
  createErrorEmbed
} = require('../utils/embeds');
const Event = require('../schema/Event');
const { resolveGameKey } = require('../utils/resolveGameKey');
const {
  getDkpParameterFromCache,
  getEventTimerFromCache,
  addParticipantToEventCache,
  getEventParticipantsFromCache,
  clearEventParticipantsCache,
  refreshDkpRankingCache,
  refreshActiveEventsCache,
  removeActiveEventFromCache,
  getActiveEventsFromCache
} = require('../utils/cacheManagement');
const { loadGuildConfig } = require('../utils/config');
const { generateRandomCode } = require('../utils/codeGenerator');
const Dkp = require('../schema/Dkp');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');
const { scheduleEventEnd, cancelScheduledJob } = require('../utils/scheduler');
const { createBulkOperations, replyWithError, updateDkpTotal, getGameName } = require('../utils/generalUtils');

/**
 * Entry point for all /event and /join commands with per-game resolution
 */
async function handleEventCommands(interaction) {
  if (interaction.commandName === 'event') {
    // Resolve game for /event subcommands
    const forced  = interaction.options.getString('game')?.toLowerCase() || null;
    const gameKey = forced || await resolveGameKey(interaction, interaction.member);
    if (!gameKey) return;

    const sub = interaction.options.getSubcommand(false);
    switch (sub) {
      case 'start':  return startEvent(interaction, gameKey);
      case 'end':    return endEvent(interaction, gameKey);
      case 'list':   return listEvent(interaction, gameKey);
      case 'cancel': return cancelEvent(interaction, gameKey);
      case 'rank':   return handleEventRank(interaction, gameKey);
      default:
        return replyWithError(interaction, 'Error', 'Unknown event subcommand.');
    }

  } else if (interaction.commandName === 'join') {
    // /join only needs the code, gameKey inferred from cache
    const guildId = interaction.guildId;
    return joinEvent(interaction, guildId);
  }
}

// /event start
async function startEvent(interaction, gameKey) {
  const guildId = interaction.guildId;
  await interaction.deferReply({ ephemeral: true });

  const parameterName = validator.escape(interaction.options.getString('parameter'));
  const [dkpParam, timer, activeEvents, cfg] = await Promise.all([
    getDkpParameterFromCache(guildId, gameKey, parameterName),
    getEventTimerFromCache(guildId, gameKey),
    getActiveEventsFromCache(guildId, gameKey),
    loadGuildConfig(guildId)
  ]);

  if (!dkpParam) {
    return replyWithError(interaction, 'Error', `No DKP parameter '${parameterName}'.`);
  }
  if (activeEvents.some(e => e.parameterName === parameterName && e.isActive)) {
    return replyWithError(interaction, 'Error', `An event for '${parameterName}' is already active.`);
  }

  const code    = generateRandomCode();
  const userId  = interaction.user.id;
  const display = interaction.member.displayName;
  const rec     = await Dkp.findOne({ guildId, gameKey, userId });
  const initial = rec ? rec.points : 0;

  // Create & cache the event
  const evt = new Event({ guildId, gameKey, parameterName, code, participants: [], isActive: true });
  await evt.save();
  await refreshActiveEventsCache(guildId, gameKey);

  // Add the starter as participant
  addParticipantToEventCache(guildId, gameKey, code, {
    userId,
    username: display,
    discordUsername: interaction.user.username,
    joinedAt: new Date()
  });

  // Schedule its end
  await scheduleEventEnd(guildId, gameKey, code, parameterName, timer, interaction);

  // Reply to starter
  const gameName = await getGameName(guildId, gameKey);
  const embed = createCombinedEventEmbed(
    parameterName,
    code,
    dkpParam,
    { points: initial + dkpParam.points },
    cfg
  );
  await interaction.editReply({ embeds: [embed] });

  // Log
  const msg = `**${display}** started event **${parameterName}** for **${gameName}**, code **${code}**.`;
  await sendMessageToConfiguredChannels(interaction, msg, 'event', gameKey);
}

// /event end
async function endEvent(interaction, gameKey) {
  const guildId = interaction.guildId;
  await interaction.deferReply({ ephemeral: true });

  const code   = validator.escape(interaction.options.getString('code')).toUpperCase();
  const events = await getActiveEventsFromCache(guildId, gameKey);
  const act    = events.find(e => e.code === code && e.isActive);
  if (!act) {
    return replyWithError(interaction, 'Error', 'Event not found or already ended.');
  }

  const parts = await getEventParticipantsFromCache(guildId, gameKey, code) || [];
  act.participants = parts;
  act.isActive     = false;
  await Event.updateOne(
    { guildId, gameKey, code },
    { isActive: false, participants: parts }
  );

  const dkpParam = await getDkpParameterFromCache(guildId, gameKey, act.parameterName);
  const changes  = parts.map(p => ({ userId: p.userId, pointChange: dkpParam.points }));
  const ops      = createBulkOperations(changes, guildId, gameKey, dkpParam.points, `Event ${code} ended`);
  if (ops.length) {
    await Dkp.bulkWrite(ops);
    await updateDkpTotal(parts.length * dkpParam.points, guildId, gameKey);
  }

  await interaction.editReply({ embeds: [createEventEndedEmbed()] });
  const users    = parts.map(p => p.username).join(', ') || 'None';
  const gameName = await getGameName(guildId, gameKey);
  const log      = `Event **${code}** ended for **${gameName}**. Participants: ${users}.`;
  await sendMessageToConfiguredChannels(interaction, log, 'event', gameKey);

  clearEventParticipantsCache(guildId, gameKey, code);
  removeActiveEventFromCache(guildId, gameKey, code);
  await cancelScheduledJob(guildId, gameKey, code);
}

// /event list
async function listEvent(interaction, gameKey) {
  const guildId = interaction.guildId;
  await interaction.deferReply({ ephemeral: true });

  const code = validator.escape(interaction.options.getString('code')).toUpperCase();
  let evt = (await getActiveEventsFromCache(guildId, gameKey))
              .find(e => e.code === code)
          || await Event.findOne({ guildId, gameKey, code });
  if (!evt) {
    return interaction.editReply({ content: `Event ${code} not found.`, ephemeral: true });
  }

  const parts = await getEventParticipantsFromCache(guildId, gameKey, code);
  const names = Array.isArray(parts) ? parts.map(p => p.username) : evt.participants.map(p => p.username);

  await interaction.editReply({
    embeds: [createMultipleResultsEmbed('info', `Participants — ${code}`, names)]
  });
}

// /event cancel
async function cancelEvent(interaction, gameKey) {
  const guildId = interaction.guildId;
  await interaction.deferReply({ ephemeral: true });

  const code = validator.escape(interaction.options.getString('code')).toUpperCase();
  const events = await getActiveEventsFromCache(guildId, gameKey);
  const evt    = events.find(e => e.code === code && e.isActive);
  if (!evt) {
    return replyWithError(interaction, 'Error', 'No active event with that code.');
  }

  evt.isActive = false;
  await Event.updateOne({ guildId, gameKey, code }, { isActive: false });

  const parts = await getEventParticipantsFromCache(guildId, gameKey, code) || [];
  const names = parts.map(p => p.username);

  await interaction.editReply({
    embeds: [createInfoEmbed('Event Canceled', `Event ${code} canceled. Participants: ${names.join(', ')}`)]
  });
  const gameName = await getGameName(guildId, gameKey);
  const log = `Event **${code}** canceled by **${interaction.member.displayName}** on **${gameName}**.`;
  await sendMessageToConfiguredChannels(interaction, log, 'event', gameKey);

  clearEventParticipantsCache(guildId, gameKey, code);
  removeActiveEventFromCache(guildId, gameKey, code);
  await cancelScheduledJob(guildId, gameKey, code);
}

// /join
async function joinEvent(interaction, guildId) {
  await interaction.deferReply({ ephemeral: true });

  const code = validator.escape(interaction.options.getString('code')).toUpperCase();

  // 1) Look across *all* games for an active event with that code
  const allActive = await getActiveEventsFromCache(guildId);
  const evtEntry = allActive.find(e => e.code === code && e.isActive);
  if (!evtEntry) {
    return replyWithError(interaction, 'Error', 'No active event found with that code.');
  }
  const gameKey = evtEntry.gameKey;

  // 2) Pull the participants array from cache
  const parts = await getEventParticipantsFromCache(guildId, gameKey, code) || [];

  // 3) Now safe to check `.some()`
  if (parts.some(p => p.userId === interaction.user.id)) {
    return replyWithError(interaction, 'Error', 'You have already joined this event.');
  }

  // 4) Fetch current DKP
  const userId   = interaction.user.id;
  const display  = interaction.member.displayName;
  const dkpParam = await getDkpParameterFromCache(guildId, gameKey, evtEntry.parameterName);
  const rec      = await Dkp.findOne({ guildId, gameKey, userId });
  const current  = rec ? rec.points : 0;

  // 5) Add them into the in-memory list
  addParticipantToEventCache(guildId, gameKey, code, {
    userId,
    username: display,
    discordUsername: interaction.user.username,
    joinedAt: new Date()
  });

  // 6) Send the confirmation embed
  const embed = createJoinEventEmbed(dkpParam, { points: current + dkpParam.points }, code);
  await interaction.editReply({ embeds: [embed] });
}

// /event rank
async function handleEventRank(interaction, gameKey) {
  const guildId = interaction.guildId;
  await interaction.deferReply({ ephemeral: true });

  const param = interaction.options.getString('parameter');
  const dkpParam = await getDkpParameterFromCache(guildId, gameKey, param);
  if (!dkpParam) {
    return replyWithError(interaction, 'Error', `No DKP parameter '${param}'.`);
  }

  const events = await Event.find({ guildId, gameKey, parameterName: param });
  if (!events.length) {
    return interaction.editReply({
      embeds: [createInfoEmbed('No Events', `No events found for parameter '${param}'.`)]
    });
  }

  const scores = {}; for (const ev of events) ev.participants.forEach(p => {
    scores[p.userId] = scores[p.userId] || { username: p.username, points: 0 };
    scores[p.userId].points += dkpParam.points;
  });

  const list = Object.values(scores)
    .sort((a, b) => b.points - a.points)
    .map((u, i) => `${i + 1}. **${u.username}** — ${u.points} points`);

  await interaction.editReply({ embeds: [createMultipleResultsEmbed('info', `Event Rank — ${param}`, list)] });
}

module.exports = { handleEventCommands };
