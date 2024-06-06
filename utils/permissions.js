const RoleConfig = require('../schema/RoleConfig');
const { PermissionsBitField } = require('discord.js');

async function checkRolePermission(interaction, commandName) {
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return true;
    }

    const rolesConfig = await RoleConfig.find({ guildId: interaction.guildId }).lean().exec();
    const memberRoles = interaction.member.roles.cache;

    const commandGroups = {
        administrators: ['dkpadd', 'dkpremopve', 'addcrow', 'removecrow', 'reset', 'rankreport', 'config'],
        moderators: ['event', 'showhelp'],
        users: ['bank', 'dkp', 'rank', 'join', 'help']
    };

    const hasPermission = rolesConfig.some(config => {
        if (!memberRoles.has(config.roleId)) return false;

        // Administrators can use all commands
        if (config.commandGroup === 'administrators') return true;

        // Moderators can use moderator and user commands
        if (config.commandGroup === 'moderators' && 
            (commandGroups.moderators.includes(commandName) || commandGroups.users.includes(commandName))) return true;

        // Users can use only user commands
        if (config.commandGroup === 'users' && commandGroups.users.includes(commandName)) return true;

        return false;
    });

    if (!hasPermission) {
        await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        return false;
    }

    return true;
}

module.exports = { checkRolePermission };
