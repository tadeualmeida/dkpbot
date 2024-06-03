const { handleInteractionCreate } = require('./interactionCreate');
const { registerCommands } = require('../utils/registerCommands');
const { refreshDkpParametersCache, clearCache, refreshDkpPointsCache } = require('../utils/cacheManagement');
const { clearEmptyEvents } = require('../utils/clearEmptyEvents');

function setupEventHandlers(client) {
    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}!`);
        clearEmptyEvents(); // Limpa os eventos vazios ao iniciar
        client.guilds.cache.forEach(async guild => {
            clearCache(guild.id); // Limpa o cache ao iniciar
            await refreshDkpParametersCache(guild.id); // Atualiza o cache ao iniciar
            await registerCommands(guild.id); // Registra comandos para a guilda
            await refreshDkpPointsCache(guild.id); // Atualiza o dkp points
        });
    });

    client.on('guildCreate', async guild => {
        //clearCache(guild.id); // Limpa o cache ao entrar em uma nova guilda
        await refreshDkpParametersCache(guild.id); // Atualiza o cache ao entrar em uma nova guilda
        await registerCommands(guild.id); // Registra comandos para a nova guilda
    });

    client.on('interactionCreate', handleInteractionCreate);
}

module.exports = setupEventHandlers;