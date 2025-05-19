//commands/roleCommands.js
const { loadGuildConfig, invalidateGuildConfig } = require('../utils/config');
const {
  refreshRoleConfigCache,
  refreshGuildConfigCache
} = require('../utils/cacheManagement');
const GuildConfig = require('../schema/GuildConfig');

async function handleSetRoleCommand(interaction) {
    const guildId = interaction.guildId;
    const gameKey = interaction.options.getString('game').toLowerCase();
    const commandGroup = interaction.options.getString('commandgroup');
    const role = interaction.options.getRole('role');

    try {
        // Update the specific game's roles array for the command group, adding the role ID
        await GuildConfig.updateOne(
            { guildId, 'games.key': gameKey },
            { $addToSet: { [`games.$.roles.${commandGroup}`]: role.id } }
        );

        // Invalidate and refresh caches for this game
        invalidateGuildConfig(guildId);
        await refreshRoleConfigCache(guildId, gameKey);
        await refreshGuildConfigCache(guildId);

        await interaction.reply({
            embeds: [
                {
                    title: 'Role Set',
                    description: `Role **${role.name}** has been set for **${commandGroup}** in **${gameKey}**.`,
                    color: 0x00FF00
                }
            ],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error setting role:', error);
        await interaction.reply({ content: 'Failed to set role due to an error.', ephemeral: true });
    }
}

module.exports = { handleSetRoleCommand };
