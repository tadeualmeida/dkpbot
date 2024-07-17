// cacheManagement.js

const NodeCache = require('node-cache');
const Dkp = require('../schema/Dkp');
const GuildConfig = require('../schema/GuildConfig');

const guildCaches = new Map();

function getGuildCache(guildId) {
    if (!guildCaches.has(guildId)) {
        guildCaches.set(guildId, new NodeCache());
    }
    return guildCaches.get(guildId);
}

async function refreshCache(guildId, model, cacheKey, defaultValue = null, transformFn = null) {
    try {
        const results = await model.find({ guildId });
        const guildCache = getGuildCache(guildId);
        const cacheValue = transformFn ? transformFn(results) : (results.length ? results : defaultValue);
        guildCache.set(cacheKey, cacheValue);
    } catch (error) {
        console.error(`Error refreshing ${cacheKey} cache for guild ${guildId}:`, error);
    }
}

async function getFromCache(guildId, cacheKey, model, defaultValue = null) {
    const guildCache = getGuildCache(guildId);
    let cacheValue = guildCache.get(cacheKey);
    if (cacheValue === undefined) {
        try {
            const results = await model.find({ guildId });
            cacheValue = results.length ? results : defaultValue;
            guildCache.set(cacheKey, cacheValue);
        } catch (error) {
            console.error(`Error getting ${cacheKey} from cache for guild ${guildId}:`, error);
            return defaultValue;
        }
    }
    return cacheValue;
}

async function refreshDkpParametersCache(guildId) {
    const guildCache = getGuildCache(guildId);
    const guildConfig = await GuildConfig.findOne({ guildId });
    
    if (guildConfig && guildConfig.dkpParameters) {
        guildConfig.dkpParameters.forEach(param => {
            guildCache.set(`dkpParameter:${param.name}`, param);
        });
        
        // Remover qualquer parâmetro DKP que não está mais presente na configuração da guilda
        const keys = guildCache.keys().filter(key => key.startsWith('dkpParameter:'));
        keys.forEach(key => {
            if (!guildConfig.dkpParameters.some(param => `dkpParameter:${param.name}` === key)) {
                guildCache.del(key);
            }
        });
    } else {
        // Limpar todos os parâmetros DKP do cache se não houver parâmetros configurados
        const keys = guildCache.keys().filter(key => key.startsWith('dkpParameter:'));
        keys.forEach(key => guildCache.del(key));
    }
}

async function getDkpParameterFromCache(guildId, paramName) {
    const guildCache = getGuildCache(guildId);
    let parameter = guildCache.get(`dkpParameter:${paramName}`);
    if (!parameter) {
        try {
            const guildConfig = await GuildConfig.findOne({ guildId });
            parameter = guildConfig ? guildConfig.dkpParameters.find(param => param.name === paramName) : null;
            if (parameter) {
                guildCache.set(`dkpParameter:${paramName}`, parameter);
            }
        } catch (error) {
            console.error(`Error getting DKP parameter ${paramName} from cache for guild ${guildId}:`, error);
            return null;
        }
    }
    return parameter;
}

async function refreshDkpMinimumCache(guildId) {
    await refreshCache(guildId, GuildConfig, 'minimumPoints', 0, configs => {
        return configs.length ? configs[0].minimumPoints : 0;
    });
}

async function getDkpMinimumFromCache(guildId) {
    return await getFromCache(guildId, 'minimumPoints', GuildConfig, 0);
}

async function refreshEventTimerCache(guildId) {
    await refreshCache(guildId, GuildConfig, 'eventTimer', 10, configs => {
        return configs.length ? configs[0].eventTimer : 10;
    });
}

async function getEventTimerFromCache(guildId) {
    return await getFromCache(guildId, 'eventTimer', GuildConfig, 10);
}

async function refreshEligibleUsersCache(guildId) {
    const guildConfig = await GuildConfig.findOne({ guildId });
    const minimumDkp = guildConfig ? guildConfig.minimumPoints : 0;
    const eligibleUsers = await Dkp.find({ guildId, points: { $gte: minimumDkp } });
    const guildCache = getGuildCache(guildId);
    guildCache.set('eligibleUsers', eligibleUsers);
}

async function getEligibleUsersFromCache(guildId) {
    const guildCache = getGuildCache(guildId);
    let eligibleUsers = guildCache.get('eligibleUsers');
    if (!eligibleUsers) {
        await refreshEligibleUsersCache(guildId);
        eligibleUsers = guildCache.get('eligibleUsers');
    }
    return eligibleUsers;
}

function clearCache(guildId) {
    const guildCache = getGuildCache(guildId);
    guildCache.flushAll();
}

async function refreshDkpPointsCache(guildId) {
    try {
        const points = await Dkp.find({ guildId });
        const guildCache = getGuildCache(guildId);
        points.forEach(dkp => {
            if (dkp.userId) {
                guildCache.set(dkp.userId, dkp);
            } else {
                console.error(`Error: userId is undefined for a DKP entry in guild ${guildId}.`);
            }
        });
    } catch (error) {
        console.error(`Error refreshing dkpPoints cache for guild ${guildId}:`, error);
    }
}

async function getDkpPointsFromCache(guildId, userId) {
    const guildCache = getGuildCache(guildId);
    let dkp = guildCache.get(userId);
    if (!dkp) {
        try {
            dkp = await Dkp.findOne({ guildId, userId });
            if (dkp) {
                guildCache.set(userId, dkp);
            }
        } catch (error) {
            console.error(`Error getting DKP points for user ${userId} from cache for guild ${guildId}:`, error);
            return null;
        }
    }
    return dkp;
}

async function refreshCrowCache(guildId) {
    await refreshCache(guildId, GuildConfig, 'crows', 0, configs => {
        return configs.length ? configs[0].crows : 0;
    });
}

async function getCrowsFromCache(guildId) {
    return await getFromCache(guildId, 'crows', GuildConfig, 0);
}

async function getChannelsFromCache(guildId) {
    return await getFromCache(guildId, 'channels', GuildConfig, []);
}

function addParticipantToEventCache(guildId, eventCode, participant) {
    const guildCache = getGuildCache(guildId);
    let eventParticipants = guildCache.get(`event:${eventCode}`);
    if (!eventParticipants) {
        eventParticipants = [];
    }
    eventParticipants.push(participant);
    guildCache.set(`event:${eventCode}`, eventParticipants);
}

function getEventParticipantsFromCache(guildId, eventCode) {
    const guildCache = getGuildCache(guildId);
    return guildCache.get(`event:${eventCode}`) || [];
}

function clearEventParticipantsCache(guildId, eventCode) {
    const guildCache = getGuildCache(guildId);
    guildCache.del(`event:${eventCode}`);
}

function addActiveEventToCache(guildId, event) {
    const guildCache = getGuildCache(guildId);
    let activeEvents = guildCache.get('activeEvents');
    if (!activeEvents) {
        activeEvents = [];
    }
    activeEvents.push(event);
    guildCache.set('activeEvents', activeEvents);
}

function getActiveEventsFromCache(guildId) {
    const guildCache = getGuildCache(guildId);
    return guildCache.get('activeEvents') || [];
}

function removeActiveEventFromCache(guildId, eventCode) {
    const guildCache = getGuildCache(guildId);
    let activeEvents = guildCache.get('activeEvents');
    if (activeEvents) {
        activeEvents = activeEvents.filter(event => event.code !== eventCode);
        guildCache.set('activeEvents', activeEvents);
    }
}

async function refreshDkpRankingCache(guildId) {
    const dkpRanking = await Dkp.find({ guildId }).sort({ points: -1 }).limit(50).exec();
    const guildCache = getGuildCache(guildId);
    guildCache.set('dkpRanking', dkpRanking);
}

async function getDkpRankingFromCache(guildId) {
    const guildCache = getGuildCache(guildId);
    let dkpRanking = guildCache.get('dkpRanking');
    if (!dkpRanking) {
        await refreshDkpRankingCache(guildId);
        dkpRanking = guildCache.get('dkpRanking');
    }
    return dkpRanking;
}

async function refreshRoleConfigCache(guildId) {
    await refreshCache(guildId, GuildConfig, 'roleConfig', [], config => {
        const guildCache = getGuildCache(guildId);
        if (config.length && config[0].roles) {
            config[0].roles.forEach(role => {
                guildCache.set(`roleConfig:${role.commandGroup}`, role);
            });
            return config[0].roles;
        }
        return [];
    });
}

async function getRoleConfigFromCache(guildId) {
    const guildCache = getGuildCache(guildId);
    let roleConfig = guildCache.get('roleConfig');
    if (!roleConfig) {
        await refreshRoleConfigCache(guildId);
        roleConfig = guildCache.get('roleConfig');
    }
    return roleConfig || [];
}

async function refreshGuildConfigCache(guildId) {
    await refreshCache(guildId, GuildConfig, 'guildName', {}, configs => {
        return configs.length ? configs[0] : {};
    });
}

async function getGuildConfigFromCache(guildId) {
    return await getFromCache(guildId, 'guildName', GuildConfig, {});
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
    getChannelsFromCache,
    refreshEventTimerCache,
    getEventTimerFromCache,
    refreshEligibleUsersCache,
    getEligibleUsersFromCache,
    addParticipantToEventCache,
    getEventParticipantsFromCache,
    clearEventParticipantsCache,
    addActiveEventToCache,
    getActiveEventsFromCache,
    removeActiveEventFromCache,
    refreshDkpRankingCache,
    getDkpRankingFromCache,
    refreshRoleConfigCache,
    getRoleConfigFromCache,
    refreshGuildConfigCache,
    getGuildConfigFromCache
};
