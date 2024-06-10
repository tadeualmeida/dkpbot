const { 
    getGuildCache, 
    getDkpPointsFromCache, 
    refreshDkpPointsCache, 
    getDkpMinimumFromCache, 
    getCrowsFromCache, 
    refreshEligibleUsersCache, 
    getEligibleUsersFromCache, 
    refreshDkpRankingCache, 
    getDkpRankingFromCache 
} = require('../utils/cacheManagement');
const { createDkpBalanceEmbed, createMultipleResultsEmbed, createInfoEmbed, createErrorEmbed } = require('../utils/embeds');
const { Dkp, updateDkpTotal } = require('../schema/Dkp');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');
const validator = require('validator');

async function handleDkpCommands(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const userDkp = await getDkpPointsFromCache(guildId, userId);

    switch (interaction.commandName) {
        case 'dkp':
            await handleDkpBalance(interaction, guildId, userDkp);
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

async function handleDkpBalance(interaction, guildId, userDkp) {
    const minimumDkp = await getDkpMinimumFromCache(guildId);
    const crows = await getCrowsFromCache(guildId);

    const eligibleUsers = await getEligibleUsersFromCache(guildId);
    const eligibleDkp = eligibleUsers.reduce((sum, user) => sum + user.points, 0);
    const crowsPerDkp = eligibleDkp > 0 ? (crows / eligibleDkp).toFixed(2) : '0';

    let description;
    if (minimumDkp === 0 || (userDkp && userDkp.points >= minimumDkp)) {
        const userCrows = (userDkp.points * crowsPerDkp).toFixed(2);
        description = `You have **${userDkp.points}** DKP.\n\nThe guild bank has **${crows}** crows.\n\nEstimated crows per DKP: **${crowsPerDkp}** crows\n\nCrows you are currently earning: **${userCrows}**`;
    } else {
        const pointsNeeded = minimumDkp - (userDkp ? userDkp.points : 0);
        description = `You have **${userDkp ? userDkp.points : 0}** DKP.\n\nThe guild bank has **${crows}** crows.\n\nYou are currently earning **0** crows because your DKP is below the minimum required.\n\n**Note:** The minimum DKP to earn crows is **${minimumDkp}** DKP. You need **${pointsNeeded}** more points to start earning crows.`;
    }

    const embed = createInfoEmbed('DKP Balance', description);
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleDkpAddRemove(interaction, guildId, isAdd) {
    const pointsToModify = interaction.options.getInteger('points');
    const userIDsInput = interaction.options.getString('users');
    const executingUser = validator.escape(interaction.user.username);

    if (!userIDsInput) {
        await interaction.reply({ content: "You must specify at least one user ID.", ephemeral: true });
        return;
    }

    const userIDs = [...new Set(userIDsInput.split(/[\s,]+/).filter(id => id))];
    let descriptions = [];
    let totalPointsModified = 0;

    const bulkOperations = [];
    const userIdSet = new Set();

    for (let userID of userIDs) {
        userID = userID.trim().replace(/<@|>/g, '');
        try {
            if (!userID.match(/^\d+$/)) {
                const userToModify = interaction.guild.members.cache.find(member => validator.escape(member.user.username) === validator.escape(userID));
                if (!userToModify) {
                    descriptions.push(`User ${validator.escape(userID)} not found.`);
                    continue;
                }
                userID = userToModify.user.id;
            } else {
                await interaction.client.users.fetch(userID);
            }

            if (userIdSet.has(userID)) {
                descriptions.push(`User <@${userID}> was mentioned multiple times. Ignoring duplicates.`);
                continue;
            }

            userIdSet.add(userID);
            let pointChange = isAdd ? pointsToModify : -pointsToModify;
            const cacheKey = `${guildId}_${userID}`;
            let userDkp = await getDkpPointsFromCache(guildId, userID) || await Dkp.create({ userId: userID, guildId, points: 0 });
            if (!isAdd && userDkp.points + pointChange < 0) {
                pointChange = -userDkp.points;
            }

            bulkOperations.push({
                updateOne: {
                    filter: { userId: userID, guildId },
                    update: {
                        $inc: { points: pointChange },
                        $push: { transactions: { type: isAdd ? 'add' : 'remove', amount: pointChange, description: `${executingUser} ${isAdd ? 'added' : 'removed'} points` } }
                    },
                    upsert: true
                }
            });

            userDkp.points += pointChange;
            getGuildCache(guildId).set(cacheKey, userDkp);
            totalPointsModified += pointChange;

            descriptions.push(`${pointChange > 0 ? 'Added' : 'Removed'} **${Math.abs(pointChange)}** points to <@${userID}>. Now have **${userDkp.points}** points.`);
        } catch (error) {
            console.error(`Failed to modify points for user ID ${userID} due to an error:`, error);
            descriptions.push(`Failed to modify points for user ID <@${userID}> due to an error.`);
        }
    }

    if (bulkOperations.length > 0) {
        await Dkp.bulkWrite(bulkOperations);
        await updateDkpTotal(totalPointsModified, guildId);
        await refreshDkpPointsCache(guildId);
        await refreshEligibleUsersCache(guildId);
        await refreshDkpRankingCache(guildId);
    }

    const resultsEmbed = createMultipleResultsEmbed('info', 'DKP Modification Results', descriptions);
    await interaction.reply({ embeds: [resultsEmbed], ephemeral: true });

    // Enviar mensagem para canais configurados
    const actionText = isAdd ? 'added points to' : 'removed points from';
    const executorName = interaction.member ? interaction.member.displayName : executingUser;
    const notification = descriptions.join('\n');
    await sendMessageToConfiguredChannels(interaction, `**${executorName}** ${actionText} the following users:\n${notification}`, 'dkp');
}

async function handleDkpRank(interaction, guildId) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const dkpRanking = await getDkpRankingFromCache(guildId);
        const userIds = dkpRanking.map(dkp => dkp.userId);

        const guild = await interaction.client.guilds.fetch(guildId);
        const members = await guild.members.fetch({ user: userIds });

        const userIdToNameMap = new Map();
        members.forEach(member => {
            userIdToNameMap.set(member.user.id, member.displayName);
        });

        const descriptions = dkpRanking.map((dkp, index) => {
            const userName = userIdToNameMap.get(dkp.userId) || `<@${dkp.userId}> (Name fetch failed)`;
            return `${index + 1}. **${userName}** - ${dkp.points} points`;
        });

        const resultsEmbed = createMultipleResultsEmbed('info', 'DKP Ranking - TOP 50', descriptions);
        await interaction.editReply({ embeds: [resultsEmbed] });
    } catch (error) {
        console.error('Failed to retrieve DKP rankings:', error);
        await interaction.editReply({ content: 'Failed to retrieve DKP rankings due to an error.' });
    }
}

module.exports = { handleDkpCommands };
