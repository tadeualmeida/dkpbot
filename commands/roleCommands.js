// roleCommands.js
const RoleConfig = require('../schema/RoleConfig');

async function handleSetRoleCommand(interaction) {
    const commandGroup = interaction.options.getString('commandgroup');
    const role = interaction.options.getRole('role');

    try {
        const result = await RoleConfig.updateOne(
            { commandGroup: commandGroup, guildId: interaction.guildId },
            { $set: { roleId: role.id } },
            { upsert: true }
        );

        await interaction.reply({ content: `Role **${role.name}** has been set for command group **${commandGroup}**.`, ephemeral: true });
    } catch (error) {
        console.error('Error setting role:', error);
        await interaction.reply({ content: 'Failed to set role due to an error.', ephemeral: true });
    }
}

module.exports = { handleSetRoleCommand };
