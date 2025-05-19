//
const { SlashCommandBuilder } = require('@discordjs/builders');

const helpCommand = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lists all available commands and what each one does.')
    .addStringOption(option =>
        option.setName('command')
            .setDescription('The specific command to get detailed help about')
            .setRequired(false)
    );

const showHelpCommand = new SlashCommandBuilder()
    .setName('showhelp')
    .setDescription('Lists all available commands and what each one does for everyone.');

module.exports = { helpCommand, showHelpCommand };
