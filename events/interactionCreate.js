const { checkRolePermission } = require('../utils/permissions');
const { executeCommand } = require('../commands/executeCommand');
const { getDkpParameterFromCache, getGuildCache, ParameterCache } = require('../utils/cacheManagement');
const Event = require('../schema/Event');  // Certifique-se de que o caminho está correto

async function handleInteractionCreate(interaction) {
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'event') {
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'start' && interaction.options.getFocused(true).name === 'parameter') {
                const guildId = interaction.guildId;
                const search = interaction.options.getFocused(true).value.toLowerCase();
                const guildCache = getGuildCache(guildId); 
                if (!guildCache) {
                    await interaction.respond([]);
                    return;
                }
                const allParameters = guildCache.keys().filter(key => key.toLowerCase().includes(search) && key.startsWith('dkpParameter:')).map(key => key.replace('dkpParameter:', ''));
                const choices = allParameters.map(name => ({ name, value: name }));
                await interaction.respond(choices.slice(0, 25));  // Responde com até 25 sugestões
                return;
            } else if (subcommand === 'end' && interaction.options.getFocused(true).name === 'code') {
                const guildId = interaction.guildId;
                const search = interaction.options.getFocused(true).value.toLowerCase();
                const activeEvents = await Event.find({ guildId: guildId, isActive: true });
                const matchingEvents = activeEvents.filter(event => event.code.toLowerCase().includes(search));
                const choices = matchingEvents.map(event => ({ name: event.code, value: event.code }));
                await interaction.respond(choices.slice(0, 25));  // Responde com até 25 sugestões
                return;
            }
        }
    }

    if (!interaction.isChatInputCommand()) return;

    if (!await checkRolePermission(interaction, interaction.commandName)) {
        return;
    }

    await executeCommand(interaction);
}

module.exports = { handleInteractionCreate };
