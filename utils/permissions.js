const RoleConfig = require('../schema/RoleConfig');
const { PermissionsBitField } = require('discord.js');

async function checkRolePermission(interaction, commandName) {
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return true;
    }
    const rolesConfig = await RoleConfig.find({ guildId: interaction.guildId });
    const memberRoles = interaction.member.roles.cache;

    const hasPermission = rolesConfig.some(config => {
        const hasRole = memberRoles.has(config.roleId);
        if (!hasRole) return false;

        if (config.commandGroup === 'administrators' && ['setrole'].includes(commandName)) return false;
        if (config.commandGroup === 'moderators' && ['addcrow', 'removecrow', 'config', 'channel', 'reset', 'rankreport'].includes(commandName)) return false;
        if (config.commandGroup === 'users' && !['bank', 'dkp', 'rank', 'join', 'help'].includes(commandName)) return false;

        return true;
    });

    if (!hasPermission) {
        await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        return false;
    }
    return true;
}

module.exports = { checkRolePermission };
