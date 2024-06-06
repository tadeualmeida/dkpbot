// crowManager.js

const GuildBank = require('../schema/GuildBank');
const { refreshCrowCache } = require('./cacheManagement');

async function updateCrowCacheAndReturnGuildBank(guildId, updateQuery) {
    const guildBank = await GuildBank.findOneAndUpdate(
        { guildId },
        updateQuery,
        { new: true, upsert: true }
    );

    if (!guildBank) {
        throw new Error('Insufficient crows in the bank.');
    }

    await refreshCrowCache(guildId);
    return guildBank;
}

async function modifyCrows(guildId, amount) {
    if (amount >= 0) {
        return await updateCrowCacheAndReturnGuildBank(guildId, { $inc: { crows: amount } });
    } else {
        const guildBank = await GuildBank.findOneAndUpdate(
            { guildId, crows: { $gte: -amount } },
            { $inc: { crows: amount } },
            { new: true }
        );

        if (!guildBank) {
            throw new Error('Insufficient crows in the bank.');
        }

        await refreshCrowCache(guildId);
        return guildBank;
    }
}

async function getCrows(guildId) {
    const guildBank = await GuildBank.findOne({ guildId });
    return guildBank ? guildBank.crows : 0;
}

module.exports = { modifyCrows, getCrows };
