// commands/transactionsCommands.js
const Dkp = require('../schema/Dkp');
const { createMultipleResultsEmbed } = require('../utils/embeds');
const { resolveGameKey } = require('../utils/resolveGameKey');
const { loadGuildConfig } = require('../utils/config');

/**
 * /transactions game:<game>
 * Lists the number of DKP transactions per user for a given game,
 * sorted descending, showing only users with the configured "user" role.
 */
async function handleTransactionsCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  // 1) Resolve the gameKey (via option or roles)
  let gameKey = interaction.options.getString('game')?.toLowerCase();
  if (!gameKey) {
    gameKey = await resolveGameKey(interaction, interaction.member);
    if (!gameKey) return; // internal reply if missing permission or ambiguous
  }

  const guildId = interaction.guildId;
  // Load guild config to get role settings
  const cfg = await loadGuildConfig(guildId);
  const gameCfg = cfg.games.find(g => g.key === gameKey);
  const userRoleIds = gameCfg?.roles.user || [];

  // 2) Fetch all DKP records for that game in this guild
  const records = await Dkp.find({ guildId, gameKey }).lean();
  if (!records.length) {
    return interaction.editReply({
      content: `No DKP transaction records found for game **${gameKey}**.`,
      ephemeral: true
    });
  }

  // 3) Fetch members and filter those with the configured "user" role
  const userIds = records.map(rec => rec.userId);
  const members = await interaction.guild.members.fetch({ user: userIds });
  const validRecs = records
    .map(rec => ({ rec, member: members.get(rec.userId) }))
    .filter(({ member }) => member && userRoleIds.some(rid => member.roles.cache.has(rid)));

  if (!validRecs.length) {
    return interaction.editReply({
      content: `No eligible users with transactions for game **${gameKey}**.`,
      ephemeral: true
    });
  }

  // 4) Build lines with displayName and transaction count, sorted descending
  const sorted = validRecs
    .map(({ rec, member }) => ({
      name: member.displayName,
      count: Array.isArray(rec.transactions) ? rec.transactions.length : 0
    }))
    .sort((a, b) => b.count - a.count);

  const lines = sorted.map(u => `• ${u.name} — ${u.count}`);

  // 5) Reply with an embed
  return interaction.editReply({
    embeds: [
      createMultipleResultsEmbed(
        'info',
        `DKP Transactions — ${gameKey}`,
        lines
      )
    ]
  });
}

module.exports = { handleTransactionsCommand };
