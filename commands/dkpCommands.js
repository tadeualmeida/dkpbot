const { getGuildCache, getDkpPointsFromCache, updateDkpTotal } = require('../utils/cacheManagement');
const { createDkpBalanceEmbed, createMultipleResultsEmbed } = require('../utils/embeds');
const Dkp = require('../schema/Dkp');
const validator = require('validator');

async function handleDkpCommands(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const userDkp = await getDkpPointsFromCache(guildId, userId);

    switch (interaction.commandName) {
        case 'dkp':
            await interaction.reply({ embeds: [createDkpBalanceEmbed(userDkp)], ephemeral: true });
            break;
        case 'dkpadd':
        case 'dkpremove':
            await handleDkpAddRemove(interaction, guildId, interaction.commandName === 'dkpadd');
            break;
        case 'rank':
            await handleDkpRank(interaction, guildId);
            break;
    }
}

async function handleDkpAddRemove(interaction, guildId, isAdd) {
    const pointsToModify = interaction.options.getInteger('points');
    const userIDsInput = interaction.options.getString('users');
    const executingUser = validator.escape(interaction.user.username);

    if (!userIDsInput) {
        await interaction.reply({ content: "You must specify at least one user ID.", ephemeral: true });
        return;
    }

    const userIDs = userIDsInput.split(/[\s,]+/).filter(id => id);
    let descriptions = [];
    let totalPointsModified = 0;

    const bulkOperations = [];

    for (let userID of userIDs) {
        userID = userID.trim().replace(/<@|>/g, '');
        try {
            let userToModify;
            if (!userID.match(/^\d+$/)) {
                userToModify = interaction.guild.members.cache.find(member => validator.escape(member.user.username) === validator.escape(userID));
                if (!userToModify) {
                    descriptions.push(`User ${validator.escape(userID)} not found.`);
                    continue;
                }
                userID = userToModify.user.id;
            } else {
                userToModify = await interaction.client.users.fetch(userID);
            }
            let pointChange = isAdd ? pointsToModify : -pointsToModify;
            const cacheKey = `${guildId}_${userID}`;
            let userDkp = await getDkpPointsFromCache(guildId, userID) || await Dkp.create({ userId: userID, guildId: guildId, points: 0 });
            if (!isAdd && userDkp.points + pointChange < 0) {
                pointChange = -userDkp.points;
            }

            bulkOperations.push({
                updateOne: {
                    filter: { userId: userID, guildId: guildId },
                    update: {
                        $inc: { points: pointChange },
                        $push: { transactions: { type: isAdd ? 'add' : 'remove', amount: pointChange, description: `${executingUser} ${isAdd ? 'added' : 'removed'} points` } }
                    },
                    upsert: true
                }
            });

            userDkp.points += pointChange;
            guildCaches.get(guildId).set(cacheKey, userDkp);
            totalPointsModified += pointChange;

            descriptions.push(`${pointChange > 0 ? 'Added' : 'Removed'} **${Math.abs(pointChange)}** points to <@${userID}>. Now have **${userDkp.points}** points.`);
        } catch (error) {
            console.error(`Failed to modify points for user ID ${userID} due to an error:`, error);
            descriptions.push(`Failed to modify points for user ID <@${userID}> due to an error.`);
        }
    }

    if (bulkOperations.length > 0) {
        await Dkp.bulkWrite(bulkOperations);
        await updateDkpTotal(guildId, totalPointsModified);
    }

    const resultsEmbed = createMultipleResultsEmbed('info', 'DKP Modification Results', descriptions);
    await interaction.reply({ embeds: [resultsEmbed], ephemeral: true });
}

async function handleDkpRank(interaction, guildId) {
    try {
        const dkpPoints = await Dkp.find({ guildId }).sort({ points: -1 }).limit(50).exec();
        const descriptions = dkpPoints.map((dkp, index) => `${index + 1}. <@${dkp.userId}> - ${dkp.points} points`);
        const resultsEmbed = createMultipleResultsEmbed('info', 'DKP Ranking', descriptions);
        await interaction.reply({ embeds: [resultsEmbed], ephemeral: true });
    } catch (error) {
        console.error('Failed to retrieve DKP rankings:', error);
        await interaction.reply({ content: 'Failed to retrieve DKP rankings due to an error.', ephemeral: true });
    }
}

module.exports = { handleDkpCommands };
