// commands/transactionsCommands.js
const Dkp = require('../schema/Dkp');
const { createMultipleResultsEmbed } = require('../utils/embeds');
const { resolveGameKey } = require('../utils/resolveGameKey');

async function handleTransactionsCommand(interaction) {
  await interaction.deferReply({ ephemeral: true });

  // 1) Resolve the gameKey (via option or roles)
  let gameKey = interaction.options.getString('game')?.toLowerCase();
  if (!gameKey) {
    gameKey = await resolveGameKey(interaction, interaction.member);
    if (!gameKey) return; // internal reply if missing permission or ambiguous
  }

  const guildId = interaction.guildId;
  // 2) Fetch all DKP records for that game in this guild
  const records = await Dkp.find({ guildId, gameKey }).lean();
  if (!records.length) {
    return interaction.editReply({
      content: `No DKP transaction records found for game **${gameKey}**.`,
      ephemeral: true
    });
  }

  // 3) Build lines: user mention and transaction count
  const lines = records.map(rec => {
    const count = Array.isArray(rec.transactions) ? rec.transactions.length : 0;
    return `• <@${rec.userId}> — ${count} transactions`;
  });

  // 4) Reply with an embed
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
