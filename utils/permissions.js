const { getRoleConfigFromCache } = require('../utils/cacheManagement');
const { PermissionsBitField } = require('discord.js');

async function checkRolePermission(interaction, commandName) {
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return true;
    }

    const roleConfigs = await getRoleConfigFromCache(interaction.guildId);
    if (!roleConfigs || !Array.isArray(roleConfigs)) {
        console.error('Error: roleConfigs is not an array or is undefined/null');
        await interaction.reply({ content: "There was an error checking your permissions. Please contact an administrator.", ephemeral: true });
        return false;
    }

    const memberRoles = interaction.member.roles.cache;

    const commandGroups = {
        users: ['bank', 'dkp', 'rank', 'join', 'help'],
        moderators: ['event', 'showhelp'],
        administrators: ['dkpadd', 'dkpremopve', 'addcrow', 'removecrow', 'reset', 'rankreport', 'config']
    };

    // Combine commands to reflect the hierarchy: administrators > moderators > users
    const allCommands = {
        users: commandGroups.users,
        moderators: [...commandGroups.moderators, ...commandGroups.users],
        administrators: [...commandGroups.administrators, ...commandGroups.moderators, ...commandGroups.users]
    };

    const hasPermission = roleConfigs.some(config => {
        if (!memberRoles.has(config.roleId)) return false;

        // Check if the command is allowed for the role's command group
        return allCommands[config.commandGroup] && allCommands[config.commandGroup].includes(commandName);
    });

    if (!hasPermission) {
        await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        return false;
    }

    return true;
}

module.exports = { checkRolePermission };
