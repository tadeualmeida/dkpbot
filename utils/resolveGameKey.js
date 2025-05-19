//utils/resolveGameKey.js
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getGamesFromCache } = require('./cacheManagement');

/**
 * Resolves a game key for commands that support multi-game contexts.
 * If the user provided an explicit 'game' option, returns it.
 * Otherwise, looks at the games the user has roles for:
 *  - If exactly one, returns that game key.
 *  - If none, sends an ephemeral error reply and returns null.
 *  - If multiple, prompts the user with a select menu and returns null.
 *
 * @param {CommandInteraction} interaction
 * @returns {Promise<string|null>} the resolved gameKey or null
 */
async function resolveGameKey(interaction) {
  const guildId = interaction.guildId;
  const rawGame = interaction.options.getString('game');
  if (rawGame) {
    return rawGame.toLowerCase();
  }

  // Fetch configured games and filter by roles
  const games = await getGamesFromCache(guildId);
  const memberRoles = interaction.member.roles.cache;
  const playable = games.filter(g => g.roles.user.some(rid => memberRoles.has(rid)));

  if (playable.length === 1) {
    return playable[0].key;
  }

  if (playable.length === 0) {
    await interaction.reply({ content: "You don't have access to any game.", ephemeral: true });
    return null;
  }

  // Multiple games: prompt selection
  const options = playable.map(g => ({ label: g.name, value: g.key }));
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`select-game:${interaction.commandName}`)
    .setPlaceholder('Select a game')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(menu);
  await interaction.reply({ content: 'Please select a game:', components: [row], ephemeral: true });
  return null;
}

module.exports = { resolveGameKey };
