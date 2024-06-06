const { createCrowUpdateEmbed, createCrowBalanceEmbed } = require('../utils/embeds');
const { addCrows, removeCrows, getCrows } = require('../utils/crowManager');
const { DkpTotal, Dkp } = require('../schema/Dkp');
const validator = require('validator');
const { getDkpMinimumFromCache, getCrowsFromCache, refreshCrowCache } = require('../utils/cacheManagement');

async function handleCrowCommands(interaction) {
    const guildId = interaction.guildId;
    await interaction.deferReply({ ephemeral: true });

    switch (interaction.commandName) {
        case 'addcrow':
            await handleAddCrow(interaction, guildId);
            break;
        case 'removecrow':
            await handleRemoveCrow(interaction, guildId);
            break;
        case 'bank':
            await handleBank(interaction, guildId);
            break;
    }
}

async function handleAddCrow(interaction, guildId) {
    const amountToAdd = interaction.options.getInteger('amount');
    if (!validator.isInt(amountToAdd.toString(), { min: 1 })) {
        await interaction.editReply({ content: "The amount must be a positive integer.", ephemeral: true });
        return;
    }
    try {
        const addedCrows = await addCrows(guildId, parseInt(amountToAdd));
        await refreshCrowCache(guildId); // Refresh the crow cache
        await interaction.editReply({ embeds: [createCrowUpdateEmbed(amountToAdd, addedCrows.crows)] });
    } catch (error) {
        console.error('Error adding crows:', error);
        await interaction.editReply({ content: "Failed to add crows due to an internal error.", ephemeral: true });
    }
}

async function handleRemoveCrow(interaction, guildId) {
    const amountToRemove = interaction.options.getInteger('amount');
    if (!validator.isInt(amountToRemove.toString(), { min: 1 })) {
        await interaction.editReply({ content: "The amount must be a positive integer.", ephemeral: true });
        return;
    }
    try {
        const removedCrows = await removeCrows(guildId, parseInt(amountToRemove));
        await refreshCrowCache(guildId); // Refresh the crow cache
        await interaction.editReply({ embeds: [createCrowUpdateEmbed(-amountToRemove, removedCrows.crows)] });
    } catch (error) {
        console.error('Error removing crows:', error);
        await interaction.editReply({ content: "Failed to remove crows due to an internal error.", ephemeral: true });
    }
}

async function handleBank(interaction, guildId) {
    try {
        const crows = await getCrowsFromCache(guildId);
        const totalDkpResult = await DkpTotal.findOne({ guildId });
        const totalDkp = totalDkpResult ? totalDkpResult.totalDkp : 0;
        const minimumDkp = await getDkpMinimumFromCache(guildId);

        const eligibleUsers = await Dkp.find({ guildId, points: { $gte: minimumDkp } });
        const eligibleDkp = eligibleUsers.reduce((sum, user) => sum + user.points, 0);
        const crowsPerDkp = eligibleDkp > 0 ? (crows / eligibleDkp).toFixed(2) : '0';

        let additionalDescription = '';
        if (minimumDkp > 0) {
            additionalDescription = `Minimum DKP required to be eligible to earn crows: ${minimumDkp} DKP.`;
        }

        await interaction.editReply({ embeds: [createCrowBalanceEmbed(crows, eligibleDkp, crowsPerDkp, additionalDescription)] });
    } catch (error) {
        console.error('Error fetching crows:', error);
        await interaction.editReply({ content: "Failed to fetch the current crow balance.", ephemeral: true });
    }
}

module.exports = { handleCrowCommands };
