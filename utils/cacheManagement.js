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

        const keys = guildCache.keys().filter(key => key.startsWith('dkpParameter:'));
        keys.forEach(key => {
            if (!guildConfig.dkpParameters.some(param => `dkpParameter:${param.name}` === key)) {
                guildCache.del(key);
            }
        });
    } else {
        const keys = guildCache.keys().filter(key => key.startsWith('dkpParameter:'));
        keys.forEach(key => guildCache.del(key));
    }
}

async function getDkpParameterFromCache(guildId, paramName) {
    const guildCache = getGuildCache(guildId);
    let parameter = guildCache.get(`dkpParameter:${paramName}`);
    if (!parameter) {
        const guildConfig = await GuildConfig.findOne({ guildId });
        parameter = guildConfig ? guildConfig.dkpParameters.find(param => param.name === paramName) : null;
        if (parameter) {
            guildCache.set(`dkpParameter:${paramName}`, parameter);
        }
    }
    return parameter;
}

async function refreshDkpMinimumCache(guildId) {
    await refreshCache(guildId, GuildConfig, 'minimumPoints', 0, configs => configs[0]?.minimumPoints || 0);
}

async function getDkpMinimumFromCache(guildId) {
    return await getFromCache(guildId, 'minimumPoints', GuildConfig, 0);
}

async function refreshEventTimerCache(guildId) {
    await refreshCache(guildId, GuildConfig, 'eventTimer', 10, configs => configs[0]?.eventTimer || 10);
}

async function getEventTimerFromCache(guildId) {
    return await getFromCache(guildId, 'eventTimer', GuildConfig, 10);
}

async function refreshEligibleUsersCache(guildId) {
    const guildConfig = await GuildConfig.findOne({ guildId });
    const minimumDkp = guildConfig?.minimumPoints || 0;
    const eligibleUsers = await Dkp.find({ guildId, points: { $gte: minimumDkp } });
    getGuildCache(guildId).set('eligibleUsers', eligibleUsers);
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
    getGuildCache(guildId).flushAll();
}

async function refreshDkpPointsCache(guildId) {
    const points = await Dkp.find({ guildId });
    const guildCache = getGuildCache(guildId);
    points.forEach(dkp => {
        if (dkp.userId) {
            guildCache.set(dkp.userId, dkp);
        } else {
            console.error(`Error: userId is undefined for a DKP entry in guild ${guildId}.`);
        }
    });
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

async function refreshCrowCache(guildId) {
    await refreshCache(guildId, GuildConfig, 'crows', 0, configs => configs[0]?.crows || 0);
}

async function getCrowsFromCache(guildId) {
    return await getFromCache(guildId, 'crows', GuildConfig, 0);
}

async function getChannelsFromCache(guildId) {
    return await getFromCache(guildId, 'channels', GuildConfig, []);
}

function addParticipantToEventCache(guildId, eventCode, participant) {
    const guildCache = getGuildCache(guildId);
    const eventParticipants = guildCache.get(`event:${eventCode}`) || [];
    eventParticipants.push(participant);
    guildCache.set(`event:${eventCode}`, eventParticipants);
}

function getEventParticipantsFromCache(guildId, eventCode) {
    return getGuildCache(guildId).get(`event:${eventCode}`) || [];
}

function clearEventParticipantsCache(guildId, eventCode) {
    getGuildCache(guildId).del(`event:${eventCode}`);
}

function addActiveEventToCache(guildId, event) {
    const guildCache = getGuildCache(guildId);
    const activeEvents = guildCache.get('activeEvents') || [];
    activeEvents.push(event);
    guildCache.set('activeEvents', activeEvents);
}

function getActiveEventsFromCache(guildId) {
    return getGuildCache(guildId).get('activeEvents') || [];
}

function removeActiveEventFromCache(guildId, eventCode) {
    const guildCache = getGuildCache(guildId);
    const activeEvents = guildCache.get('activeEvents') || [];
    guildCache.set('activeEvents', activeEvents.filter(event => event.code !== eventCode));
}

async function refreshDkpRankingCache(guildId) {
    const dkpRanking = await Dkp.find({ guildId }).sort({ points: -1 }).limit(50).exec();
    getGuildCache(guildId).set('dkpRanking', dkpRanking);
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
        config[0]?.roles.forEach(role => guildCache.set(`roleConfig:${role.commandGroup}`, role));
        return config[0]?.roles || [];
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
    await refreshCache(guildId, GuildConfig, 'guildName', {}, configs => configs[0] || {});
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
