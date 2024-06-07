// setupEventHandlers.js

const { handleInteractionCreate } = require('./interactionCreate');
const { registerCommands } = require('../utils/registerCommands');
const { 
    refreshDkpParametersCache, 
    clearCache, 
    refreshDkpPointsCache, 
    refreshDkpMinimumCache, 
    refreshCrowCache, 
    refreshEventTimerCache 
} = require('../utils/cacheManagement');
const { clearEmptyEvents } = require('../utils/clearEmptyEvents');
const { 
    checkForOrphanedGuilds, 
    scheduleGuildDeletion, 
    cancelScheduledGuildDeletion 
} = require('../utils/guildManagement');

function setupEventHandlers(client) {
    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        clearEmptyEvents(); // Limpa os eventos vazios ao iniciar

        for (const guild of client.guilds.cache.values()) {
            clearCache(guild.id); // Limpa o cache ao iniciar
            try {
                await Promise.all([
                    refreshDkpParametersCache(guild.id), // Atualiza o cache de parâmetros DKP ao iniciar
                    refreshDkpPointsCache(guild.id), // Atualiza o cache de pontos DKP ao iniciar
                    refreshDkpMinimumCache(guild.id), // Atualiza o cache do mínimo de DKP
                    refreshCrowCache(guild.id), // Atualiza o cache de crows ao iniciar
                    refreshEventTimerCache(guild.id), // Atualiza o cache do timer de eventos ao iniciar
                    registerCommands(guild.id) // Registra comandos para a guilda
                ]);
                console.log(`Todos os caches foram atualizados corretamente para a guilda ${guild.id}`);
            } catch (error) {
                console.error(`Erro ao atualizar os caches para a guilda ${guild.id}:`, error);
            }
        }

        await checkForOrphanedGuilds(client); // Verifica guildas órfãs após iterar pelas guildas conectadas
    });

    client.on('guildCreate', async guild => {
        console.log(`Joined new guild: ${guild.id}`);
        cancelScheduledGuildDeletion(guild.id); // Cancela a exclusão se o bot reentrar na guilda
        clearCache(guild.id); // Limpa o cache ao entrar em uma nova guilda

        try {
            await Promise.all([
                refreshDkpParametersCache(guild.id), // Atualiza o cache ao entrar em uma nova guilda
                refreshDkpPointsCache(guild.id), // Atualiza o cache de pontos DKP ao entrar em uma nova guilda
                refreshDkpMinimumCache(guild.id), // Atualiza o cache do mínimo de DKP
                refreshCrowCache(guild.id), // Atualiza o cache de crows ao entrar em uma nova guilda
                refreshEventTimerCache(guild.id), // Atualiza o cache do timer de eventos ao entrar em uma nova guilda
                registerCommands(guild.id) // Registra comandos para a nova guilda
            ]);
            console.log(`Todos os caches foram atualizados corretamente para a nova guilda ${guild.id}`);
        } catch (error) {
            console.error(`Erro ao atualizar os caches para a nova guilda ${guild.id}:`, error);
        }
    });

    client.on('guildDelete', async guild => {
        console.log(`Left guild: ${guild.id}`);
        await scheduleGuildDeletion(guild.id); // Agenda a exclusão da guilda
    });

    client.on('interactionCreate', handleInteractionCreate);
}

module.exports = setupEventHandlers;
