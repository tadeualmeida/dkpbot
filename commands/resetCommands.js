//commands/resetCommands.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Event    = require('../schema/Event');
const Dkp      = require('../schema/Dkp');
const Reminder = require('../schema/Reminder');
const GuildConfig = require('../schema/GuildConfig');
const {
  refreshDkpParametersCache,
  clearCache,
  refreshDkpPointsCache,
  refreshDkpMinimumCache,
  refreshCurrencyCache,
  refreshEventTimerCache,
  refreshEligibleUsersCache,
  refreshDkpRankingCache
} = require('../utils/cacheManagement');
const { createInfoEmbed, createErrorEmbed } = require('../utils/embeds');
const { sendMessageToConfiguredChannels }   = require('../utils/channelUtils');
const { loadGuildConfig }                  = require('../utils/config');

async function handleResetCommand(interaction) {
  const guildId = interaction.guildId;
  const gameKey = interaction.options.getString('game')?.toLowerCase();
  const cfg     = await loadGuildConfig(guildId);
  const game    = cfg.games.find(g => g.key === gameKey);

  if (!game) {
    return interaction.reply({
      embeds: [ createErrorEmbed('Unknown Game', `No config found for game **${gameKey}**.`) ],
      ephemeral: true
    });
  }

  const confirmBtn = new ButtonBuilder()
    .setCustomId('confirm_reset')
    .setLabel(`Reset ${game.name}`)
    .setStyle(ButtonStyle.Danger);
  const cancelBtn = new ButtonBuilder()
    .setCustomId('cancel_reset')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);

  await interaction.reply({
    embeds: [ createErrorEmbed(
      'Please confirm reset',
      `This will clear **all** DKP, events, reminders & currency for **${game.name}**.`
    ) ],
    components: [ new ActionRowBuilder().addComponents(confirmBtn, cancelBtn) ],
    ephemeral: true
  });

  const filter = i => i.user.id === interaction.user.id;
  const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

  collector.on('collect', async i => {
    if (i.customId === 'confirm_reset') {
      await resetGameData(guildId, gameKey);
      const done = createInfoEmbed('Reset Complete',
        `All DKP, events, reminders, and currency for **${game.name}** have been reset.`);
      // log to the game’s DKP channel
      await sendMessageToConfiguredChannels(
        interaction,
        `🗑️ Reset performed on **${game.name}** by **${interaction.member.displayName}**`,
        'dkp',
        gameKey
      );
      await i.update({ embeds: [done], components: [], ephemeral: true });
    } else {
      const cancelled = createInfoEmbed('Reset Cancelled', 'No changes made.');
      await i.update({ embeds: [cancelled], components: [], ephemeral: true });
    }
  });

  collector.on('end', collected => {
    if (collected.size === 0) {
      const timeout = createInfoEmbed('Reset Timeout', 'No action taken.');
      interaction.editReply({ embeds: [timeout], components: [], ephemeral: true });
    }
  });
}

async function resetGameData(guildId, gameKey) {
  // 1) Remove only that game's docs
  await Promise.all([
    Dkp.deleteMany({ guildId, gameKey }),
    Event.deleteMany({ guildId, gameKey }),
    Reminder.deleteMany({ guildId, gameKey })
  ]);

  // 2) Zero out that game’s currency & totalDkp
  const cfg = await GuildConfig.findOne({ guildId });
  if (cfg) {
    const g = cfg.games.find(x => x.key === gameKey);
    if (g) {
      g.currency.total = 0;
      g.totalDkp       = 0;
      await cfg.save();
    }
  }

  // 3) Clear caches just for that game
  clearCache(guildId);
  await Promise.all([
    refreshDkpParametersCache(guildId, gameKey),
    refreshDkpPointsCache(guildId, gameKey),
    refreshDkpMinimumCache(guildId, gameKey),
    refreshCurrencyCache(guildId, gameKey),
    refreshEventTimerCache(guildId, gameKey),
    refreshEligibleUsersCache(guildId, gameKey),
    refreshDkpRankingCache(guildId, gameKey)
  ]);
}

module.exports = { handleResetCommand };
