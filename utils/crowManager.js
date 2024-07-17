const GuildConfig = require('../schema/GuildConfig');
const { refreshCrowCache } = require('../utils/cacheManagement');

async function updateCrowCacheAndReturnGuildConfig(guildId, updateQuery) {
    const guildConfig = await GuildConfig.findOneAndUpdate(
        { guildId },
        updateQuery,
        { new: true, upsert: true }
    );

    if (!guildConfig) {
        throw new Error('Insufficient crows in the bank.');
    }

    await refreshCrowCache(guildId);
    return guildConfig;
}

async function modifyCrows(guildId, amount) {
    if (amount >= 0) {
        return await updateCrowCacheAndReturnGuildConfig(guildId, { $inc: { crows: amount } });
    } else {
        const guildConfig = await GuildConfig.findOneAndUpdate(
            { guildId, crows: { $gte: -amount } },
            { $inc: { crows: amount } },
            { new: true }
        );

        if (!guildConfig) {
            throw new Error('Insufficient crows in the bank.');
        }

        await refreshCrowCache(guildId);
        return guildConfig;
    }
}

async function getCrows(guildId) {
    const guildConfig = await GuildConfig.findOne({ guildId });
    return guildConfig ? guildConfig.crows : 0;
}

module.exports = { modifyCrows, getCrows };
