const { SlashCommandBuilder } = require('@discordjs/builders');

const configCommand = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure settings for the server.')
    .addSubcommand(subcommand =>
        subcommand
            .setName('role')
            .setDescription('Define roles for command groups.')
            .addStringOption(option => 
                option.setName('commandgroup')
                    .setDescription('The command group to set the role for.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Members', value: 'users' },
                        { name: 'Administrators', value: 'administrators' },
                        { name: 'Moderators', value: 'moderators' }
                    ))
            .addRoleOption(option =>
                option.setName('role')
                    .setDescription('The role to assign to this command group.')
                    .setRequired(true))
    )
    .addSubcommand(subcommand =>
        subcommand.setName('dkp')
            .setDescription('Manage DKP parameters.')
            .addStringOption(option => 
                option.setName('action')
                    .setDescription('Add or remove a DKP parameter.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'add', value: 'add' },
                        { name: 'remove', value: 'remove' },
                        { name: 'list', value: 'list' }
                    ))
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('The name of the DKP parameter.')
                    .setRequired(false))
            .addIntegerOption(option =>
                option.setName('points')
                    .setDescription('Point value for the DKP parameter.')
                    .setRequired(false))
    )

    .addSubcommand(subcommand =>
        subcommand.setName('channel')
            .setDescription('Manage channels for bot data messages.')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('Add or remove channels.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'add', value: 'add' },
                        { name: 'remove', value: 'remove' },
                        { name: 'list', value: 'list' }
                    ))
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The channel to add or remove.')
                    .setRequired(false))
    )

module.exports = { configCommand };