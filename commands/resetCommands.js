const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Event = require('../schema/Event');
const GuildBank = require('../schema/GuildBank');
const { Dkp, DkpTotal } = require('../schema/Dkp');
const { 
    refreshDkpParametersCache, clearCache, refreshDkpPointsCache, 
    refreshDkpMinimumCache, refreshCrowCache, refreshEventTimerCache, 
    refreshEligibleUsersCache, refreshDkpRankingCache 
} = require('../utils/cacheManagement');
const { createInfoEmbed, createErrorEmbed } = require('../utils/embeds');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');
const { replyWithError } = require('../utils/generalUtils');

async function handleResetCommand(interaction) {
    const guildId = interaction.guildId;
    const userName = interaction.member ? interaction.member.displayName : interaction.user.username;

    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_reset')
        .setLabel('Confirm')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_reset')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const embed = createErrorEmbed(
        'Reset Info',
        '**Are you sure you want to reset all DKP points, events, and crows? This action is irreversible.**'
    );

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

    collector.on('collect', async i => {
        if (i.customId === 'confirm_reset') {
            await resetGuildData(guildId);
            const resetCompleteEmbed = createInfoEmbed('Reset Complete',`All DKP points, events, and crows have been reset for this guild`);
            await sendMessageToConfiguredChannels(interaction, `All DKP points, events, and crows have been reset for this guild by **${userName}**.`, 'dkp');
            await i.update({ embeds: [resetCompleteEmbed], components: [], ephemeral: true });
        } else if (i.customId === 'cancel_reset') {
            const resetCancelledEmbed = createInfoEmbed('Reset Cancelled','The reset operation has been cancelled.');
            await i.update({ embeds: [resetCancelledEmbed], components: [], ephemeral: true });
        }
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            const timeoutEmbed = createInfoEmbed('Reset Timeout', 'Reset timed out. No action taken.');
            interaction.editReply({ embeds: [timeoutEmbed], components: [], ephemeral: true });
        }
    });
}

async function resetGuildData(guildId) {
    const resetOperations = [
        Dkp.deleteMany({ guildId }).exec(),
        Event.deleteMany({ guildId }).exec(),
        GuildBank.updateOne({ guildId }, { crows: 0 }, { upsert: true }).exec(),
        DkpTotal.updateOne({ guildId }, { totalDkp: 0 }, { upsert: true }).exec()
    ];

    await Promise.all(resetOperations);

    clearCache(guildId);
    await refreshDkpParametersCache(guildId);
    await refreshDkpPointsCache(guildId);
    await refreshDkpMinimumCache(guildId);
    await refreshCrowCache(guildId);
    await refreshEventTimerCache(guildId);
    await refreshEligibleUsersCache(guildId);
    await refreshDkpRankingCache(guildId);
}

module.exports = { handleResetCommand };
