// File: slashcommands/bidSlash.js
const { SlashCommandBuilder } = require('@discordjs/builders');

const bidCommand = new SlashCommandBuilder()
  .setName('bid')
  .setDescription('Place a bid on the current auction (must be used inside an auction thread)')
  .addIntegerOption(opt =>
    opt
      .setName('value')
      .setDescription('Your bid amount')
      .setRequired(true)
  );

module.exports = { bidCommand };
