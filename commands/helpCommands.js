const { createInfoEmbed } = require('../utils/embeds');

const commandCategories = {
    General: [
        { name: '/help', description: 'Lists all available commands and what each one does.', permissions: 'Members' },
        { name: '/bank', description: 'Shows the amount of crows in the guild bank.', permissions: 'Members' },
        { name: '/reset', description: 'Resets all DKP points, events, and crows for the guild.', permissions: 'Administrators' },
    ],
    DKP: [
        { name: '/dkp', description: 'List your own DKP.', permissions: 'Members' },
        { name: '/dkp add <users> <points>', description: 'Adds DKP points to one or more users.', permissions: 'Administrators, Moderators' },
        { name: '/dkp remove <users> <points>', description: 'Removes DKP points from one or more users.', permissions: 'Administrators, Moderators' },
        { name: '/rank', description: 'Shows the guild DKP rank.', permissions: 'Members' },
    ],
    Configuration: [
        { name: '/config dkp <action> <name> <points>', description: 'Manages DKP parameters.', permissions: 'Administrators' },
        { name: '/config role <role> <commandGroup>', description: 'Sets role permissions for command groups.', permissions: 'Administrators' },
        { name: '/config channel <action> <channel>', description: 'Manages channels for bot data messages.', permissions: 'Administrators' },
    ],
    Event: [
        { name: '/event start <parameter>', description: 'Starts an event with the specified parameter.', permissions: 'Administrators, Moderators' },
        { name: '/event end <code>', description: 'Ends the event with the specified code.', permissions: 'Administrators, Moderators' },
        { name: '/join <code>', description: 'Joins the event with the specified code.', permissions: 'Members' },
    ],
};

async function handleHelpCommand(interaction) {
    const commandName = interaction.options.getString('command');
    
    if (commandName) {
        const detailedInfo = getDetailedCommandInfo(commandName);
        if (detailedInfo) {
            const embed = createInfoEmbed(`Help: ${commandName}`, detailedInfo);
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply({ content: 'Command not found.', ephemeral: true });
        }
    } else {
        const descriptions = Object.entries(commandCategories).map(([category, commands]) => {
            const commandsList = commands.map(command => 
                `**${command.name}** - ${command.description} (Permissions: ${command.permissions})`
            ).join('\n');
            return `**${category} Commands:**\n${commandsList}`;
        }).join('\n\n');
    
        const embed = createInfoEmbed('Available Commands', descriptions);
        await interaction.reply({ embeds: [embed] });
    }
}

function getDetailedCommandInfo(commandName) {
    for (const commands of Object.values(commandCategories)) {
        for (const command of commands) {
            if (command.name.split(' ')[0] === commandName.split(' ')[0]) {
                return `**Command:** ${command.name}\n**Description:** ${command.description}\n**Permissions:** ${command.permissions}\n**Usage Examples:**\n\`\`\`${command.name.split(' ')[0]} example usage...\`\`\``;
            }
        }
    }
    return null;
}

module.exports = { handleHelpCommand };
