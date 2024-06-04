const ExcelJS = require('exceljs');
const { Dkp } = require('../schema/Dkp');
const { AttachmentBuilder } = require('discord.js');

async function generateRankReport(guild) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('DKP Rank');

    worksheet.columns = [
        { header: 'Rank', key: 'rank', width: 10 },
        { header: 'User', key: 'username', width: 30 },
        { header: 'Points', key: 'points', width: 10 },
    ];

    const dkpPoints = await Dkp.find({ guildId: guild.id }).sort({ points: -1 }).exec();

    for (let i = 0; i < dkpPoints.length; i++) {
        const dkp = dkpPoints[i];
        const user = await guild.members.fetch(dkp.userId).catch(() => null);
        const username = user ? user.user.username : 'Unknown User';
        
        worksheet.addRow({
            rank: i + 1,
            username: username,
            points: dkp.points,
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

async function handleReportCommand(interaction) {
    const guild = interaction.guild;
    try {
        const buffer = await generateRankReport(guild);
        const attachment = new AttachmentBuilder(buffer, { name: 'DKP_Rank_Report.xlsx' });
        await interaction.reply({ files: [attachment], ephemeral: true });
    } catch (error) {
        console.error('Error generating rank report:', error);
        await interaction.reply({ content: 'There was an error generating the rank report.', ephemeral: true });
    }
}

module.exports = { handleReportCommand };
