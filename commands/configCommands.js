// commands/configCommands.js

const { loadGuildConfig, invalidateGuildConfig } = require('../utils/config');
const {
  refreshDkpParametersCache,
  refreshDkpMinimumCache,
  refreshEventTimerCache,
  refreshCurrencyCache,
  refreshChannelsCache,
  refreshRoleConfigCache,
  refreshItemCache,
  refreshCategoryCache,
  refreshGuildConfigCache
} = require('../utils/cacheManagement');
const {
  createMultipleResultsEmbed,
  createInfoEmbed,
  createErrorEmbed
} = require('../utils/embeds');
const validator = require('validator');
const { parseDuration } = require('../utils/timeUtils');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');

// Modelos externos de Category e Item
const Category = require('../schema/Category');
const Item     = require('../schema/Item');

async function handleConfigCommands(interaction) {
  const guildId = interaction.guildId;
  const sub     = interaction.options.getSubcommand();

  // Carrega config geral
  const cfg = await loadGuildConfig(guildId);
  let gameKey, gameCfg;

  // Determinar se o subcomando precisa de game context
  const needsGame = [
    'role', 'dkp', 'channel', 'reminder', 'show', 'event', 'auction',
    'category', 'item'
  ].includes(sub);

  if (needsGame) {
    gameKey = interaction.options.getString('game')?.toLowerCase();
    gameCfg = cfg.games.find(g => g.key === gameKey);
    if (!gameCfg) {
      return interaction.reply({
        embeds: [ createErrorEmbed(`Game \`${gameKey}\` not found.`) ],
        ephemeral: true
      });
    }
  }

  switch (sub) {
    // ---- ROLE ----
    case 'role': {
      const group = interaction.options.getString('commandgroup');
      const role  = interaction.options.getRole('role');
      gameCfg.roles[group] = [ role.id ];
      break;
    }

    // ---- DKP ----
    case 'dkp': {
      const action  = interaction.options.getString('action');
      const nameOpt = interaction.options.getString('name');
      const name    = nameOpt ? validator.escape(nameOpt.toLowerCase()) : null;
      const pts     = interaction.options.getInteger('points');

      if ((action === 'add' || action === 'edit') && (!name || pts == null)) {
        return interaction.reply({
          embeds: [ createErrorEmbed('Name and points are required for add/edit.') ],
          ephemeral: true
        });
      }
      if (action === 'remove' && !name) {
        return interaction.reply({
          embeds: [ createErrorEmbed('Name is required to remove parameter.') ],
          ephemeral: true
        });
      }
      if (action === 'minimum' && pts == null) {
        return interaction.reply({
          embeds: [ createErrorEmbed('Points value is required to set minimum.') ],
          ephemeral: true
        });
      }

      switch (action) {
        case 'add':
        case 'edit': {
          const idx = gameCfg.dkpParameters.findIndex(p => p.name === name);
          if (idx !== -1) {
            gameCfg.dkpParameters[idx].points = pts;
          } else {
            gameCfg.dkpParameters.push({ name, points: pts });
          }
          break;
        }
        case 'remove': {
          gameCfg.dkpParameters = gameCfg.dkpParameters.filter(p => p.name !== name);
          break;
        }
        case 'minimum': {
          gameCfg.minimumPoints = pts;
          break;
        }
      }
      break;
    }

    // ---- CHANNEL ----
    case 'channel': {
      const type    = interaction.options.getString('type');    // 'log', 'reminder' ou 'auction'
      const channel = interaction.options.getChannel('channel');
      if (!channel) {
        return interaction.reply({
          embeds: [ createErrorEmbed('You must specify a channel.') ],
          ephemeral: true
        });
      }
      if (!['log','reminder','auction'].includes(type)) {
        return interaction.reply({
          embeds: [ createErrorEmbed('Invalid channel type; must be "log", "reminder" or "auction".') ],
          ephemeral: true
        });
      }
      gameCfg.channels[type] = channel.id;
      break;
    }

    // ---- REMINDER ----
    case 'reminder': {
      gameCfg.reminders ||= [];
      gameCfg.reminderIntervals ||= [];

      const action    = interaction.options.getString('action');
      const rawParams = interaction.options.getString('parameter');
      const intervals = interaction.options.getString('intervals');

      if (action === 'add') {
        if (!rawParams) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Parameter name is required to add.') ],
            ephemeral: true
          });
        }
        const names = rawParams.split(',').map(s => s.trim()).filter(Boolean);
        names.forEach(name => {
          if (!gameCfg.reminders.includes(name)) {
            gameCfg.reminders.push(name);
          }
        });
      }
      else if (action === 'remove') {
        if (!rawParams) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Parameter name is required to remove.') ],
            ephemeral: true
          });
        }
        const names = rawParams.split(',').map(s => s.trim()).filter(Boolean);
        gameCfg.reminders = gameCfg.reminders.filter(p => !names.includes(p));
      }
      else if (action === 'intervals') {
        if (!rawParams || !intervals) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Parameter and intervals are required.') ],
            ephemeral: true
          });
        }
        if (!gameCfg.reminders.includes(rawParams.trim())) {
          return interaction.reply({
            embeds: [ createErrorEmbed(`Reminder parameter \`${rawParams}\` not found.`) ],
            ephemeral: true
          });
        }
        gameCfg.reminderIntervals = intervals.split(',').map(s => s.trim());
      } else {
        return interaction.reply({
          embeds: [ createErrorEmbed('Invalid reminder action.') ],
          ephemeral: true
        });
      }
      break;
    }

    // ---- CATEGORY ----
    case 'category': {
      // ações: add, remove, edit, list
      const action       = interaction.options.getString('action');
      const catNameOpt   = interaction.options.getString('name');
      const catName      = catNameOpt ? validator.escape(catNameOpt.trim()) : null;
      const minDkp       = interaction.options.getInteger('minimumdkp');
      const minCurrency  = interaction.options.getInteger('minimumcurrency');
      const bidIncrement = interaction.options.getInteger('bid_increment');

      switch (action) {
        case 'add': {
          if (!catName || minDkp == null || minCurrency == null || bidIncrement == null) {
            return interaction.reply({
              embeds: [ createErrorEmbed('Name, minimum DKP, minimum Currency and increment are all required to add a category.') ],
              ephemeral: true
            });
          }
          try {
            await Category.create({
              guildId,
              gameKey,
              name:            catName,
              minimumDkp:      minDkp,
              minimumCurrency: minCurrency,
              bidIncrement
            });
          } catch (err) {
            return interaction.reply({
              embeds: [ createErrorEmbed('Error', `Could not create category: ${err.message}`) ],
              ephemeral: true
            });
          }
          break;
        }
        case 'remove': {
          if (!catName) {
            return interaction.reply({
              embeds: [ createErrorEmbed('Name is required to remove a category.') ],
              ephemeral: true
            });
          }
          await Category.findOneAndDelete({ guildId, gameKey, name: catName });
          break;
        }
        case 'edit': {
          if (!catName) {
            return interaction.reply({
              embeds: [ createErrorEmbed('Name is required to edit a category.') ],
              ephemeral: true
            });
          }
          const updateFields = {};
          if (minDkp != null)       updateFields.minimumDkp = minDkp;
          if (minCurrency != null)  updateFields.minimumCurrency = minCurrency;
          if (bidIncrement != null) updateFields.bidIncrement = bidIncrement;
          if (Object.keys(updateFields).length === 0) {
            return interaction.reply({
              embeds: [ createErrorEmbed('At least one of min_dkp, min_currency or increment must be provided to edit.') ],
              ephemeral: true
            });
          }
          await Category.updateOne(
            { guildId, gameKey, name: catName },
            { $set: updateFields }
          );
          break;
        }
        case 'list': {
          // apenas criar o embed de listagem, sem persistir nada
          const cats = await Category.find({ guildId, gameKey }).lean();
          if (!cats.length) {
            return interaction.reply({
              embeds: [ createInfoEmbed('Categories', 'Nenhuma categoria cadastrada.') ],
              ephemeral: true
            });
          }
          const lines = cats.map(c =>
            `• **${c.name}** – min DKP: ${c.minimumDkp}, min Currency: ${c.minimumCurrency}, increment: ${c.bidIncrement}`
          );
          return interaction.reply({
            embeds: [ createMultipleResultsEmbed('info', 'Categorias', lines) ],
            ephemeral: true
          });
        }
        default:
          return interaction.reply({
            embeds: [ createErrorEmbed('Invalid category action.') ],
            ephemeral: true
          });
      }
      break;
    }

    // ---- ITEM ----
    case 'item': {
      // ações: add, remove, list
      const action     = interaction.options.getString('action');
      const itemName   = interaction.options.getString('name')?.trim();
      const categoryOpt= interaction.options.getString('category')?.trim();
      const image      = interaction.options.getString('image')?.trim();;
      switch (action) {
        case 'add': {
          if (!itemName || !categoryOpt) {
            return interaction.reply({
              embeds: [ createErrorEmbed('Name and category are required to add an item.') ],
              ephemeral: true
            });
          }
          // encontra o ID da categoria
          const categoryDoc = await Category.findOne({ guildId, gameKey, name: categoryOpt });
          if (!categoryDoc) {
            return interaction.reply({
              embeds: [ createErrorEmbed(`Category \`${categoryOpt}\` not found.`) ],
              ephemeral: true
            });
          }
          try {
            await Item.create({
              guildId,
              gameKey,
              name:     itemName,
              category: categoryDoc._id,
              image
            });
          } catch (err) {
            return interaction.reply({
              embeds: [ createErrorEmbed('Error', `Could not create item: ${err.message}`) ],
              ephemeral: true
            });
          }
          break;
        }
        case 'remove': {
          if (!itemName) {
            return interaction.reply({
              embeds: [ createErrorEmbed('Name is required to remove an item.') ],
              ephemeral: true
            });
          }
          const itemDoc = await Item.findOneAndDelete({ guildId, gameKey, _id: itemName });
          if (!itemDoc) {
            return interaction.reply({ content: `Item **${itemName}** not found.`, ephemeral: true });
          }
          return interaction.reply({
            content: `Item **${itemName}** successfully removed.`,
            ephemeral: true
          });
    }
        case 'list': {
          const items = await Item.find({ guildId, gameKey }).populate('category', 'name').lean();
          if (!items.length) {
            return interaction.reply({
              embeds: [ createInfoEmbed('Items', 'No items registered.') ],
              ephemeral: true
            });
          }
          const lines = items.map(i =>
            `• **${i.name}** – Category: **${i.category.name}**`
          );
          return interaction.reply({
            embeds: [ createMultipleResultsEmbed('info', 'Itens', lines) ],
            ephemeral: true
          });
        }
        default:
          return interaction.reply({
            embeds: [ createErrorEmbed('Invalid item action.') ],
            ephemeral: true
          });
      }
      break;
    }

    // ---- SHOW ----
    case 'show': {
      const action = interaction.options.getString('action');
      let embed;

      switch (action) {
        case 'parameters':
          embed = createMultipleResultsEmbed(
            'info',
            'DKP Parameters',
            gameCfg.dkpParameters.map(p => `• ${p.name}: **${p.points}**`)
          );
          break;

        case 'channels':
          embed = createInfoEmbed(
            'Channels',
            `Log: <#${gameCfg.channels.log || 'none'}>\n` +
            `Reminder: <#${gameCfg.channels.reminder || 'none'}>\n` +
            `Auction: <#${gameCfg.channels.auction || 'none'}>`
          );
          break;

        case 'minimum':
          embed = createInfoEmbed(
            'Minimum Points',
            `**${gameCfg.minimumPoints || 0}**`
          );
          break;

        case 'event':
          embed = createInfoEmbed(
            'Event Timer',
            `**${gameCfg.eventTimer || 0}** minutes`
          );
          break;

        case 'auction':
          {
            const minutes = gameCfg.defaultAuctionDuration || 0;
            const hrs  = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const human= `${hrs > 0 ? `${hrs}h` : ''}${mins > 0 ? `${mins}m` : ''}` || '0m';
            embed = createInfoEmbed(
              'Auction Timer',
              `**${human}** (${minutes} minutes) – default for new auctions`
            );
          }
          break;

        case 'categories': {
          // lista categoria diretamente do banco
          const cats = await Category.find({ guildId, gameKey }).lean();
          if (!cats.length) {
            return interaction.reply({
              embeds: [ createInfoEmbed('Categorias', 'Nenhuma categoria cadastrada.') ],
              ephemeral: true
            });
          }
          const lines = cats.map(c =>
            `• **${c.name}** – min DKP: ${c.minimumDkp}, min Currency: ${c.minimumCurrency}, increment: ${c.bidIncrement}`
          );
          embed = createMultipleResultsEmbed('info', 'Categorias', lines);
          break;
        }

        case 'items': {
          const items = await Item.find({ guildId, gameKey }).populate('category', 'name').lean();
          if (!items.length) {
            return interaction.reply({
              embeds: [ createInfoEmbed('Itens', 'Nenhum item cadastrado.') ],
              ephemeral: true
            });
          }
          const lines = items.map(i =>
            `• **${i.name}** – Categoria: **${i.category.name}**`
          );
          embed = createMultipleResultsEmbed('info', 'Itens', lines);
          break;
        }

        case 'reminder': {
          const params = (gameCfg.reminders || [])
            .map(p => `• ${p}`)
            .join('\n') || 'None';
          const ints = (gameCfg.reminderIntervals || [])
            .join(', ') || 'None';
          embed = createInfoEmbed(
            'Reminder Settings',
            `**Parameters:**\n${params}\n\n**Intervals:**\n${ints}`
          );
          break;
        }

        default:
          return interaction.reply({
            embeds: [ createErrorEmbed('Invalid show action.') ],
            ephemeral: true
          });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ---- EVENT TIMER ----
    case 'event': {
      const minutes = interaction.options.getInteger('minutes');
      if (!minutes || minutes <= 0) {
        return interaction.reply({
          embeds: [ createErrorEmbed('Valid minutes are required.') ],
          ephemeral: true
        });
      }
      gameCfg.eventTimer = minutes;
      break;
    }

    // ---- AUCTION CONFIGURATION ----
    case 'auction': {
      const action = interaction.options.getString('action');
      // for timer and delete we accept a free-form duration string
      const rawDuration = interaction.options.getString('duration');
      // for mode we accept a choice
      const modeChoice  = interaction.options.getString('mode');

      if (action === 'timer') {
        // Set default auction duration (minutes)
        const ms = parseDuration(rawDuration);
        if (isNaN(ms) || ms <= 0) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Could not parse duration. Use `10h30m`, `45m`, `2h`, etc.') ],
            ephemeral: true
          });
        }
        const minutes = Math.floor(ms / 60000);
        gameCfg.defaultAuctionDuration = minutes;
        await sendMessageToConfiguredChannels(
          interaction,
          `🔧 Auction timer for **${gameCfg.name}** updated to **${rawDuration}** (${minutes}m).`,
          'auction',
          gameKey
        );
        
      } else if (action === 'delete') {
        // Set default auction delete delay (minutes)
        const ms = parseDuration(rawDuration);
        if (isNaN(ms) || ms <= 0) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Could not parse delete duration. Use `10h30m`, `45m`, `2h`, etc.') ],
            ephemeral: true
          });
        }
        const minutes = Math.floor(ms / 60000);
        gameCfg.defaultAuctionDelete = minutes;
        await sendMessageToConfiguredChannels(
          interaction,
          `🔧 Auction delete timer for **${gameCfg.name}** updated to **${minutes}** minutes.`,
          'auction',
          gameKey
        );

      } else if (action === 'mode') {
        // Set auction mode: 'currency' or 'dkp'
        if (!['currency', 'dkp'].includes(modeChoice)) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Invalid mode. Choose either `currency` or `dkp`.') ],
            ephemeral: true
          });
        }
        gameCfg.auctionMode = modeChoice;
        await sendMessageToConfiguredChannels(
          interaction,
          `🔧 Auction mode for **${gameCfg.name}** defined as **${modeChoice}**.`,
          'auction',
          gameKey
        );

      } else {
        return interaction.reply({
          embeds: [ createErrorEmbed('Unknown auction action.') ],
          ephemeral: true
        });
      }
      break;
    }

    // ---- GAME MANAGEMENT ----
    case 'game': {
      const action   = interaction.options.getString('action');
      const key      = interaction.options.getString('key')?.toLowerCase();
      const name     = interaction.options.getString('name');
      const currency = interaction.options.getString('currency');

      if (action === 'add') {
        if (!key || !name || !currency) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Key, name and currency are required to add a game.') ],
            ephemeral: true
          });
        }
        cfg.games.push({
          key,
          name,
          roles: { admin: [], mod: [], user: [] },
          channels: { log: null, reminder: null, auction: null },
          dkpParameters: [],
          minimumPoints: 0,
          eventTimer: 10,
          defaultAuctionDuration: 960, // 16h
          currency: { name: currency, total: 0 },
          totalDkp: 0,
          reminders: [],
          reminderIntervals: []
        });
      }
      else if (action === 'remove') {
        if (!key) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Key is required to remove a game.') ],
            ephemeral: true
          });
        }
        cfg.games = cfg.games.filter(g => g.key !== key);
      }
      else if (action === 'rename') {
        if (!key || !name) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Key and new name are required to rename a game.') ],
            ephemeral: true
          });
        }
        const target = cfg.games.find(g => g.key === key);
        if (target) target.name = name;
      }
      break;
    }

    // ---- GUILD NAME ----
    case 'guildname': {
      const nameVal = interaction.options.getString('name');
      cfg.guildName = nameVal;
      break;
    }

    default:
      return interaction.reply({
        embeds: [ createErrorEmbed('Unknown config subcommand.') ],
        ephemeral: true
      });
  }

  // Salvar config e invalidar cache
  await cfg.save();
  invalidateGuildConfig(guildId);

  // Se for subcomando que afeta um jogo, atualiza todos os caches relevantes
  if (needsGame) {
    await Promise.all([
      refreshDkpParametersCache(guildId, gameKey),
      refreshDkpMinimumCache(guildId, gameKey),
      refreshEventTimerCache(guildId, gameKey),
      refreshCurrencyCache(guildId, gameKey),
      refreshChannelsCache(guildId, gameKey),
      refreshRoleConfigCache(guildId, gameKey),
      refreshItemCache(guildId, gameKey),
      refreshCategoryCache(guildId, gameKey),
      refreshGuildConfigCache(guildId)
    ]);
  }

  return interaction.reply({
    embeds: [ createInfoEmbed('Configuration Updated', 'Settings saved successfully.') ],
    ephemeral: true
  });
}

module.exports = { handleConfigCommands };
