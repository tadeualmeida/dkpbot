// slashcommands/currencySlash.js
const { SlashCommandBuilder } = require('@discordjs/builders');

const currencyCommand = new SlashCommandBuilder()
  .setName('currency')
  .setDescription('Manage game-specific currency in the guild bank.')
  // Add subcommand “add”
  .addSubcommand(sub =>
    sub
      .setName('add')
      .setDescription('Add currency to the guild bank.')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select which game’s currency to add')
          .setRequired(true)
          .setAutocomplete(true))
      .addIntegerOption(opt =>
        opt
          .setName('amount')
          .setDescription('Amount to add')
          .setRequired(true))
  )
  // Add subcommand “remove”
  .addSubcommand(sub =>
    sub
      .setName('remove')
      .setDescription('Remove currency from the guild bank.')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select which game’s currency to remove')
          .setRequired(true)
          .setAutocomplete(true))
      .addIntegerOption(opt =>
        opt
          .setName('amount')
          .setDescription('Amount to remove')
          .setRequired(true))
  );

const bankCommand = new SlashCommandBuilder()
  .setName('bank')
  .setDescription('View the guild bank balances for all games or a specific game.')
  .addStringOption(opt =>
    opt
      .setName('game')
      .setDescription('Select a game to view its bank (optional)')
      .setRequired(false)
      .setAutocomplete(true)
  );

module.exports = { currencyCommand, bankCommand };
