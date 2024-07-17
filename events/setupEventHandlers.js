// setupEventHandlers.js

const { handleInteractionCreate } = require('./interactionCreate');
const { registerCommands } = require('../utils/registerCommands');
const { handleMessageCreate } = require('./messageHandler');
const { 
    refreshDkpParametersCache, 
    clearCache, 
    refreshDkpPointsCache, 
    refreshDkpMinimumCache, 
    refreshCrowCache, 
    refreshEventTimerCache,
    refreshEligibleUsersCache,
    refreshDkpRankingCache,
    refreshRoleConfigCache,
    refreshGuildConfigCache
} = require('../utils/cacheManagement');
const { clearEmptyEvents } = require('../utils/clearEmptyEvents');
const { 
    checkForOrphanedGuilds, 
    scheduleGuildDeletion, 
    cancelScheduledGuildDeletion 
} = require('../utils/guildManagement');
const GuildConfig = require('../schema/GuildConfig');

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
        refreshRoleConfigCache(guildId),
        refreshGuildConfigCache(guildId)
    ]);
    console.log(`All caches refreshed for guild: ${guildId}`);
}

async function ensureGuildConfigExists(guildId) {
    const existingConfig = await GuildConfig.findOne({ guildId });
    if (!existingConfig) {
        const newGuildConfig = new GuildConfig({
            guildId,
            guildName: 'Default',
            eventTimer: 10,
            minimumPoints: 0,
            dkpParameters: [],
            roles: [],
            channels: [],
            totalDkp: 0,
            crows: 0
        });
        await newGuildConfig.save();
        console.log(`Created new GuildConfig for guild: ${guildId}`);
    }
}

function setupEventHandlers(client) {
    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        clearEmptyEvents();

        for (const guild of client.guilds.cache.values()) {
            clearCache(guild.id);
            try {
                await ensureGuildConfigExists(guild.id);
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
            await ensureGuildConfigExists(guild.id);
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
    client.on('messageCreate', handleMessageCreate);
}

module.exports = setupEventHandlers;
