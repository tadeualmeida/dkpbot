const { checkRolePermission } = require('../utils/permissions');
const { executeCommand } = require('../commands/executeCommand');
const { getGuildCache } = require('../utils/cacheManagement');
const Event = require('../schema/Event');

async function handleInteractionCreate(interaction) {
    if (interaction.isAutocomplete()) {
        const guildId = interaction.guildId;
        const search = interaction.options.getFocused(true).value.toLowerCase();
        const subcommand = interaction.options.getSubcommand();
        const focusedName = interaction.options.getFocused(true).name;

        switch (interaction.commandName) {
            case 'event':
                if (subcommand === 'start' && focusedName === 'parameter') {
                    await handleParameterAutocomplete(interaction, guildId, search);
                } else if ((subcommand === 'end' || subcommand === 'cancel') && focusedName === 'code') {
                    await handleEventCodeAutocomplete(interaction, guildId, search);
                }
                break;
            case 'config':
                if (subcommand === 'dkp' && focusedName === 'name') {
                    await handleDkpParameterAutocomplete(interaction, guildId, search);
                }
                break;
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (!await checkRolePermission(interaction, interaction.commandName)) {
        return;
    }

    await executeCommand(interaction);
}

async function handleParameterAutocomplete(interaction, guildId, search) {
    const guildCache = getGuildCache(guildId);
    if (!guildCache) {
        await interaction.respond([]);
        return;
    }
    const allParameters = guildCache.keys()
        .filter(key => key.startsWith('dkpParameter:') && key.toLowerCase().includes(search))
        .map(key => key.replace('dkpParameter:', ''));
    const choices = allParameters.map(name => ({ name, value: name }));
    await interaction.respond(choices.slice(0, 25));  // Respond with up to 25 suggestions
}

async function handleEventCodeAutocomplete(interaction, guildId, search) {
    const activeEvents = await Event.find({ guildId, isActive: true }).lean().exec();
    const matchingEvents = activeEvents.filter(event => event.code.toLowerCase().includes(search));
    const choices = matchingEvents.map(event => ({ name: event.code, value: event.code }));
    await interaction.respond(choices.slice(0, 25));  // Respond with up to 25 suggestions
}

async function handleDkpParameterAutocomplete(interaction, guildId, search) {
    const guildCache = getGuildCache(guildId);
    if (!guildCache) {
        await interaction.respond([]);
        return;
    }
    const allParameters = guildCache.keys()
        .filter(key => key.startsWith('dkpParameter:') && key.toLowerCase().includes(search))
        .map(key => key.replace('dkpParameter:', ''));
    const choices = allParameters.map(name => ({ name, value: name }));
    await interaction.respond(choices.slice(0, 25));  // Respond with up to 25 suggestions
}

module.exports = { handleInteractionCreate };
