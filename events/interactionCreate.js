const { checkRolePermission } = require('../utils/permissions');
const { executeCommand } = require('../commands/executeCommand');
const { getGuildCache, getActiveEventsFromCache } = require('../utils/cacheManagement');

async function handleInteractionCreate(interaction) {
    if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction);
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (!await checkRolePermission(interaction, interaction.commandName)) return;

    await executeCommand(interaction);
}

async function handleAutocomplete(interaction) {
    const guildId = interaction.guildId;
    const search = interaction.options.getFocused(true).value.toLowerCase();
    const subcommand = interaction.options.getSubcommand();
    const focusedName = interaction.options.getFocused(true).name;

    if (interaction.commandName === 'event') {
        if (subcommand === 'start' && focusedName === 'parameter') {
            await handleParameterAutocomplete(interaction, guildId, search);
        } else if ((subcommand === 'end' || subcommand === 'cancel') && focusedName === 'code') {
            await handleEventCodeAutocomplete(interaction, guildId, search);
        }
    } else if (interaction.commandName === 'config') {
        const action = interaction.options.getString('action');
        if (subcommand === 'dkp' && focusedName === 'name' && (action === 'remove' || action === 'edit')) {
            await handleDkpParameterAutocomplete(interaction, guildId, search);
        }
    }
}

async function handleParameterAutocomplete(interaction, guildId, search) {
    const choices = getChoicesFromCache(guildId, 'dkpParameter:', search);
    await interaction.respond(choices);
}

async function handleEventCodeAutocomplete(interaction, guildId, search) {
    const activeEvents = getActiveEventsFromCache(guildId);
    const matchingEvents = activeEvents.filter(event => event.code.toLowerCase().includes(search));
    const choices = matchingEvents.map(event => ({ name: event.code, value: event.code }));
    await interaction.respond(choices.slice(0, 25));
}

async function handleDkpParameterAutocomplete(interaction, guildId, search) {
    const choices = getChoicesFromCache(guildId, 'dkpParameter:', search);
    await interaction.respond(choices);
}

function getChoicesFromCache(guildId, prefix, search) {
    const guildCache = getGuildCache(guildId);
    if (!guildCache) return [];
    const filteredKeys = guildCache.keys()
        .filter(key => key.startsWith(prefix) && key.toLowerCase().includes(search))
        .map(key => key.replace(prefix, ''));
    return filteredKeys.map(name => ({ name, value: name })).slice(0, 25);
}

module.exports = { handleInteractionCreate };
