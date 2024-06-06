const { REST, Routes } = require('discord.js');
const { dkpCommand, dkpAddCommand, dkpRemoveCommand, rankCommand } = require('../slashcommands/dkpSlash');
const { eventSlashCommand, joinCommand } = require('../slashcommands/eventSlash');
const { addCrowCommand, removeCrowCommand, bankCommand } = require('../slashcommands/crowSlash');
const { configCommand } = require('../slashcommands/configSlash');
const { resetCommand } = require('../slashcommands/resetSlash');
const { helpCommand, showHelpCommand } = require('../slashcommands/helpSlash');
const { reportSlash } = require('../slashcommands/reportSlash');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands(guildId) {
    const commands = [
        dkpCommand, dkpAddCommand, dkpRemoveCommand,
        addCrowCommand, removeCrowCommand, bankCommand,
        configCommand,
        rankCommand,
        eventSlashCommand, joinCommand,
        resetCommand,
        helpCommand, showHelpCommand,
        reportSlash
    ].map(command => command.toJSON());

    try {
        console.log(`Started refreshing application (/) commands for guild ${guildId}.`);
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commands });
        console.log('Successfully reloaded application (/) commands for guild:', guildId);
    } catch (error) {
        console.error(`Failed to refresh commands for guild ${guildId}:`, error);
    }
}

module.exports = { registerCommands };
