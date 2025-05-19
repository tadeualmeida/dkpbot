// commands/reportCommands.js
const ExcelJS = require('exceljs');
const Dkp = require('../schema/Dkp');
const { AttachmentBuilder } = require('discord.js');
const { resolveGameKey } = require('../utils/resolveGameKey');

async function generateRankReport(guild, gameKey) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('DKP Rank');

  worksheet.columns = [
    { header: 'Rank', key: 'rank', width: 10 },
    { header: 'User', key: 'username', width: 30 },
    { header: 'Points', key: 'points', width: 10 },
  ];

  // Query by guildId + gameKey
  const query = { guildId: guild.id };
  if (gameKey) query.gameKey = gameKey;

  const dkpPoints = await Dkp.find(query).sort({ points: -1 }).exec();

  for (let i = 0; i < dkpPoints.length; i++) {
    const dkp = dkpPoints[i];
    const member = await guild.members.fetch(dkp.userId).catch(() => null);
    const username = member ? member.displayName : `<@${dkp.userId}>`;

    worksheet.addRow({
      rank: i + 1,
      username,
      points: dkp.points,
    });
  }

  return workbook.xlsx.writeBuffer();
}

async function handleReportCommand(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    // Resolve gameKey via option or roles
    const forced = interaction.options.getString('game');
    const gameKey = forced ? forced.toLowerCase() : await resolveGameKey(interaction, interaction.member);

    const buffer = await generateRankReport(interaction.guild, gameKey);
    const fileName = gameKey
      ? `DKP_Rank_Report_${gameKey}.xlsx`
      : 'DKP_Rank_Report_AllGames.xlsx';

    const attachment = new AttachmentBuilder(buffer, { name: fileName });
    await interaction.followUp({ files: [attachment], ephemeral: true });
  } catch (error) {
    console.error('Error generating rank report:', error);
    await interaction.followUp({ content: 'There was an error generating the rank report.', ephemeral: true });
  }
}

module.exports = { handleReportCommand };
