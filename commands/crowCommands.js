const { createCrowUpdateEmbed, createCrowBalanceEmbed } = require('../utils/embeds');
const { addCrows, removeCrows, getCrows } = require('../utils/crowManager');
const { DkpTotal } = require('../schema/Dkp');
const validator = require('validator');

async function handleCrowCommands(interaction) {
    const guildId = interaction.guildId;
    await interaction.deferReply({ ephemeral: true });

    switch (interaction.commandName) {
        case 'addcrow':
            let amountToAdd = interaction.options.getInteger('amount');
            if (!validator.isInt(amountToAdd.toString(), { min: 1 })) {
                await interaction.editReply({ content: "The amount must be a positive integer.", ephemeral: true });
                return;
            }
            try {
                const addedCrows = await addCrows(guildId, parseInt(amountToAdd));
                await interaction.editReply({ embeds: [createCrowUpdateEmbed(amountToAdd, addedCrows.crows)] });
            } catch (error) {
                console.error('Error adding crows:', error);
                await interaction.editReply({ content: "Failed to add crows due to an internal error.", ephemeral: true });
            }
            break;
        case 'removecrow':
            let amountToRemove = interaction.options.getInteger('amount');
            if (!validator.isInt(amountToRemove.toString(), { min: 1 })) {
                await interaction.editReply({ content: "The amount must be a positive integer.", ephemeral: true });
                return;
            }
            try {
                const removedCrows = await removeCrows(guildId, parseInt(amountToRemove));
                if (removedCrows.crows < 0) {
                    await interaction.editReply({ content: "Insufficient crows in the bank.", ephemeral: true });
                    return;
                }
                await interaction.editReply({ embeds: [createCrowUpdateEmbed(-amountToRemove, removedCrows.crows)] });
            } catch (error) {
                console.error('Error removing crows:', error);
                await interaction.editReply({ content: "Failed to remove crows due to an internal error.", ephemeral: true });
            }
            break;
        case 'bank':
            try {
                const crows = await getCrows(guildId);
                const totalDkpResult = await DkpTotal.findOne({ guildId: guildId });
                const totalDkp = totalDkpResult ? totalDkpResult.totalDkp : 0;
                await interaction.editReply({ embeds: [createCrowBalanceEmbed(crows, totalDkp)] });
            } catch (error) {
                console.error('Error fetching crows:', error);
                await interaction.editReply({ content: "Failed to fetch the current crow balance.", ephemeral: true });
            }
            break;
    }
}

module.exports = { handleCrowCommands };
