// slashcommands/transactionsSlash.js
const { SlashCommandBuilder } = require('@discordjs/builders');

const transactionsCommand = new SlashCommandBuilder()
  .setName('transactions')
  .setDescription('Show the number of DKP transactions per user for a game')
  .addStringOption(opt =>
    opt
      .setName('game')
      .setDescription('Game key to filter the transactions')
      .setRequired(true)
      .setAutocomplete(true)
  );

module.exports = { transactionsCommand };
