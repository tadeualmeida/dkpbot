// crowCommands.js

const {
    createCrowUpdateEmbed,
    createCrowBalanceEmbed,
    createErrorEmbed
} = require('../utils/embeds');
const {
    modifyCrows
} = require('../utils/crowManager');
const {
    isPositiveInteger,
    replyWithError
} = require('../utils/generalUtils');
const {
    getCrowsFromCache,
    refreshCrowCache,
    getEligibleUsersFromCache,
    getDkpMinimumFromCache
} = require('../utils/cacheManagement');
const {
    sendMessageToConfiguredChannels
} = require('../utils/channelUtils');

async function handleCrowCommands(interaction) {
    const guildId = interaction.guildId;
    await interaction.deferReply({
        ephemeral: true
    });

    const subcommand = interaction.options.getSubcommand(false);

    if (interaction.commandName === 'crow' && (subcommand === 'add' || subcommand === 'remove')) {
        await handleModifyCrow(interaction, guildId, subcommand === 'add');
    } else if (interaction.commandName === 'bank') {
        await handleBank(interaction, guildId);
    } else {
        await replyWithError(interaction, null, "Unknown or missing subcommand.");
    }
}

async function handleModifyCrow(interaction, guildId, isAdd) {
    const amount = interaction.options.getInteger('amount');

    if (!isPositiveInteger(amount)) {
        return replyWithError(interaction, null, "The amount must be a positive integer.");
    }

    const amountToModify = isAdd ? amount : -amount;
    const actionText = isAdd ? 'added to' : 'removed from';

    try {
        const modifiedCrows = await modifyCrows(guildId, amountToModify);
        await refreshCrowCache(guildId);
        await sendCrowModificationMessage(interaction, amount, modifiedCrows.crows, actionText);
        await interaction.editReply({
            embeds: [createCrowUpdateEmbed(amountToModify, modifiedCrows.crows)]
        });
    } catch (error) {
        console.error(`Error ${actionText} crows:`, error);
        await replyWithError(interaction, `Failed to ${actionText} crows due to an internal error.`, null);
    }
}

async function handleBank(interaction, guildId) {
    try {
        const [crows, minimumDkp, eligibleUsers] = await Promise.all([
            getCrowsFromCache(guildId),
            getDkpMinimumFromCache(guildId),
            getEligibleUsersFromCache(guildId)
        ]);

        const eligibleDkp = eligibleUsers.reduce((sum, user) => sum + user.points, 0);
        const crowsPerDkp = eligibleDkp > 0 ? (crows / eligibleDkp).toFixed(2) : '0';
        const additionalDescription = minimumDkp > 0 ? `Minimum DKP required to be eligible to earn crows: **${minimumDkp}** DKP.` : '';

        await interaction.editReply({
            embeds: [createCrowBalanceEmbed(crows, eligibleDkp, crowsPerDkp, additionalDescription)]
        });
    } catch (error) {
        console.error('Error fetching crows:', error);
        await replyWithError(interaction, "Failed to fetch the current crow balance.", null);
    }
}

async function sendCrowModificationMessage(interaction, amount, totalCrows, actionText) {
    const executorName = interaction.member.displayName || interaction.user.username;
    await sendMessageToConfiguredChannels(interaction, `**${executorName}** ${actionText} the guild bank: **${Math.abs(amount)}** crows. Total crows: **${totalCrows}**.`, 'crow');
}

module.exports = {
    handleCrowCommands
};
