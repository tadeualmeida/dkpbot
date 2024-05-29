// eventSlash.js

const { SlashCommandBuilder } = require('@discordjs/builders');

const eventSlashCommand = new SlashCommandBuilder()
    .setName('event')
    .setDescription('Manage events')
    .addSubcommand(subcommand =>
        subcommand
            .setName('start')
            .setDescription('Start a new event')
            .addStringOption(option =>
                option.setName('parameter')
                    .setDescription('The parameter for the event')
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('end')
            .setDescription('End an event')
            .addStringOption(option =>
                option.setName('code')
                    .setDescription('The code of the event to end')
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('list')
            .setDescription('List participants of an event')
            .addStringOption(option =>
                option.setName('code')
                    .setDescription('The code of the event to list participants')
                    .setRequired(true)
            )
    );

const joinCommand = new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join the current event.')
    .addStringOption(option =>
        option.setName('code')
            .setDescription('Enter the code for the event.')
            .setRequired(true)
        );

module.exports = { eventSlashCommand, joinCommand};
