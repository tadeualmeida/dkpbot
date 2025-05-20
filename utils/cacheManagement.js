// utils/cacheManagement.js

const NodeCache = require('node-cache');
const Dkp = require('../schema/Dkp');
const Event = require('../schema/Event');
const { loadGuildConfig } = require('./config');

// In-memory caches per guild
const guildCaches = new Map();

function getGuildCache(guildId) {
  if (!guildCaches.has(guildId)) {
    guildCaches.set(guildId, new NodeCache());
  }
  return guildCaches.get(guildId);
}

// ---- Guild configuration ----
async function refreshGuildConfigCache(guildId) {
  const cache = getGuildCache(guildId);
  const cfg = await loadGuildConfig(guildId);
  const plain = cfg.toObject ? cfg.toObject() : JSON.parse(JSON.stringify(cfg));
  cache.set('guildName', plain.guildName);
  cache.set('games', plain.games || []);
}

async function getGuildNameFromCache(guildId) {
  const cache = getGuildCache(guildId);
  let name = cache.get('guildName');
  if (name === undefined) {
    await refreshGuildConfigCache(guildId);
    name = cache.get('guildName');
  }
  return name;
}

async function getGamesFromCache(guildId) {
  const cache = getGuildCache(guildId);
  let games = cache.get('games');
  if (!games) {
    await refreshGuildConfigCache(guildId);
    games = cache.get('games');
  }
  return games;
}

// ---- DKP parameters (per-game) ----
async function refreshDkpParametersCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const cfg = await loadGuildConfig(guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  if (!game) return;
  game.dkpParameters.forEach(p => {
    cache.set(`dkpParameter:${gameKey}:${p.name}`, { name: p.name, points: p.points });
  });
  // remove stale
  cache.keys()
    .filter(k => k.startsWith(`dkpParameter:${gameKey}:`))
    .forEach(k => {
      const name = k.split(':')[2];
      if (!game.dkpParameters.some(p => p.name === name)) cache.del(k);
    });
}

async function getDkpParameterFromCache(guildId, gameKey, paramName) {
  const cache = getGuildCache(guildId);
  const key = `dkpParameter:${gameKey}:${paramName}`;
  let param = cache.get(key);
  if (!param) {
    const cfg = await loadGuildConfig(guildId);
    const game = cfg.games.find(g => g.key === gameKey);
    const found = game?.dkpParameters.find(p => p.name === paramName);
    if (found) {
      param = { name: found.name, points: found.points };
      cache.set(key, param);
    }
  }
  return param;
}

// ---- DKP minimum (per-game) ----
async function refreshDkpMinimumCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const cfg = await loadGuildConfig(guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  cache.set(`minimumPoints:${gameKey}`, game?.minimumPoints ?? 0);
}

async function getDkpMinimumFromCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const key = `minimumPoints:${gameKey}`;
  let val = cache.get(key);
  if (val === undefined) {
    await refreshDkpMinimumCache(guildId, gameKey);
    val = cache.get(key);
  }
  return val;
}

// ---- Event timer (per-game) ----
async function refreshEventTimerCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const cfg = await loadGuildConfig(guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  cache.set(`eventTimer:${gameKey}`, game?.eventTimer ?? 10);
}

async function getEventTimerFromCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const key = `eventTimer:${gameKey}`;
  let val = cache.get(key);
  if (val === undefined) {
    await refreshEventTimerCache(guildId, gameKey);
    val = cache.get(key);
  }
  return val;
}

// ---- Currency (per-game) ----
async function refreshCurrencyCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const cfg = await loadGuildConfig(guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  cache.set(`currency:${gameKey}`, game?.currency?.total ?? 0);
}

async function getCurrencyFromCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const key = `currency:${gameKey}`;
  let val = cache.get(key);
  if (val === undefined) {
    await refreshCurrencyCache(guildId, gameKey);
    val = cache.get(key);
  }
  return val;
}

// ---- Channels (per-game) ----
async function refreshChannelsCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const cfg = await loadGuildConfig(guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  cache.set(`channels:${gameKey}`, game?.channels || { log: null, reminder: null });
}

async function getChannelsFromCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const key = `channels:${gameKey}`;
  let val = cache.get(key);
  if (!val) {
    await refreshChannelsCache(guildId, gameKey);
    val = cache.get(key);
  }
  return val;
}

// ---- Eligible users (per-game) ----
async function refreshEligibleUsersCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const min = await getDkpMinimumFromCache(guildId, gameKey);
  const users = await Dkp.find({ guildId, gameKey, points: { $gte: min } });
  cache.set(`eligibleUsers:${gameKey}`, users);
}

async function getEligibleUsersFromCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const key = `eligibleUsers:${gameKey}`;
  let val = cache.get(key);
  if (!val) {
    await refreshEligibleUsersCache(guildId, gameKey);
    val = cache.get(key);
  }
  return val;
}

// ---- DKP points (per-user per-game) ----
async function refreshDkpPointsCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const entries = await Dkp.find({ guildId, gameKey });
  entries.forEach(dkp => {
    if (dkp.userId) cache.set(`dkpPoints:${gameKey}:${dkp.userId}`, dkp);
  });
}

async function getDkpPointsFromCache(guildId, gameKey, userId) {
  const cache = getGuildCache(guildId);
  const key = `dkpPoints:${gameKey}:${userId}`;
  let dkp = cache.get(key);
  if (!dkp) {
    dkp = await Dkp.findOne({ guildId, gameKey, userId });
    if (dkp) cache.set(key, dkp);
  }
  return dkp;
}

// ---- DKP ranking (per-game) ----
async function refreshDkpRankingCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const ranking = await Dkp.find({ guildId, gameKey }).sort({ points: -1 }).limit(50).lean();
  cache.set(`dkpRanking:${gameKey}`, ranking);
}

async function getDkpRankingFromCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const key = `dkpRanking:${gameKey}`;
  let val = cache.get(key);
  if (!val) {
    await refreshDkpRankingCache(guildId, gameKey);
    val = cache.get(key);
  }
  return val;
}

// ---- Role config (per-game) ----
async function refreshRoleConfigCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const cfg = await loadGuildConfig(guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  if (!game) return;
  Object.entries(game.roles).forEach(([group, ids]) => {
    ids.forEach(r => cache.set(`roleConfig:${gameKey}:${group}:${r}`, r));
  });
}

async function getRoleConfigFromCache(guildId, gameKey, group) {
  const cache = getGuildCache(guildId);
  const prefix = `roleConfig:${gameKey}:${group}:`;
  let roles = cache.keys()
    .filter(k => k.startsWith(prefix))
    .map(k => k.split(':')[3]);
  if (!roles.length) {
    await refreshRoleConfigCache(guildId, gameKey);
    roles = cache.keys()
      .filter(k => k.startsWith(prefix))
      .map(k => k.split(':')[3]);
  }
  return roles;
}

// ---- Event caching (per-game and global) ----
async function refreshActiveEventsCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  const events = await Event.find({ guildId, gameKey, isActive: true }).lean();
  cache.set(`activeEvents:${gameKey}`, events);
}

async function getActiveEventsFromCache(guildId, gameKey) {
  const cache = getGuildCache(guildId);
  if (gameKey) {
    let val = cache.get(`activeEvents:${gameKey}`);
    if (!val) {
      await refreshActiveEventsCache(guildId, gameKey);
      val = cache.get(`activeEvents:${gameKey}`);
    }
    return val;
  } else {
    const games = await getGamesFromCache(guildId);
    let all = [];
    for (const g of games) {
      let evts = cache.get(`activeEvents:${g.key}`);
      if (!evts) {
        await refreshActiveEventsCache(guildId, g.key);
        evts = cache.get(`activeEvents:${g.key}`) || [];
      }
      all.push(...evts);
    }
    return all;
  }
}

async function addParticipantToEventCache(guildId, gameKey, eventCode, participant) {
  const cache = getGuildCache(guildId);
  const key = `event:${gameKey}:${eventCode}`;
  const list = cache.get(key) || [];
  list.push(participant);
  cache.set(key, list);
}

async function getEventParticipantsFromCache(guildId, gameKey, eventCode) {
  const key = `event:${gameKey}:${eventCode}`;
  return getGuildCache(guildId).get(key) || [];
}

function clearEventParticipantsCache(guildId, gameKey, eventCode) {
  const key = `event:${gameKey}:${eventCode}`;
  getGuildCache(guildId).del(key);
}

async function removeActiveEventFromCache(guildId, gameKey, eventCode) {
  const cache = getGuildCache(guildId);
  const key = `activeEvents:${gameKey}`;
  const list = cache.get(key) || [];
  cache.set(key, list.filter(e => e.code !== eventCode));
}

function clearCache(guildId) {
  getGuildCache(guildId).flushAll();
}

module.exports = {
  getGuildCache,
  clearCache,
  refreshGuildConfigCache,
  getGuildNameFromCache,
  getGamesFromCache,
  refreshDkpParametersCache,
  getDkpParameterFromCache,
  refreshDkpMinimumCache,
  getDkpMinimumFromCache,
  refreshEventTimerCache,
  getEventTimerFromCache,
  refreshCurrencyCache,
  getCurrencyFromCache,
  refreshChannelsCache,
  getChannelsFromCache,
  refreshEligibleUsersCache,
  getEligibleUsersFromCache,
  refreshDkpPointsCache,
  getDkpPointsFromCache,
  refreshDkpRankingCache,
  getDkpRankingFromCache,
  refreshRoleConfigCache,
  getRoleConfigFromCache,
  refreshActiveEventsCache,
  getActiveEventsFromCache,
  addParticipantToEventCache,
  getEventParticipantsFromCache,
  clearEventParticipantsCache,
  removeActiveEventFromCache
};
