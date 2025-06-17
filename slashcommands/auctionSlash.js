// File: slashcommands/auctionSlash.js
const { SlashCommandBuilder } = require('@discordjs/builders');

const auctionCommand = new SlashCommandBuilder()
  .setName('auction')
  .setDescription('Manage auctions')

  // Start a new auction
  .addSubcommand(sub =>
    sub
      .setName('start')
      .setDescription('Start a new auction')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('item')
          .setDescription('Item to auction')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('quantity')
          .setDescription('Number of items in this auction')
          .setRequired(true)
      )
  )

  // Edit quantity or duration of an existing auction
  .addSubcommand(sub =>
    sub
      .setName('edit')
      .setDescription('Edit quantity or duration of an existing auction')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('auctionid')
          .setDescription('ID of the auction')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('quantity')
          .setDescription('New quantity of items')
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('duration')
          .setDescription('New duration in minutes')
          .setRequired(false)
      )
  )

  // End an auction manually
  .addSubcommand(sub =>
    sub
      .setName('end')
      .setDescription('End an auction manually')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('auctionid')
          .setDescription('ID of the auction')
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

module.exports = { auctionCommand };
