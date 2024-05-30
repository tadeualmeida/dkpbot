const { createInfoEmbed } = require('../utils/embeds');

const commandCategories = {
    General: [
        { name: '/help', description: 'Lists all available commands and what each one does.', permissions: 'Everyone' },
        { name: '/bank', description: 'Shows the amount of crows in the guild bank.', permissions: 'Everyone' },
        { name: '/reset', description: 'Resets all DKP points, events, and crows for the guild.', permissions: 'Administrators' },
    ],
    DKP: [
        { name: '/dkp', description: 'List your own DKP.', permissions: 'Everyone' },
        { name: '/dkp add <users> <points>', description: 'Adds DKP points to one or more users.', permissions: 'Administrators, Moderators' },
        { name: '/dkp remove <users> <points>', description: 'Removes DKP points from one or more users.', permissions: 'Administrators, Moderators' },
        { name: '/rank', description: 'Shows the guild DKP rank.', permissions: 'Everyone' },
    ],
    Configuration: [
        { name: '/config dkp <action> <name> <points>', description: 'Manages DKP parameters.', permissions: 'Administrators' },
        { name: '/config role <role> <commandGroup>', description: 'Sets role permissions for command groups.', permissions: 'Administrators' },
        { name: '/config channel <action> <channel>', description: 'Manages channels for bot messages.', permissions: 'Administrators' },
    ],
    Event: [
        { name: '/event start <parameter>', description: 'Starts an event with the specified parameter.', permissions: 'Administrators, Moderators' },
        { name: '/event end <code>', description: 'Ends the event with the specified code.', permissions: 'Administrators, Moderators' },
        { name: '/join <code>', description: 'Joins the event with the specified code.', permissions: 'Everyone' },
    ],
};

async function handleHelpCommand(interaction) {
    const descriptions = Object.entries(commandCategories).map(([category, commands]) => {
        const commandsList = commands.map(command => 
            `**${command.name}** - ${command.description} (Permissions: ${command.permissions})`
        ).join('\n');
        return `**${category} Commands:**\n${commandsList}`;
    }).join('\n\n');

    const embed = createInfoEmbed('Available Commands', descriptions);

    await interaction.reply({ embeds: [embed] });
}

module.exports = { handleHelpCommand };
