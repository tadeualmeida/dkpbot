// setupEventHandlers.js

const { handleInteractionCreate } = require('./interactionCreate');
const { registerCommands } = require('../utils/registerCommands');
const { 
    refreshDkpParametersCache, 
    clearCache, 
    refreshDkpPointsCache, 
    refreshDkpMinimumCache, 
    refreshCrowCache, 
    refreshEventTimerCache,
    refreshEligibleUsersCache,
    refreshDkpRankingCache,
    refreshRoleConfigCache // Adicionado refreshRoleConfigCache
} = require('../utils/cacheManagement');
const { clearEmptyEvents } = require('../utils/clearEmptyEvents');
const { 
    checkForOrphanedGuilds, 
    scheduleGuildDeletion, 
    cancelScheduledGuildDeletion 
} = require('../utils/guildManagement');

async function refreshAllCaches(guildId) {
    console.log(`Refreshing all caches for guild: ${guildId}`);
    await Promise.all([
        refreshDkpParametersCache(guildId), 
        refreshDkpPointsCache(guildId), 
        refreshDkpMinimumCache(guildId), 
        refreshCrowCache(guildId), 
        refreshEventTimerCache(guildId), 
        refreshEligibleUsersCache(guildId),
        refreshDkpRankingCache(guildId),
        refreshRoleConfigCache(guildId) // Adicionado refreshRoleConfigCache
    ]);
    console.log(`All caches refreshed for guild: ${guildId}`);
}

function setupEventHandlers(client) {
    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        clearEmptyEvents();

        for (const guild of client.guilds.cache.values()) {
            clearCache(guild.id);
            try {
                await refreshAllCaches(guild.id);
                await registerCommands(guild.id);
                console.log(`Todos os caches foram atualizados corretamente para a guilda ${guild.id}`);
            } catch (error) {
                console.error(`Erro ao atualizar os caches para a guilda ${guild.id}:`, error);
            }
        }

        await checkForOrphanedGuilds(client);
    });

    client.on('guildCreate', async guild => {
        console.log(`Joined new guild: ${guild.id}`);
        cancelScheduledGuildDeletion(guild.id);
        clearCache(guild.id);

        try {
            await refreshAllCaches(guild.id);
            await registerCommands(guild.id);
            console.log(`Todos os caches foram atualizados corretamente para a nova guilda ${guild.id}`);
        } catch (error) {
            console.error(`Erro ao atualizar os caches para a nova guilda ${guild.id}:`, error);
        }
    });

    client.on('guildDelete', async guild => {
        console.log(`Left guild: ${guild.id}`);
        await scheduleGuildDeletion(guild.id);
    });

    client.on('interactionCreate', handleInteractionCreate);
}

module.exports = setupEventHandlers;
