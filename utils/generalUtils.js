// generalUtils.js

const validator = require('validator');

function isPositiveInteger(value) {
    return validator.isInt(value.toString(), { min: 1 });
}

function createBulkOperations(participants, guildId) {
    if (!Array.isArray(participants)) {
        throw new TypeError("participants must be an array");
    }
    return participants.map(participant => ({
        updateOne: {
            filter: { guildId, userId: participant.userId },
            update: {
                $inc: { points: participant.pointChange },
                $push: { transactions: { type: participant.pointChange > 0 ? 'add' : 'remove', amount: participant.pointChange, description: participant.transactionDescription } }
            },
            upsert: true
        }
    }));
}

async function fetchGuildMember(guild, userId) {
    return await guild.members.fetch(userId).catch(() => null);
}

async function fetchUserToModify(userID, interaction) {
    if (!userID.match(/^\d+$/)) {
        const userToModify = interaction.guild.members.cache.find(member => validator.escape(member.user.username) === validator.escape(userID));
        return userToModify || null;
    } else {
        return await interaction.guild.members.fetch(userID).catch(() => null);
    }
}

async function getUserDkpChanges(guildId, userID, pointsToModify, isAdd, Dkp, getDkpPointsFromCache, getGuildCache) {
    const pointChange = isAdd ? pointsToModify : -pointsToModify;
    const userDkp = await getDkpPointsFromCache(guildId, userID) || await Dkp.create({ userId: userID, guildId, points: 0 });
    if (!isAdd && userDkp.points + pointChange < 0) {
        pointChange = -userDkp.points;
    }
    userDkp.points += pointChange;
    getGuildCache(guildId).set(`${guildId}_${userID}`, userDkp);
    return { pointChange, userDkp };
}

module.exports = { isPositiveInteger, createBulkOperations, fetchGuildMember, fetchUserToModify, getUserDkpChanges };
