// slashcommands/reportSlash.js
const { SlashCommandBuilder } = require('@discordjs/builders');

const reportSlash = new SlashCommandBuilder()
  .setName('rankreport')
  .setDescription('Generates and sends a DKP rank report as an Excel file.')
  // optional game filter
  .addStringOption(opt =>
    opt
      .setName('game')
      .setDescription('Select the game to filter report (optional)')
      .setRequired(false)
      .setAutocomplete(true)
  );

module.exports = { reportSlash };
