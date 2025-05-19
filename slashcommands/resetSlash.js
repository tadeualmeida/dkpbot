//slashcommands/resetSlash.js

const { SlashCommandBuilder } = require('@discordjs/builders');

const resetCommand = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('Reset all DKP points, events, reminders, and currency for a specific game')
  .addStringOption(opt =>
    opt
      .setName('game')
      .setDescription('Which game to reset')
      .setRequired(true)
      .setAutocomplete(true)
  );

module.exports = { resetCommand };
