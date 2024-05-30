const { createInfoEmbed } = require('../utils/embeds');

const commandCategories = {
    General: [
        { name: '/help', description: 'Lists all available commands and what each one does.', permissions: 'Members', examples: ['/help', '/help dkp'] },
        { name: '/bank', description: 'Shows the amount of crows in the guild bank.', permissions: 'Members', examples: ['/bank'] },
        { name: '/reset', description: 'Resets all DKP points, events, and crows for the guild.', permissions: 'Administrators', examples: ['/reset'] },
    ],
    DKP: [
        { name: '/dkp', description: 'List your own DKP.', permissions: 'Members', examples: ['/dkp'] },
        { name: '/dkp add <users> <points>', description: 'Adds DKP points to one or more users.', permissions: 'Administrators, Moderators', examples: ['/dkp add @user1 10', '/dkp add @user1 @user2 5'] },
        { name: '/dkp remove <users> <points>', description: 'Removes DKP points from one or more users.', permissions: 'Administrators, Moderators', examples: ['/dkp remove @user1 10', '/dkp remove @user1 @user2 5'] },
        { name: '/rank', description: 'Shows the guild DKP rank.', permissions: 'Members', examples: ['/rank'] },
    ],
    Configuration: [
        { name: '/config dkp <action> <name> <points>', description: 'Manages DKP parameters.', permissions: 'Administrators', examples: ['/config dkp add bossKill 10', '/config dkp remove bossKill'] },
        { name: '/config role <role> <commandGroup>', description: 'Sets role permissions for command groups.', permissions: 'Administrators', examples: ['/config role @admin administrators', '/config role @mod moderators'] },
        { name: '/config channel <action> <channel>', description: 'Manages channels for bot data messages.', permissions: 'Administrators', examples: ['/config channel add #general', '/config channel remove #general'] },
    ],
    Event: [
        { name: '/event start <parameter>', description: 'Starts an event with the specified parameter.', permissions: 'Administrators, Moderators', examples: ['/event start bossKill'] },
        { name: '/event end <code>', description: 'Ends the event with the specified code.', permissions: 'Administrators, Moderators', examples: ['/event end ABC123'] },
        { name: '/join <code>', description: 'Joins the event with the specified code.', permissions: 'Members', examples: ['/join ABC123'] },
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
                const examples = command.examples.map(example => `\`${example}\``).join('\n');
                return `**Command:** ${command.name}\n**Description:** ${command.description}\n**Permissions:** ${command.permissions}\n**Usage Examples:**\n${examples}`;
            }
        }
    }
    return null;
}

module.exports = { handleHelpCommand };
