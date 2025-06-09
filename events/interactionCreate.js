// events/interactionCreate.js

const fs = require('fs');
const path = require('path');
const {
  getGuildCache,
  getActiveEventsFromCache,
  refreshDkpParametersCache,
  getGamesFromCache,
  // If you implement caching for categories/items in the future, add refreshCategoryCache, refreshItemCache, etc.
} = require('../utils/cacheManagement');
const { checkRolePermission } = require('../utils/permissions');
const { executeCommand } = require('../commands/executeCommand');
const { handleDkpRank } = require('../commands/dkpCommands');
const Category = require('../schema/Category');
const Item = require('../schema/Item');

async function handleInteractionCreate(interaction) {
  // 0) Autocomplete handling
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
    return;
  }

  // 1) Handle select‐menu for /rank when user has multiple games (or future selects for other commands)
  if (interaction.isStringSelectMenu()) {
    const [prefix, cmd] = interaction.customId.split(':');
    if (prefix === 'select-game-for-rank') {
      const gameKey = interaction.values[0];
      await interaction.deferUpdate();
      const guildId = interaction.guildId;
      const member = interaction.member;
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
  let sub = null;
  try { sub = interaction.options.getSubcommand(); } catch {}
  const focusedName = focused.name;

  // Normalize and lowercase game key or generic key
  const rawGame = interaction.options.getString('game') || interaction.options.getString('key') || '';
  const gameKey = rawGame.toLowerCase();

  if (
    focusedName === 'game' &&
    ['dkp','rank','dkpadd','dkpremove','bank','config','event','currency','reminder','reset','rankreport']
      .includes(cmd)
  ) {
    return suggestGames(interaction, guildId, search);
  }

  // ---- /event autocomplete ----
  if (cmd === 'event') {
    if ((sub === 'start' || sub === 'rank') && focusedName === 'parameter') {
      await refreshDkpParametersCache(guildId, gameKey);
      return suggestParameters(interaction, guildId, gameKey, search);
    }
    if ((sub === 'end' || sub === 'cancel') && focusedName === 'code') {
      return suggestEventCodes(interaction, guildId, search);
    }
    return;
  }

  // ---- /config autocomplete ----
  if (cmd === 'config') {
    const action = interaction.options.getString('action');

    // 1) Autocomplete for 'game' option in any subcommand that needs it
    const subcommandsNeedingGame = ['role','dkp','channel','show','event','auction','category','item'];
    if (subcommandsNeedingGame.includes(sub) && focusedName === 'game') {
      return suggestGames(interaction, guildId, search);
    }

    // 2) DKP parameter name for remove/edit
    if (sub === 'dkp' && focusedName === 'name' && ['remove','edit'].includes(action)) {
      await refreshDkpParametersCache(guildId, gameKey);
      return suggestParameters(interaction, guildId, gameKey, search);
    }

    // 3) Category name for /config category remove/edit
    if (sub === 'category' && focusedName === 'name' && ['remove','edit'].includes(action)) {
      return suggestCategories(interaction, guildId, gameKey, search);
    }

    // 4) Item name for /config item remove/edit
    if (sub === 'item' && focusedName === 'name' && ['remove','edit'].includes(action)) {
      return suggestItems(interaction, guildId, gameKey, search);
    }

    // 5) Category autocomplete when creating/editing an item: /config item ... category:<focused>
    if (sub === 'item' && focusedName === 'category') {
      return suggestCategories(interaction, guildId, gameKey, search);
    }

    // 6) Image filename autocomplete for /config item ... image:<focused>
    if (sub === 'item' && focusedName === 'image') {
      return suggestImages(interaction, search);
    }

    return;
  }

  // ---- /reminder autocomplete ----
  if (cmd === 'reminder' && focusedName === 'parameter') {
    const games = await getGamesFromCache(guildId);
    const game = games.find(g => g.key === gameKey);
    const choices = (game?.reminders || [])
      .filter(p => p.toLowerCase().includes(search))
      .slice(0, 25)
      .map(p => ({ name: p, value: p }));
    return interaction.respond(choices);
  }

  // ---- /auction autocomplete ----
  if (cmd === 'auction') {
    // For /auction bid: autocomplete item names
    if (sub === 'bid' && focusedName === 'item') {
      return suggestItems(interaction, guildId, gameKey, search);
    }
    // For /auction start: autocomplete category names
    if (sub === 'start' && focusedName === 'category') {
      return suggestCategories(interaction, guildId, gameKey, search);
    }
    return;
  }
  
  if (cmd === 'transactions') {
    // For /auction bid: autocomplete item names
    if (focusedName === 'game') {
      return suggestGames(interaction, guildId, search);
    }
  }  

  // If no matches, do nothing
}

// ---------- Suggestion Helpers ----------

async function suggestGames(interaction, guildId, search) {
  const gamesArr = await getGamesFromCache(guildId);
  const choices = gamesArr
    .map(g => ({ name: g.name, value: g.key }))
    .filter(opt =>
      opt.value.includes(search) ||
      opt.name.toLowerCase().includes(search)
    )
    .slice(0, 25);
  await interaction.respond(choices);
}

async function suggestParameters(interaction, guildId, gameKey, search) {
  const cache = getGuildCache(guildId);
  const choices = cache.keys()
    .filter(k => k.startsWith(`dkpParameter:${gameKey}:`))
    .map(k => k.split(':')[2])
    .filter(name => name.includes(search))
    .slice(0, 25)
    .map(name => ({ name, value: name }));
  await interaction.respond(choices);
}

async function suggestEventCodes(interaction, guildId, search) {
  const active = await getActiveEventsFromCache(guildId);
  const choices = active
    .filter(e => e.code.toLowerCase().includes(search))
    .slice(0, 25)
    .map(e => ({ name: e.code, value: e.code }));
  await interaction.respond(choices);
}

async function suggestCategories(interaction, guildId, gameKey, search) {
  // Query categories collection to find matches
  const regex = new RegExp(escapeForRegex(search), 'i');
  const cats = await Category.find({ guildId, gameKey, name: { $regex: regex } }).limit(25).lean();
  const choices = cats.map(c => ({ name: c.name, value: c.name }));
  await interaction.respond(choices);
}

async function suggestItems(interaction, guildId, gameKey, search) {
  // Query items collection to find matches
  const regex = new RegExp(escapeForRegex(search), 'i');
  const items = await Item.find({ guildId, gameKey, name: { $regex: regex } }).limit(25).lean();
  const choices = items.map(i => ({ name: i.name, value: i.name }));
  await interaction.respond(choices);
}

async function suggestImages(interaction, search) {
  // Read filenames from the local /img/itens directory
  const imagesDir = path.join(__dirname, '..', 'img', 'items');
  let files = [];
  try {
    files = fs.readdirSync(imagesDir);
  } catch (err) {
    // If directory doesn't exist or can't be read, return empty list
    return interaction.respond([]);
  }
  const choices = files
    .filter(f => f.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 25)
    .map(f => {
      // Remove extension for display if desired, otherwise keep full file name
      const name = path.parse(f).name;
      return { name, value: f };
    });
  await interaction.respond(choices);
}

// Helper to escape user input for regex construction
function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { handleInteractionCreate };
