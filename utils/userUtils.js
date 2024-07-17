// userUtils.js

const Dkp = require('../schema/Dkp');

async function getUserViolationCount(guildId, userId) {
    const guild = await Dkp.findOne({ guildId });
    if (!guild) return 0;
    
    const user = guild.users.find(user => user.userId === userId);
    return user ? user.violationCount : 0;
}

async function incrementUserViolation(guildId, userId) {
    const guild = await Dkp.findOneAndUpdate(
        { guildId, 'users.userId': userId },
        { $inc: { 'users.$.violationCount': 1 } },
        { new: true }
    );

    if (!guild) {
        await Dkp.updateOne(
            { guildId },
            { $push: { users: { userId, violationCount: 1, points: 0, transactions: [] } } },
            { upsert: true }
        );
    }
}

async function clearUserViolations(guildId, userId) {
    await Dkp.updateOne(
        { guildId, 'users.userId': userId },
        { $set: { 'users.$.violationCount': 0 } }
    );
}

async function upsertUserInGuild(guildId, userData) {
    try {
        const guild = await Dkp.findOneAndUpdate(
            { guildId, 'users.userId': userData.userId },
            { 
                $set: {
                    'users.$.points': userData.points,
                    'users.$.transactions': userData.transactions,
                    'users.$.violationCount': userData.violationCount,
                    'users.$.warningCount': userData.warningCount
                }
            },
            { new: true }
        );

        if (!guild) {
            await Dkp.updateOne(
                { guildId },
                { $push: { users: userData } },
                { upsert: true }
            );
        }
    } catch (error) {
        console.error(`Error upserting user in guild ${guildId}:`, error);
    }
}

async function getUsersInGuild(guildId) {
    try {
        const guild = await Dkp.findOne({ guildId });
        return guild ? guild.users : [];
    } catch (error) {
        console.error(`Error getting users in guild ${guildId}:`, error);
        return [];
    }
}

module.exports = {
    getUserViolationCount,
    incrementUserViolation,
    clearUserViolations,
    upsertUserInGuild,
    getUsersInGuild
};
