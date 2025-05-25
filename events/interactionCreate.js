// events/interactionCreate.js

const {
  getGuildCache,
  getActiveEventsFromCache,
  refreshDkpParametersCache,
  getGamesFromCache
} = require('../utils/cacheManagement');

const { checkRolePermission } = require('../utils/permissions');
const { executeCommand }     = require('../commands/executeCommand');
const { handleDkpRank }      = require('../commands/dkpCommands');
const {
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

async function handleInteractionCreate(interaction) {
  // 0) Autocomplete for any 'game' options, event/config specifics, and /reminder parameter
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
    return;
  }

  // 1) Handle select‐menu only for /rank when user has multiple games
  if (interaction.isStringSelectMenu()) {
    const [prefix, cmd] = interaction.customId.split(':');
    if (prefix === 'select-game-for-rank') {
      const gameKey = interaction.values[0];
      await interaction.deferUpdate();
      const guildId = interaction.guildId;
      const member  = interaction.member;
      return handleDkpRank(interaction, guildId, member, gameKey);
    }
  }

  // 2) Standard slash commands
  if (!interaction.isChatInputCommand()) return;
  if (!await checkRolePermission(interaction, interaction.commandName)) return;
  await executeCommand(interaction);
}

async function handleAutocomplete(interaction) {
  const guildId     = interaction.guildId;
  const focused     = interaction.options.getFocused(true);
  const search      = focused.value.toLowerCase();
  const cmd         = interaction.commandName;
  const focusedName = focused.name;

  // 2a) Any 'game' option for listed commands
  if (
    focusedName === 'game' &&
    ['dkp','rank','dkpadd','dkpremove','bank','config','event','currency','reminder','reset']
      .includes(cmd)
  ) {
    return suggestGames(interaction, guildId, search);
  }

  // 2b) /event: parameter and code autocompletes
  let sub = null;
  try { sub = interaction.options.getSubcommand(); } catch {}
  if (cmd === 'event' && (sub === 'start' || sub === 'rank') && focusedName === 'parameter') {
    const rawGame = interaction.options.getString('game') || '';
    const gameKey = rawGame.toLowerCase();
    await refreshDkpParametersCache(guildId, gameKey);
    return suggestParameters(interaction, guildId, gameKey, search);
  }
  if (cmd === 'event' && (sub === 'end' || sub === 'cancel') && focusedName === 'code') {
    return suggestEventCodes(interaction, guildId, search);
  }

  // 2c) /config dkp remove/edit name
  if (cmd === 'config' && sub === 'dkp' && focusedName === 'name') {
    const action = interaction.options.getString('action');
    if (['remove','edit'].includes(action)) {
      const rawGame = interaction.options.getString('game') || '';
      const gameKey = rawGame.toLowerCase();
      await refreshDkpParametersCache(guildId, gameKey);
      return suggestParameters(interaction, guildId, gameKey, search);
    }
  }

  // 2d) /reminder parameter autocomplete
  if (cmd === 'reminder' && focusedName === 'parameter') {
    const rawGame = interaction.options.getString('game') || '';
    const gameKey = rawGame.toLowerCase();
    const games = await getGamesFromCache(guildId);
    const game = games.find(g => g.key === gameKey);
    const choices = (game?.reminders || [])
      .filter(p => p.toLowerCase().includes(search))
      .slice(0, 25)
      .map(p => ({ name: p, value: p }));
    return interaction.respond(choices);
  }
}

async function suggestGames(interaction, guildId, search) {
  const gamesArr = await getGamesFromCache(guildId);
  const choices = gamesArr
    .map(g => ({ name: g.name, value: g.key }))
    .filter(opt => opt.value.includes(search) || opt.name.toLowerCase().includes(search))
    .slice(0,25);
  await interaction.respond(choices);
}

async function suggestParameters(interaction, guildId, gameKey, search) {
  const cache = getGuildCache(guildId);
  const choices = cache.keys()
    .filter(k => k.startsWith(`dkpParameter:${gameKey}:`))
    .map(k => k.split(':')[2])
    .filter(n => n.includes(search))
    .slice(0,25)
    .map(name => ({ name, value: name }));
  await interaction.respond(choices);
}

async function suggestEventCodes(interaction, guildId, search) {
  const active = await getActiveEventsFromCache(guildId);
  const choices = active
    .filter(e => e.code.toLowerCase().includes(search))
    .slice(0,25)
    .map(e => ({ name: e.code, value: e.code }));
  await interaction.respond(choices);
}

module.exports = { handleInteractionCreate };
