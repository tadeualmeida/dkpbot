const GuildBank = require('../schema/GuildBank');
const { refreshCrowCache } = require('./cacheManagement');

async function addCrows(guildId, amount) {
    const guildBank = await GuildBank.findOneAndUpdate(
        { guildId },
        { $inc: { crows: amount } },
        { new: true, upsert: true }
    );
    await refreshCrowCache(guildId);
    return guildBank;
}

async function removeCrows(guildId, amount) {
    const guildBank = await GuildBank.findOneAndUpdate(
        { guildId, crows: { $gte: amount } },
        { $inc: { crows: -amount } },
        { new: true }
    );
    if (!guildBank) {
        throw new Error('Insufficient crows in the bank.');
    }
    await refreshCrowCache(guildId);
    return guildBank;
}

async function getCrows(guildId) {
    const guildBank = await GuildBank.findOne({ guildId });
    return guildBank ? guildBank.crows : 0;
}

module.exports = { addCrows, removeCrows, getCrows };
