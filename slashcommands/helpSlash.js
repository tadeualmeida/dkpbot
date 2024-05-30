const { SlashCommandBuilder } = require('@discordjs/builders');

const helpCommand = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lists all available commands and what each one does.')
    .addStringOption(option =>
        option.setName('command')
            .setDescription('Specify a command to get detailed information.')
            .setRequired(false)
    );

module.exports = { helpCommand };
