const { createCrowUpdateEmbed, createCrowBalanceEmbed, createErrorEmbed } = require('../utils/embeds');
const { modifyCrows, getCrows } = require('../utils/crowManager');
const validator = require('validator');
const { getDkpMinimumFromCache, getCrowsFromCache, refreshCrowCache, getEligibleUsersFromCache } = require('../utils/cacheManagement');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');

async function handleCrowCommands(interaction) {
    const guildId = interaction.guildId;
    await interaction.deferReply({ ephemeral: true });

    switch (interaction.commandName) {
        case 'crow':
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'add') {
                await handleModifyCrow(interaction, guildId, true);
            } else if (subcommand === 'remove') {
                await handleModifyCrow(interaction, guildId, false);
            }
            break;
        case 'bank':
            await handleBank(interaction, guildId);
            break;
    }
}

async function handleModifyCrow(interaction, guildId, isAdd) {
    const amount = interaction.options.getInteger('amount');
    if (!validator.isInt(amount.toString(), { min: 1 })) {
        await interaction.editReply({ embeds: [createErrorEmbed("The amount must be a positive integer.")] });
        return;
    }

    const amountToModify = isAdd ? amount : -amount;
    const actionText = isAdd ? 'added to' : 'removed from';

    try {
        const modifiedCrows = await modifyCrows(guildId, amountToModify);
        await refreshCrowCache(guildId); // Refresh the crow cache

        const executorName = interaction.member.displayName || interaction.user.username;
        await sendMessageToConfiguredChannels(interaction, `**${executorName}** ${actionText} the guild bank: **${Math.abs(amount)}** crows. Total crows: **${modifiedCrows.crows}**.`, 'crow');

        await interaction.editReply({ embeds: [createCrowUpdateEmbed(amountToModify, modifiedCrows.crows)] });
    } catch (error) {
        console.error(`Error ${actionText} crows:`, error);
        await interaction.editReply({ embeds: [createErrorEmbed(`Failed to ${actionText} crows due to an internal error.`)] });
    }
}

async function handleBank(interaction, guildId) {
    try {
        const crows = await getCrowsFromCache(guildId);
        const minimumDkp = await getDkpMinimumFromCache(guildId);
        const eligibleUsers = await getEligibleUsersFromCache(guildId);
        const eligibleDkp = eligibleUsers.reduce((sum, user) => sum + user.points, 0);
        const crowsPerDkp = eligibleDkp > 0 ? (crows / eligibleDkp).toFixed(2) : '0';

        let additionalDescription = '';
        if (minimumDkp > 0) {
            additionalDescription = `Minimum DKP required to be eligible to earn crows: **${minimumDkp}** DKP.`;
        }

        await interaction.editReply({ embeds: [createCrowBalanceEmbed(crows, eligibleDkp, crowsPerDkp, additionalDescription)] });
    } catch (error) {
        console.error('Error fetching crows:', error);
        await interaction.editReply({ embeds: [createErrorEmbed("Failed to fetch the current crow balance.")] });
    }
}

module.exports = { handleCrowCommands };
