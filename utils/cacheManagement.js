// cacheManagement.js

const NodeCache = require('node-cache');
const DkpParameter = require('../schema/DkParameter');
const { Dkp } = require('../schema/Dkp');
const DkpMinimum = require('../schema/DkpMinimum');
const GuildBank = require('../schema/GuildBank');
const ChannelConfig = require('../schema/ChannelConfig');
const EventTimer = require('../schema/EventTimer');
const RoleConfig = require('../schema/RoleConfig');
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
        const cacheValue = transformFn ? transformFn(results) : (results[0] ? results[0][cacheKey] : defaultValue);
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
            const result = await model.findOne({ guildId });
            cacheValue = result ? result[cacheKey] : defaultValue;
            guildCache.set(cacheKey, cacheValue);
        } catch (error) {
            console.error(`Error getting ${cacheKey} from cache for guild ${guildId}:`, error);
            return defaultValue;
        }
    }
    return cacheValue;
}

async function refreshDkpParametersCache(guildId) {
    await refreshCache(guildId, DkpParameter, 'dkpParameters', [], params => {
        const guildCache = getGuildCache(guildId);
        params.forEach(param => {
            if (param.name && param.points != null) {
                guildCache.set(`dkpParameter:${param.name}`, param);
            }
        });
        return params;
    });
}

async function getDkpParameterFromCache(guildId, paramName) {
    const guildCache = getGuildCache(guildId);
    let parameter = guildCache.get(`dkpParameter:${paramName}`);
    if (!parameter) {
        try {
            parameter = await DkpParameter.findOne({ guildId, name: paramName });
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
    await refreshCache(guildId, DkpMinimum, 'dkpMinimum', 0, results => {
        return results.length ? results[0].minimumPoints : 0;
    });
}

async function getDkpMinimumFromCache(guildId) {
    return await getFromCache(guildId, 'dkpMinimum', DkpMinimum, 0);
}

async function refreshEventTimerCache(guildId) {
    await refreshCache(guildId, EventTimer, 'eventTimer', 10, results => {
        return results.length ? results[0].EventTimer : 10;
    });
}

async function getEventTimerFromCache(guildId) {
    return await getFromCache(guildId, 'eventTimer', EventTimer, 10);
}

async function refreshEligibleUsersCache(guildId) {
    const minimumDkpRecord = await DkpMinimum.findOne({ guildId });
    const minimumDkp = minimumDkpRecord ? minimumDkpRecord.minimumPoints : 0;
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

// Funções adicionais para gerenciar o cache de pontos DKP dos usuários
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
    await refreshCache(guildId, GuildBank, 'crows', 0);
}

async function getCrowsFromCache(guildId) {
    return await getFromCache(guildId, 'crows', GuildBank, 0);
}

async function getChannelsFromCache(guildId) {
    return await getFromCache(guildId, 'channels', ChannelConfig, []);
}

// Funções para gerenciamento de participantes de eventos
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

// Funções para gerenciamento de eventos ativos
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

// Funções para gerenciamento de ranking
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

// Funções para gerenciamento de configurações de função
async function refreshRoleConfigCache(guildId) {
    await refreshCache(guildId, RoleConfig, 'roleConfig', [], configs => {
        const guildCache = getGuildCache(guildId);
        configs.forEach(config => {
            guildCache.set(`roleConfig:${config.commandGroup}`, config);
        });
        return configs;
    });
}

async function getRoleConfigFromCache(guildId) {
    const guildCache = getGuildCache(guildId);
    let roleConfig = guildCache.get('roleConfig');
    if (!roleConfig) {
        await refreshRoleConfigCache(guildId);
        roleConfig = guildCache.get('roleConfig');
    }
    return roleConfig;
}

async function refreshGuildConfigCache(guildId) {
    await refreshCache(guildId, GuildConfig, 'guildConfig', {}, results => {
        return results.length ? results[0] : {};
    });
}

async function getGuildConfigFromCache(guildId) {
    return await getFromCache(guildId, 'guildConfig', GuildConfig, {});
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
