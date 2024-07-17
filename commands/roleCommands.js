// roleCommands.js

const GuildConfig = require('../schema/GuildConfig');

async function handleSetRoleCommand(interaction) {
    const commandGroup = interaction.options.getString('commandgroup');
    const role = interaction.options.getRole('role');

    try {
        // Atualiza o roleId no schema GuildConfig
        const result = await GuildConfig.updateOne(
            { guildId: interaction.guildId },
            { $set: { [`roles.${commandGroup}`]: role.id } },
            { upsert: true }
        );

        await interaction.reply({ content: `Role **${role.name}** has been set for command group **${commandGroup}**.`, ephemeral: true });
    } catch (error) {
        console.error('Error setting role:', error);
        await interaction.reply({ content: 'Failed to set role due to an error.', ephemeral: true });
    }
}

module.exports = { handleSetRoleCommand };

