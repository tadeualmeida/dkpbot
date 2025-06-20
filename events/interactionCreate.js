// File: events/interactionCreate.js

const fs = require('fs');
const path = require('path');
const {
  getGuildCache,
  getActiveEventsFromCache,
  refreshDkpParametersCache,
  getGamesFromCache,
  getOpenAuctionsFromCache,
  getItemsFromCache
} = require('../utils/cacheManagement');
const { checkRolePermission } = require('../utils/permissions');
const { executeCommand } = require('../commands/executeCommand');
const { handleDkpRank } = require('../commands/dkpCommands');
const Category = require('../schema/Category');
const Item = require('../schema/Item');

/**
 * Central interactionCreate event handler
 */
async function handleInteractionCreate(interaction) {
  // 0) Autocomplete
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
    return;
  }

  // 1) String select menu for /rank
  if (interaction.isStringSelectMenu()) {
    const [prefix, cmd] = interaction.customId.split(':');
    if (prefix === 'select-game-for-rank') {
      const gameKey = interaction.values[0];
      await interaction.deferUpdate();
      return handleDkpRank(interaction, interaction.guildId, interaction.member, gameKey);
    }
  }

  // 2) Slash commands
  if (!interaction.isChatInputCommand()) return;
  if (!await checkRolePermission(interaction, interaction.commandName)) return;
  await executeCommand(interaction);
}

/**
 * Autocomplete handler for various commands
 */
async function handleAutocomplete(interaction) {
  const guildId = interaction.guildId;
  const focused = interaction.options.getFocused(true);
  const search = focused.value.toLowerCase();
  const cmd = interaction.commandName;
  let sub;
  try { sub = interaction.options.getSubcommand(); } catch {}
  const focusedName = focused.name;

  // Normalize game key
  const rawGame = interaction.options.getString('game')
    || interaction.options.getString('key') || '';
  const gameKey = rawGame.toLowerCase();

  // ---- generic game autocomplete ----
  if (
    focusedName === 'game' &&
    ['dkp','rank','dkpadd','dkpremove','bank','config','event','currency','reminder','reset','rankreport', 'transactions']
      .includes(cmd)
  ) {
    return suggestGames(interaction, guildId, search);
  }

  // ---- /auction autocomplete ----
  if (cmd === 'auction') {
    // game option
    if ((sub === 'start' || sub === 'edit' || sub === 'end' || sub === 'cancel' || sub === 'history') && focusedName === 'game') {
      return suggestGames(interaction, guildId, search);
    }
    // start: item and quantity
    if (sub === 'start') {
      if (focusedName === 'item') {
        return suggestItems(interaction, guildId, gameKey, search);
      }
      if (focusedName === 'quantity') {
        return interaction.respond([]);
      }
    }
    // edit: auctionid, item, quantity
    if (sub === 'edit') {
      if (focusedName === 'auctionid') {
        // list open auctions with their item names
        const openAuctions = await getOpenAuctionsFromCache(guildId, gameKey);
        const items         = await getItemsFromCache(guildId, gameKey);
        const choices = openAuctions
          .filter(a => a._id.toString().includes(search))
          .slice(0, 25)
          .map(a => {
            const item = items.find(i => i._id.toString() === a.item.toString());
            return {
              name:  `${a._id} – ${item?.name ?? 'Unknown'}`,
              value: a._id.toString()
            };
          });
        return interaction.respond(choices);
      }
      if (focusedName === 'item') {
        return suggestItems(interaction, guildId, gameKey, search);
      }
      if (focusedName === 'quantity') {
        return interaction.respond([]); // quantity is numeric, no autocomplete
      }
    }
    // end: auctionid
    if ((sub === 'end' || sub === 'cancel') && focusedName === 'auctionid') {
      const openAuctions = await getOpenAuctionsFromCache(guildId, gameKey);
      const items         = await getItemsFromCache(guildId, gameKey);
      const choices = openAuctions
        .filter(a => a._id.toString().includes(search))
        .slice(0, 25)
        .map(a => {
          const item = items.find(i => i._id.toString() === a.item.toString());
          return {
            name:  `${a._id} – ${item?.name ?? 'Unknown'}`,
            value: a._id.toString()
          };
        });
      return interaction.respond(choices);
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

  // ---- /config autocomplete ----
  if (cmd === 'config') {
    const action = interaction.options.getString('action');
    const needGame = ['role','dkp','channel','show','event','auction','category','item'];
    if (needGame.includes(sub) && focusedName === 'game') {
      return suggestGames(interaction, guildId, search);
    }
    if (sub === 'dkp' && focusedName === 'name' && ['remove','edit'].includes(action)) {
      await refreshDkpParametersCache(guildId, gameKey);
      return suggestParameters(interaction, guildId, gameKey, search);
    }
    if (sub === 'category' && focusedName === 'name' && ['remove','edit'].includes(action)) {
      return suggestCategories(interaction, guildId, gameKey, search);
    }
    if (sub === 'item' && focusedName === 'name' && ['remove','edit'].includes(action)) {
      return suggestItems(interaction, guildId, gameKey, search);
    }
    if (sub === 'item' && focusedName === 'category') {
      return suggestCategories(interaction, guildId, gameKey, search);
    }
    if (sub === 'item' && focusedName === 'image') {
      return suggestImages(interaction, search);
    }
    return;
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
}

// ---------- Suggestion Helpers ----------

async function suggestGames(interaction, guildId, search) {
  const gamesArr = await getGamesFromCache(guildId);
  const choices = gamesArr
    .map(g => ({ name: g.name, value: g.key }))
    .filter(opt => opt.value.includes(search) || opt.name.toLowerCase().includes(search))
    .slice(0, 25);
  return interaction.respond(choices);
}

async function suggestParameters(interaction, guildId, gameKey, search) {
  const cache = getGuildCache(guildId);
  const choices = cache.keys()
    .filter(k => k.startsWith(`dkpParameter:${gameKey}:`))
    .map(k => k.split(':')[2])
    .filter(name => name.includes(search))
    .slice(0, 25)
    .map(name => ({ name, value: name }));
  return interaction.respond(choices);
}

async function suggestCategories(interaction, guildId, gameKey, search) {
  const regex = new RegExp(escapeForRegex(search), 'i');
  const cats = await Category.find({ guildId, gameKey, name: { $regex: regex } }).limit(25).lean();
  const choices = cats.map(c => ({ name: c.name, value: c.name }));
  return interaction.respond(choices);
}

async function suggestItems(interaction, guildId, gameKey, search) {
  const regex = new RegExp(escapeForRegex(search), 'i');
  const items = await Item.find({ guildId, gameKey, name: { $regex: regex } }).limit(25).lean();
  const choices = items.map(i => ({ name: i.name, value: i._id.toString() }));
  return interaction.respond(choices);
}

async function suggestEventCodes(interaction, guildId, search) {
  const active = await getActiveEventsFromCache(guildId);
  const choices = active
    .filter(e => e.code.toLowerCase().includes(search))
    .slice(0, 25)
    .map(e => ({ name: e.code, value: e.code }));
  return interaction.respond(choices);
}

async function suggestImages(interaction, search) {
  const imagesDir = path.join(__dirname, '..', 'img', 'items');
  let files = [];
  try { files = fs.readdirSync(imagesDir); } catch { return interaction.respond([]); }
  const choices = files
    .filter(f => f.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 25)
    .map(f => ({ name: path.parse(f).name, value: f }));
  return interaction.respond(choices);
}

function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

module.exports = { handleInteractionCreate };
