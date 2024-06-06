const RoleConfig = require('../schema/RoleConfig');
const { PermissionsBitField } = require('discord.js');

async function checkRolePermission(interaction, commandName) {
    if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return true;
    }

    const rolesConfig = await RoleConfig.find({ guildId: interaction.guildId }).lean().exec();
    const memberRoles = interaction.member.roles.cache;

    const commandGroups = {
        administrators: ['setrole'],
        moderators: ['addcrow', 'removecrow', 'config', 'reset', 'rankreport'],
        users: ['bank', 'dkp', 'rank', 'join', 'help']
    };

    const hasPermission = rolesConfig.some(config => {
        if (!memberRoles.has(config.roleId)) return false;

        const restrictedCommands = commandGroups[config.commandGroup];
        if (restrictedCommands && restrictedCommands.includes(commandName)) return true;

        return false;
    });

    if (!hasPermission) {
        await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        return false;
    }

    return true;
}

module.exports = { checkRolePermission };
