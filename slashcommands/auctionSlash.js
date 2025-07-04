// File: slashcommands/auctionSlash.js

const { SlashCommandBuilder } = require('@discordjs/builders');

const auctionCommand = new SlashCommandBuilder()
  .setName('auction')
  .setDescription('Manage DKP auctions')

// ─── START ──────────────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub
      .setName('start')
      .setDescription('Start a new auction')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game to use')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('item')
          .setDescription('Select an item to auction')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('quantity')
          .setDescription('Number of items available in this auction')
          .setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('location')
          .setDescription('The location where the item is (optional)')
          .setRequired(false)
)
  )

// ─── EDIT ───────────────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub
      .setName('edit')
      .setDescription('Edit an existing open auction')
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
          .setDescription('ID of the auction to edit')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('quantity')
          .setDescription('New quantity (optional)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('duration')
          .setDescription('New duration (e.g. 10h30m, 2h, 45m). Optional')
          .setRequired(false)
      )

      .addStringOption(opt =>
        opt
          .setName('location')
          .setDescription('New location of the item')
          .setRequired(false)
      )
  )

// ─── END ────────────────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub
      .setName('end')
      .setDescription('Manually end an auction immediately')
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
          .setDescription('ID of the auction to end')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )

// ─── CANCEL ─────────────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub
      .setName('cancel')
      .setDescription('Cancel and remove an auction (deletes thread and announcement)')
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
          .setDescription('ID of the auction to cancel')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
// ─── HISTORY ─────────────────────────────────────────────────────────────────────
  .addSubcommand(sub =>
    sub
      .setName('history')
      .setDescription('Show auctions closed in the last 24 hours')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game')
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

module.exports = { auctionCommand };
