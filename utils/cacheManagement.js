const NodeCache = require('node-cache');
const DkpParameter = require('../schema/DkParameter');
const { Dkp } = require('../schema/Dkp');
const DkpMinimum = require('../schema/DkpMinimum');
const GuildBank = require('../schema/GuildBank');
const ChannelConfig = require('../schema/ChannelConfig');

// Cria caches individuais para cada guilda
const guildCaches = new Map();

function getGuildCache(guildId) {
    if (!guildCaches.has(guildId)) {
        // Cada guilda tem seu próprio cache
        guildCaches.set(guildId, new NodeCache());
    }
    return guildCaches.get(guildId);
}

async function refreshCache(guildId, model, cacheKey, defaultValue = null, transformFn = null) {
    try {
        const results = await model.find({ guildId });
        const guildCache = getGuildCache(guildId);
        const cacheValue = transformFn ? transformFn(results) : (results[0] ? results[0][cacheKey] : defaultValue);
        guildCache.set(cacheKey, cacheValue);
        console.log(`Cache de ${cacheKey} atualizado para a guilda ${guildId}.`);
    } catch (error) {
        console.error(`Erro ao carregar ${cacheKey} no cache para a guilda ${guildId}:`, error);
    }
}

async function getFromCache(guildId, cacheKey, model, defaultValue = null) {
    const guildCache = getGuildCache(guildId);
    let cacheValue = guildCache.get(cacheKey);
    if (cacheValue === undefined) {
        const result = await model.findOne({ guildId });
        cacheValue = result ? result[cacheKey] : defaultValue;
        guildCache.set(cacheKey, cacheValue);
    }
    return cacheValue;
}

async function refreshDkpParametersCache(guildId) {
    await refreshCache(guildId, DkpParameter, 'dkpParameters', [], params => {
        const guildCache = getGuildCache(guildId);
        guildCache.flushAll();
        params.forEach(param => {
            if (param.name && param.points != null) {
                guildCache.set(`dkpParameter:${param.name}`, param);
            }
        });
        return params;
    });
}

async function getDkpParameterFromCache(guildId, paramName) {
    return await getFromCache(guildId, `dkpParameter:${paramName}`, DkpParameter);
}

async function refreshDkpMinimumCache(guildId) {
    await refreshCache(guildId, DkpMinimum, 'dkpMinimum', 0);
}

async function getDkpMinimumFromCache(guildId) {
    return await getFromCache(guildId, 'dkpMinimum', DkpMinimum, 0);
}

function clearCache(guildId) {
    const guildCache = getGuildCache(guildId);
    guildCache.flushAll();
    console.log(`Cache resetado para a guilda ${guildId}.`);
}

async function refreshDkpPointsCache(guildId) {
    await refreshCache(guildId, Dkp, 'dkpPoints', [], points => {
        const guildCache = getGuildCache(guildId);
        points.forEach(dkp => {
            guildCache.set(dkp.userId, dkp);
        });
        return points;
    });
}

async function getDkpPointsFromCache(guildId, userId) {
    return await getFromCache(guildId, userId, Dkp);
}

async function refreshCrowCache(guildId) {
    await refreshCache(guildId, GuildBank, 'crows', 0);
}

async function getCrowsFromCache(guildId) {
    return await getFromCache(guildId, 'crows', GuildBank, 0);
}

async function getChannelsFromCache(guildId) {
    return await getFromCache(guildId, 'channels', ChannelConfig, []);
}

module.exports = { 
    refreshDkpParametersCache, 
    getDkpParameterFromCache, 
    clearCache, 
    getGuildCache, 
    refreshDkpPointsCache, 
    getDkpPointsFromCache, 
    refreshDkpMinimumCache, 
    getDkpMinimumFromCache,
    refreshCrowCache,
    getCrowsFromCache,
    getChannelsFromCache
};
