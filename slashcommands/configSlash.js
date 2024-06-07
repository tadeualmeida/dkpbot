// configSlash.js

const { SlashCommandBuilder } = require('@discordjs/builders');

const configCommand = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure server settings.')
    .addSubcommand(subcommand =>
        subcommand
            .setName('role')
            .setDescription('Assign roles to command groups.')
            .addStringOption(option => 
                option.setName('commandgroup')
                    .setDescription('Select the command group.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Members', value: 'users' },
                        { name: 'Administrators', value: 'administrators' },
                        { name: 'Moderators', value: 'moderators' }
                    ))
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('Select the role for the group.')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('dkp')
            .setDescription('Manage DKP settings.')
            .addStringOption(option => 
                option.setName('action')
                    .setDescription('Choose an action: add, remove, edit, or set minimum points.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Add Parameter', value: 'add' },
                        { name: 'Remove Parameter', value: 'remove' },
                        { name: 'Edit Parameter', value: 'edit' },
                        { name: 'Set Minimum Points', value: 'minimum' }
                    ))
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('Enter the DKP parameter name.')
                    .setRequired(false)
                    .setAutocomplete(true))
            .addIntegerOption(option =>
                option.setName('points')
                    .setDescription('Enter the DKP point value.')
                    .setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('channel')
            .setDescription('Manage bot message channels.')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('Choose an action: add, remove, or list channels.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Add Channel', value: 'add' },
                        { name: 'Remove Channel', value: 'remove' }
                    ))
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('Select the channel.')
                    .setRequired(false))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('show')
            .setDescription('Show current configuration.')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('Select configuration to show.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Show Parameters', value: 'parameters' },
                        { name: 'Show Channels', value: 'channels' },
                        { name: 'Show Minimum DKP', value: 'minimum' }
                    ))
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('event')
            .setDescription('Manage event settings.')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('Choose an action: set timer.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Set Timer', value: 'timer' }
                    ))
            .addIntegerOption(option =>
                option.setName('minutes')
                    .setDescription('Enter the timer duration in minutes.')
                    .setRequired(true))
    );

module.exports = { configCommand };
