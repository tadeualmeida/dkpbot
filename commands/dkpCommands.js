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
const { createMultipleResultsEmbed, createInfoEmbed } = require('../utils/embeds');
const { Dkp, updateDkpTotal } = require('../schema/Dkp');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');
const validator = require('validator');
const { fetchUserToModify, getUserDkpChanges, createBulkOperations } = require('../utils/generalUtils');

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

    const description = getDescriptionForDkpBalance(minimumDkp, userDkp, crows, crowsPerDkp);
    const embed = createInfoEmbed('DKP Balance', description);
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

function getDescriptionForDkpBalance(minimumDkp, userDkp, crows, crowsPerDkp) {
    if (minimumDkp === 0 || (userDkp && userDkp.points >= minimumDkp)) {
        const userCrows = (userDkp.points * crowsPerDkp).toFixed(2);
        return `You have **${userDkp.points}** DKP.\n\nThe guild bank has **${crows}** crows.\n\nEstimated crows per DKP: **${crowsPerDkp}** crows\n\nCrows you are currently earning: **${userCrows}**`;
    } else {
        const pointsNeeded = minimumDkp - (userDkp ? userDkp.points : 0);
        return `You have **${userDkp ? userDkp.points : 0}** DKP.\n\nThe guild bank has **${crows}** crows.\n\nYou are currently earning **0** crows because your DKP is below the minimum required.\n\n**Note:** The minimum DKP to earn crows is **${minimumDkp}** DKP. You need **${pointsNeeded}** more points to start earning crows.`;
    }
}

async function handleDkpAddRemove(interaction, guildId, isAdd) {
    await interaction.deferReply({ ephemeral: true });

    const pointsToModify = interaction.options.getInteger('points');
    const userIDsInput = interaction.options.getString('users');
    const descriptionInput = interaction.options.getString('description');
    const executingUser = validator.escape(interaction.user.username);

    if (!userIDsInput) {
        await interaction.editReply({ content: "You must specify at least one user ID.", ephemeral: true });
        return;
    }

    const userIDs = [...new Set(userIDsInput.split(/[\s,]+/).filter(id => id))];
    const descriptions = await modifyDkpPoints(interaction, userIDs, guildId, pointsToModify, isAdd, descriptionInput, executingUser);

    const resultsEmbed = createMultipleResultsEmbed('info', 'DKP Modification Results', descriptions);
    await interaction.editReply({ embeds: [resultsEmbed], ephemeral: true });

    const actionText = isAdd ? 'added points to' : 'removed points from';
    const executorName = interaction.member ? interaction.member.displayName : executingUser;
    const notification = descriptions.join('\n');
    await sendMessageToConfiguredChannels(interaction, `**${executorName}** ${actionText} the following users:\n${notification}`, 'dkp');
}

async function modifyDkpPoints(interaction, userIDs, guildId, pointsToModify, isAdd, descriptionInput, executingUser) {
    const descriptions = [];
    const participants = [];
    const userIdSet = new Set();
    let totalPointsModified = 0;

    for (let userID of userIDs) {
        userID = userID.trim().replace(/<@|>/g, '');
        try {
            const userToModify = await fetchUserToModify(userID, interaction);
            if (!userToModify) {
                descriptions.push(`User ID ${userID} not found.`);
                continue;
            }
            if (userIdSet.has(userID)) {
                descriptions.push(`User ${userToModify.displayName} was mentioned multiple times. Ignoring duplicates.`);
                continue;
            }
            userIdSet.add(userID);

            const { pointChange, userDkp } = await getUserDkpChanges(guildId, userID, pointsToModify, isAdd, Dkp, getDkpPointsFromCache, getGuildCache);
            const transactionDescription = `${executingUser} ${isAdd ? 'added' : 'removed'} points${descriptionInput ? `: ${descriptionInput}` : ''}`;

            participants.push({ userId: userID, username: userToModify.displayName, pointChange, transactionDescription });
            totalPointsModified += pointChange;
            descriptions.push(`${pointChange > 0 ? 'Added' : 'Removed'} **${Math.abs(pointChange)}** points to **${userToModify.displayName}**. Now have **${userDkp.points}** points.`);
        } catch (error) {
            console.error(`Failed to modify points for user ID ${userID} due to an error:`, error);
            descriptions.push(`Failed to modify points for user ID ${userID} due to an error.`);
        }
    }

    if (participants.length > 0) {
        const bulkOperations = createBulkOperations(participants, guildId, pointsToModify, executingUser);
        await Dkp.bulkWrite(bulkOperations);
        await updateDkpTotal(totalPointsModified, guildId);
        await refreshDkpPointsCache(guildId);
        await refreshEligibleUsersCache(guildId);
        await refreshDkpRankingCache(guildId);
    }

    if (descriptionInput) {
        descriptions.push(`\nReason: **${descriptionInput}**`);
    }

    return descriptions;
}

async function handleDkpRank(interaction, guildId) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const dkpRanking = await getDkpRankingFromCache(guildId);

        if (dkpRanking.length === 0) {
            const noRankingEmbed = createInfoEmbed('No DKP Ranking', 'There is currently no DKP ranking available.');
            await interaction.editReply({ embeds: [noRankingEmbed], ephemeral: true });
            return;
        }

        const descriptions = await getDkpRankDescriptions(dkpRanking, interaction);
        const embeds = createRankEmbeds(descriptions);

        await interaction.editReply({ embeds });
    } catch (error) {
        console.error('Failed to retrieve DKP rankings:', error);
        await interaction.editReply({ content: 'Failed to retrieve DKP rankings due to an error.' });
    }
}

async function getDkpRankDescriptions(dkpRanking, interaction) {
    const userIds = dkpRanking.map(dkp => dkp.userId);
    const members = await interaction.guild.members.fetch({ user: userIds });

    const userIdToNameMap = new Map();
    members.forEach(member => {
        userIdToNameMap.set(member.user.id, member.displayName);
    });

    return dkpRanking.map((dkp, index) => {
        const userName = userIdToNameMap.get(dkp.userId) || `<@${dkp.userId}> (Name fetch failed)`;
        return `${index + 1}. **${userName}** - ${dkp.points} points`;
    });
}

function createRankEmbeds(descriptions) {
    const embeds = [];
    const chunkSize = 50;

    for (let i = 0; i < descriptions.length; i += chunkSize) {
        const chunk = descriptions.slice(i, i + chunkSize);
        const embed = createMultipleResultsEmbed('info', `DKP Ranking - ${i + 1} to ${i + chunk.length}`, chunk);
        embeds.push(embed);
    }

    return embeds;
}

module.exports = { handleDkpCommands };
