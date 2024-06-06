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

async function refreshDkpParametersCache(guildId) {
    try {
        const parameters = await DkpParameter.find({ guildId });
        const guildCache = getGuildCache(guildId);
        guildCache.flushAll();
        parameters.forEach(param => {
            if (param.name && param.points != null) {
                guildCache.set(`dkpParameter:${param.name}`, param);
            }
        });
        console.log(`Cache de parâmetros DKP atualizado para a guilda ${guildId}.`);
    } catch (error) {
        console.error(`Erro ao carregar parâmetros DKP no cache para a guilda ${guildId}:`, error);
    }
}

async function getDkpParameterFromCache(guildId, paramName) {
    const guildCache = getGuildCache(guildId);
    let parameter = guildCache.get(`dkpParameter:${paramName}`);
    if (!parameter) {
        parameter = await DkpParameter.findOne({ guildId, name: paramName });
        if (parameter) {
            guildCache.set(`dkpParameter:${paramName}`, parameter);
        }
    }
    return parameter;
}

async function refreshDkpMinimumCache(guildId) {
    try {
        const minimum = await DkpMinimum.findOne({ guildId });
        const guildCache = getGuildCache(guildId);
        guildCache.set('dkpMinimum', minimum ? minimum.minimumPoints : 0);
        console.log(`Cache de mínimo DKP atualizado para a guilda ${guildId}.`);
    } catch (error) {
        console.error(`Erro ao carregar mínimo DKP no cache para a guilda ${guildId}:`, error);
    }
}

async function getDkpMinimumFromCache(guildId) {
    const guildCache = getGuildCache(guildId);
    let minimum = guildCache.get('dkpMinimum');
    if (minimum === undefined) {
        const minimumRecord = await DkpMinimum.findOne({ guildId });
        minimum = minimumRecord ? minimumRecord.minimumPoints : 0;
        guildCache.set('dkpMinimum', minimum);
    }
    return minimum;
}

function clearCache(guildId) {
    const guildCache = getGuildCache(guildId);
    guildCache.flushAll();
    console.log(`Cache resetado para a guilda ${guildId}.`);
}

// Funções adicionais para gerenciar o cache de pontos DKP dos usuários
async function refreshDkpPointsCache(guildId) {
    try {
        const dkpPoints = await Dkp.find({ guildId });
        const guildCache = getGuildCache(guildId);
        dkpPoints.forEach(dkp => {
            guildCache.set(dkp.userId, dkp);
        });
        console.log(`Cache de pontos DKP atualizado para a guilda ${guildId}.`);
    } catch (error) {
        console.error(`Erro ao carregar pontos DKP no cache para a guilda ${guildId}:`, error);
    }
}

async function getDkpPointsFromCache(guildId, userId) {
    const guildCache = getGuildCache(guildId);
    let dkp = guildCache.get(userId);
    if (!dkp) {
        dkp = await Dkp.findOne({ guildId, userId });
        if (dkp) {
            guildCache.set(userId, dkp);
        }
    }
    return dkp;
}

// Função para gerenciar o cache de crows
async function refreshCrowCache(guildId) {
    try {
        const guildBank = await GuildBank.findOne({ guildId });
        const crows = guildBank ? guildBank.crows : 0;
        const guildCache = getGuildCache(guildId);
        guildCache.set('crows', crows);
        console.log(`Cache de crows atualizado para a guilda ${guildId}.`);
    } catch (error) {
        console.error(`Erro ao carregar crows no cache para a guilda ${guildId}:`, error);
    }
}

async function getCrowsFromCache(guildId) {
    const guildCache = getGuildCache(guildId);
    let crows = guildCache.get('crows');
    if (crows === undefined) {
        const guildBank = await GuildBank.findOne({ guildId });
        crows = guildBank ? guildBank.crows : 0;
        guildCache.set('crows', crows);
    }
    return crows;
}

// Função para gerenciar o cache de canais
async function getChannelsFromCache(guildId) {
    const guildCache = getGuildCache(guildId);
    let channels = guildCache.get('channels');
    if (!channels) {
        const channelConfig = await ChannelConfig.findOne({ guildId });
        channels = channelConfig ? channelConfig.channels : [];
        guildCache.set('channels', channels);
    }
    return channels;
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
