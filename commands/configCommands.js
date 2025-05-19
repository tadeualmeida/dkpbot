//commands/configCommands.js

const { loadGuildConfig, invalidateGuildConfig } = require('../utils/config');
const {
  refreshDkpParametersCache,
  refreshDkpMinimumCache,
  refreshEventTimerCache,
  refreshCurrencyCache,
  refreshChannelsCache,
  refreshRoleConfigCache,
  refreshGuildConfigCache
} = require('../utils/cacheManagement');
const {
  createMultipleResultsEmbed,
  createInfoEmbed,
  createErrorEmbed
} = require('../utils/embeds');
const validator = require('validator');

async function handleConfigCommands(interaction) {
  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  // Load or initialize guild config
  const cfg = await loadGuildConfig(guildId);

  // Determine if this subcommand needs a game context
  const needsGame = ['role','dkp','channel','reminder','show','event'].includes(sub);
  let gameKey, gameCfg;
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

  // Dispatch by subcommand
  switch (sub) {
    // ---- ROLE ----
    case 'role': {
      const group = interaction.options.getString('commandgroup');
      const role  = interaction.options.getRole('role');
      gameCfg.roles[group] = [role.id];
      break;
    }

    // ---- DKP ----
    case 'dkp': {
      const action = interaction.options.getString('action');
      const nameOpt = interaction.options.getString('name');
      const name = nameOpt ? validator.escape(nameOpt.toLowerCase()) : null;
      const pts  = interaction.options.getInteger('points');

      // Validation
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

      // Modify parameters
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
      // now uses “type” (log | reminder) instead of “action”
      const type    = interaction.options.getString('type');    // ‘log’ or ‘reminder’
      const channel = interaction.options.getChannel('channel');
      if (!channel) {
        return interaction.reply({
          embeds: [ createErrorEmbed('You must specify a channel.') ],
          ephemeral: true
        });
      }

      // assign to the proper field
      if (!['log','reminder'].includes(type)) {
        return interaction.reply({
          embeds: [ createErrorEmbed('Invalid channel type; must be “log” or “reminder”.') ],
          ephemeral: true
        });
      }

      gameCfg.channels[type] = channel.id;
      break;
    }

    // ---- REMINDER ----
    case 'reminder': {
      const action     = interaction.options.getString('action');      // 'add', 'remove', or 'intervals'
      const paramName  = interaction.options.getString('parameter');   // e.g. 'BOSS-XYZ'
      const intervals  = interaction.options.getString('intervals');   // e.g. '1h,30m,10m'
      let actionText;

      // ensure arrays exist
      gameCfg.reminders ||= [];
      gameCfg.reminderIntervals ||= [];

      if (action === 'add') {
        if (!paramName) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Parameter name is required to add.') ],
            ephemeral: true
          });
        }
        gameCfg.reminders.push(paramName.trim());
        actionText = 'added';
      }
      else if (action === 'remove') {
        if (!paramName) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Parameter name is required to remove.') ],
            ephemeral: true
          });
        }
        gameCfg.reminders = gameCfg.reminders.filter(p => p !== paramName.trim());
        actionText = 'removed';
      }
      else if (action === 'intervals') {
        if (!intervals) {
          return interaction.reply({
            embeds: [ createErrorEmbed('Intervals are required for this action (e.g. `1h,30m,10m`).') ],
            ephemeral: true
          });
        }
        gameCfg.reminderIntervals = intervals.split(',').map(s => s.trim());
        actionText = 'intervals set';
      } else {
        return interaction.reply({
          embeds: [ createErrorEmbed('Invalid reminder action.') ],
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
            `Log: <#${gameCfg.channels.log || 'none'}>\nReminder: <#${gameCfg.channels.reminder || 'none'}>`
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
          channels: { log: null, reminder: null },
          dkpParameters: [],
          minimumPoints: 0,
          eventTimer: 10,
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

  // Save and refresh cache
  await cfg.save();
  invalidateGuildConfig(guildId);
  await refreshGuildConfigCache(guildId);

  // If we updated a specific game, refresh its caches
  if (needsGame) {
    await Promise.all([
      refreshDkpParametersCache(guildId, gameKey),
      refreshDkpMinimumCache(guildId, gameKey),
      refreshEventTimerCache(guildId, gameKey),
      refreshCurrencyCache(guildId, gameKey),
      refreshChannelsCache(guildId, gameKey),
      refreshRoleConfigCache(guildId, gameKey)
    ]);
  }

  return interaction.reply({
    embeds: [ createInfoEmbed('Configuration Updated', 'Settings saved successfully.') ],
    ephemeral: true
  });
}

module.exports = { handleConfigCommands };
