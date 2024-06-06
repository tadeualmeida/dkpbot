// crowSlash.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const crowCommand = new SlashCommandBuilder()
    .setName('crow')
    .setDescription('Manage crows in the guild bank.')
    .addSubcommand(subcommand =>
        subcommand
            .setName('add')
            .setDescription('Add crows to the guild bank.')
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('The amount of crows to add')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Remove crows from the guild bank.')
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('The amount of crows to remove')
                    .setRequired(true))
    );

const bankCommand = new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Displays the number of crows in the guild bank.');

module.exports = { crowCommand, bankCommand };
