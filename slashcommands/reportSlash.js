const { SlashCommandBuilder } = require('@discordjs/builders');

const reportSlash = new SlashCommandBuilder()
    .setName('rankreport')
    .setDescription('Generates and sends a DKP rank report as an Excel file.');

module.exports = { reportSlash };
