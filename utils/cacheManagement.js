const NodeCache = require('node-cache');
const DkpParameter = require('../schema/DkParameter'); // Certifique-se de que o caminho está correto
const { Dkp } = require('../schema/Dkp'); // Adicione o caminho correto

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
        const parameters = await DkpParameter.find({ guildId: guildId });
        const guildCache = getGuildCache(guildId);
        guildCache.flushAll();
        parameters.forEach(param => {
            if (param.name && param.points != null) {
                guildCache.set(param.name, param);
            }
        });
        console.log(`Cache de parâmetros DKP atualizado para a guilda ${guildId}.`);
    } catch (error) {
        console.error(`Erro ao carregar parâmetros DKP no cache para a guilda ${guildId}:`, error);
    }
}

async function getDkpParameterFromCache(guildId, paramName) {
    const guildCache = getGuildCache(guildId);
    let parameter = guildCache.get(paramName);
    if (!parameter) {
        parameter = await DkpParameter.findOne({ guildId: guildId, name: paramName });
        if (parameter) {
            guildCache.set(paramName, parameter);
        }
    }
    return parameter;
}

function clearCache(guildId) {
    const guildCache = getGuildCache(guildId);
    guildCache.flushAll();
    console.log(`Cache resetado para a guilda ${guildId}.`);
}

// Funções adicionais para gerenciar o cache de pontos DKP dos usuários
async function refreshDkpPointsCache(guildId) {
    try {
        const dkpPoints = await Dkp.find({ guildId: guildId }); // Corrigido de findAll para find
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
        dkp = await Dkp.findOne({ guildId: guildId, userId: userId });
        if (dkp) {
            guildCache.set(userId, dkp);
        }
    }
    return dkp;
}

module.exports = { refreshDkpParametersCache, getDkpParameterFromCache, clearCache, getGuildCache, refreshDkpPointsCache, getDkpPointsFromCache };
