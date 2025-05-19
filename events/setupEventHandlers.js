//events/setupEventHandlers.js

const { handleInteractionCreate } = require('./interactionCreate');
const { registerCommands }         = require('../utils/registerCommands');
const { handleMessageCreate }      = require('./messageHandler');
const {
  getGamesFromCache,
  refreshGuildConfigCache,
  clearCache,
  refreshDkpParametersCache,
  refreshDkpPointsCache,
  refreshDkpMinimumCache,
  refreshCurrencyCache,
  refreshEventTimerCache,
  refreshEligibleUsersCache,
  refreshDkpRankingCache,
  refreshRoleConfigCache,
  refreshActiveEventsCache
} = require('../utils/cacheManagement');
const { clearEmptyEvents }         = require('../utils/clearEmptyEvents');
const {
  checkForOrphanedGuilds,
  scheduleGuildDeletion,
  cancelScheduledGuildDeletion
} = require('../utils/guildManagement');
const GuildConfig                  = require('../schema/GuildConfig');
const Reminder                     = require('../schema/Reminder');
const { scheduleReminder }         = require('../utils/reminderScheduler');

/**
 * Recarrega todas as caches (por jogo) para uma guild
 */
async function refreshAllCaches(guildId) {
  console.log(`Refreshing all caches for guild: ${guildId}`);
  await refreshGuildConfigCache(guildId);

  const games = await getGamesFromCache(guildId);
  await Promise.all(
    games.map(g => {
      const key = g.key;
      return Promise.all([
        refreshDkpParametersCache(guildId, key),
        refreshDkpPointsCache(guildId, key),
        refreshDkpMinimumCache(guildId, key),
        refreshCurrencyCache(guildId, key),
        refreshEventTimerCache(guildId, key),
        refreshEligibleUsersCache(guildId, key),
        refreshDkpRankingCache(guildId, key),
        refreshRoleConfigCache(guildId, key),
        refreshActiveEventsCache(guildId, key),
      ]);
    })
  );
  console.log(`All caches refreshed for guild: ${guildId}`);
}

/**
 * Garante que exista um documento GuildConfig
 */
async function ensureGuildConfigExists(guildId) {
  const existing = await GuildConfig.findOne({ guildId });
  if (!existing) {
    const newCfg = new GuildConfig({ guildId, guildName: 'GuildName' });
    await newCfg.save();
    console.log(`Created new GuildConfig for guild: ${guildId}`);
  }
}

/**
 * Reagenda todos os reminders persistidos no Mongo,
 * removendo imediatamente os que já expiraram.
 *
 * @param {import('discord.js').Client} client — instância do Discord.Client
 */
async function bootstrapReminders(client) {
  const now = new Date();

  // Busca **todos** os reminders
  const all = await Reminder.find({}).lean();

  for (const rem of all) {
    // Se já expirou, remove do banco
    if (rem.targetTimestamp <= now) {
      await Reminder.deleteOne({ _id: rem._id });
      console.log(`[REMINDER] Expired reminder ${rem._id} removed from DB`);
      continue;
    }

    // Senão, reagenda
    try {
      scheduleReminder(
        rem.guildId,
        rem.gameKey,
        rem.parameterName,
        rem.intervals,
        rem.targetTimestamp,
        { client, guildId: rem.guildId }
      );
      console.log(`[REMINDER] Bootstrapped reminder ${rem._id} for parameter "${rem.parameterName}"`);
    } catch (err) {
      console.error(`[REMINDER] Failed to bootstrap reminder ${rem._id}:`, err);
    }
  }
}

/**
 * Configura todos os event handlers do Discord.js
 */
function setupEventHandlers(client) {
  client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    clearEmptyEvents();

    // Inicialização por guild
    for (const g of client.guilds.cache.values()) {
      clearCache(g.id);
      try {
        await ensureGuildConfigExists(g.id);
        await refreshAllCaches(g.id);
        await registerCommands(g.id);
        console.log(`Caches updated for guild ${g.id}`);
      } catch (err) {
        console.error(`Error initializing guild ${g.id}:`, err);
      }
    }

    // Reagendar reminders persistidos
    await bootstrapReminders(client);

    // Verifica guilds órfãos
    await checkForOrphanedGuilds(client);
  });

  client.on('guildCreate', async guild => {
    console.log(`Joined new guild: ${guild.id}`);
    cancelScheduledGuildDeletion(guild.id);
    clearCache(guild.id);
    try {
      await ensureGuildConfigExists(guild.id);
      await refreshAllCaches(guild.id);
      await registerCommands(guild.id);
      console.log(`Caches updated for new guild ${guild.id}`);
    } catch (err) {
      console.error(`Error updating caches for new guild ${guild.id}:`, err);
    }
  });

  client.on('guildDelete', async guild => {
    console.log(`Left guild: ${guild.id}`);
    await scheduleGuildDeletion(guild.id);
  });

  client.on('interactionCreate', handleInteractionCreate);
  client.on('messageCreate', handleMessageCreate);
}

module.exports = setupEventHandlers;
