const NodeCache = require("node-cache");
const DkpParameter = require('../schema/DkParameter'); // Verifique o caminho

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

module.exports = { refreshDkpParametersCache, getDkpParameterFromCache, clearCache, getGuildCache };
