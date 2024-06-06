const { handleInteractionCreate } = require('./interactionCreate');
const { registerCommands } = require('../utils/registerCommands');
const { refreshDkpParametersCache, clearCache, refreshDkpPointsCache, refreshDkpMinimumCache, refreshCrowCache } = require('../utils/cacheManagement');
const { clearEmptyEvents } = require('../utils/clearEmptyEvents');
const { checkForOrphanedGuilds, scheduleGuildDeletion, cancelScheduledGuildDeletion } = require('../utils/guildManagement');

function setupEventHandlers(client) {
    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        clearEmptyEvents(); // Limpa os eventos vazios ao iniciar
        for (const guild of client.guilds.cache.values()) {
            clearCache(guild.id); // Limpa o cache ao iniciar
            await refreshDkpParametersCache(guild.id); // Atualiza o cache ao iniciar
            await refreshDkpPointsCache(guild.id); // Atualiza o cache de pontos DKP ao iniciar
            await refreshDkpMinimumCache(guild.id); // Atualiza o cache do mínimo de DKP
            await refreshCrowCache(guild.id); // Atualiza o cache de crows ao iniciar
            await registerCommands(guild.id); // Registra comandos para a guilda
        }

        await checkForOrphanedGuilds(client); // Verifica guildas órfãs após iterar pelas guildas conectadas
    });

    client.on('guildCreate', async guild => {
        console.log(`Joined new guild: ${guild.id}`);
        cancelScheduledGuildDeletion(guild.id); // Cancela a exclusão se o bot reentrar na guilda
        clearCache(guild.id); // Limpa o cache ao entrar em uma nova guilda
        await refreshDkpParametersCache(guild.id); // Atualiza o cache ao entrar em uma nova guilda
        await refreshDkpPointsCache(guild.id); // Atualiza o cache de pontos DKP ao entrar em uma nova guilda
        await refreshDkpMinimumCache(guild.id); // Atualiza o cache do mínimo de DKP
        await refreshCrowCache(guild.id); // Atualiza o cache de crows ao entrar em uma nova guilda
        await registerCommands(guild.id); // Registra comandos para a nova guilda
    });

    client.on('guildDelete', async guild => {
        console.log(`Left guild: ${guild.id}`);
        await scheduleGuildDeletion(guild.id); // Agenda a exclusão da guilda
    });

    client.on('interactionCreate', handleInteractionCreate);
}

module.exports = setupEventHandlers;
