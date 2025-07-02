// slashcommands/configSlash.js
const { SlashCommandBuilder } = require('@discordjs/builders');

const configCommand = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configure server settings.')

  // Role configuration
  .addSubcommand(sub =>
    sub
      .setName('role')
      .setDescription('Assign roles to command groups for a specific game')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game to configure')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('commandgroup')
          .setDescription('Select the command group')
          .setRequired(true)
          .addChoices(
            { name: 'Members', value: 'user' },
            { name: 'Moderators', value: 'mod' },
            { name: 'Administrators', value: 'admin' }
          )
      )
      .addRoleOption(opt =>
        opt
          .setName('role')
          .setDescription('Select the role for the group')
          .setRequired(true)
      )
  )

  // DKP parameters configuration
  .addSubcommand(sub =>
    sub
      .setName('dkp')
      .setDescription('Manage DKP settings for a specific game')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game to configure')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Choose an action')
          .setRequired(true)
          .addChoices(
            { name: 'Add Parameter',     value: 'add' },
            { name: 'Remove Parameter',  value: 'remove' },
            { name: 'Edit Parameter',    value: 'edit' },
            { name: 'Set Minimum Points',value: 'minimum' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Enter the DKP parameter name')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('points')
          .setDescription('Enter the DKP point value')
          .setRequired(false)
      )
  )

  // Channels configuration (inclui agora “auction”)
  .addSubcommand(sub =>
    sub
      .setName('channel')
      .setDescription('Set a channel for bot messages for a specific game')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game to configure')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('type')
          .setDescription('Select the channel type')
          .setRequired(true)
          .addChoices(
            { name: 'Log Channel',      value: 'log' },
            { name: 'Reminder Channel', value: 'reminder' },
            { name: 'Auction Channel',  value: 'auction' }
          )
      )
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Select the channel to use')
          .setRequired(true)
      )
  )

  // Reminder configuration
  .addSubcommand(sub =>
    sub
      .setName('reminder')
      .setDescription('Manage reminders for a specific game')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game to configure')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Choose a reminder action')
          .setRequired(true)
          .addChoices(
            { name: 'Add Parameter',    value: 'add' },
            { name: 'Remove Parameter', value: 'remove' },
            { name: 'Set Intervals',    value: 'intervals' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('parameter')
          .setDescription('Name of the parameter (for add/remove)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('intervals')
          .setDescription('Comma-separated intervals (e.g. "1h,30m,10m")')
          .setRequired(false)
      )
  )

  // Show configuration
  .addSubcommand(sub =>
    sub
      .setName('show')
      .setDescription('Show current configuration for a specific game')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game to show')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Select configuration to show')
          .setRequired(true)
          .addChoices(
            { name: 'Parameters',         value: 'parameters' },
            { name: 'Channels',           value: 'channels' },
            { name: 'Minimum Points',     value: 'minimum' },
            { name: 'Event Timer',        value: 'event' },
            { name: 'Reminder Settings',  value: 'reminder' },
            { name: 'Auction Categories', value: 'categories' },
            { name: 'Auction Items',      value: 'items' },
            { name: 'Auction Timer',      value: 'auction' }
          )
      )
  )

  // Event timer settings
  .addSubcommand(sub =>
    sub
      .setName('event')
      .setDescription('Manage event timer for a specific game')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game to configure')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Choose an action')
          .setRequired(true)
          .addChoices(
            { name: 'Set Timer', value: 'timer' }
          )
      )
      .addIntegerOption(opt =>
        opt
          .setName('minutes')
          .setDescription('Enter the timer duration in minutes')
          .setRequired(true)
      )
  )

  // Auction settings (timer, delete, mode)
  .addSubcommand(sub =>
    sub
      .setName('auction')
      .setDescription('Manage default auction settings for a specific game')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game to configure')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Choose an action')
          .setRequired(true)
          .addChoices(
            { name: 'Set Auction Timer',       value: 'timer' },
            { name: 'Set Auction Delete Time', value: 'delete' },
            { name: 'Set Auction Mode',        value: 'mode' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('duration')
          .setDescription('Duration for timer or delete (e.g. "1h30m", "90m")')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('mode')
          .setDescription('Which currency mode to use for auctions')
          .setRequired(false)
          .addChoices(
            { name: 'Game Currency', value: 'currency' },
            { name: 'Use DKP as Currency', value: 'dkp' }
          )
      )
  )

  // Game management: add, remove, rename
  .addSubcommand(sub =>
    sub
      .setName('game')
      .setDescription('Manage games on this server')
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Choose an action')
          .setRequired(true)
          .addChoices(
            { name: 'Add Game',    value: 'add' },
            { name: 'Remove Game', value: 'remove' },
            { name: 'Rename Game', value: 'rename' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('key')
          .setDescription('Game key (e.g., nightcrows, odin)')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Game display name')
          .setRequired(false)
      )
      .addStringOption(opt =>
        opt
          .setName('currency')
          .setDescription('Currency name for new game')
          .setRequired(false)
      )
  )

  // Set guild display name
  .addSubcommand(sub =>
    sub
      .setName('guildname')
      .setDescription('Set the server display name')
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Enter the server name')
          .setRequired(true)
      )
  )

    // ---- CATEGORY CONFIGURATION ----
  .addSubcommand(sub =>
    sub
      .setName('category')
      .setDescription('Manage auction categories for a specific game')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game to configure')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Choose an action')
          .setRequired(true)
          .addChoices(
            { name: 'Add Category',    value: 'add' },
            { name: 'Remove Category', value: 'remove' },
            { name: 'Edit Category',   value: 'edit' },
            { name: 'Show Categories', value: 'list' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Category name (for add, remove, or edit)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addIntegerOption(opt =>
        opt
          .setName('minimumdkp')
          .setDescription('Minimum DKP required to bid in this category')
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('minimumcurrency')
          .setDescription('Minimum in-game currency required to bid in this category')
          .setRequired(false)
      )
      .addIntegerOption(opt =>
        opt
          .setName('bid_increment')
          .setDescription('Minimum bid increment for this category')
          .setRequired(false)
      )
  )

  // ---- ITEM CONFIGURATION ----
  .addSubcommand(sub =>
    sub
      .setName('item')
      .setDescription('Manage items for a specific game')
      .addStringOption(opt =>
        opt
          .setName('game')
          .setDescription('Select the game to configure')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('action')
          .setDescription('Choose an action')
          .setRequired(true)
          .addChoices(
            { name: 'Add Item',    value: 'add' },
            { name: 'Remove Item', value: 'remove' },
            { name: 'List Items',  value: 'list' }
          )
      )
      .addStringOption(opt =>
        opt
          .setName('name')
          .setDescription('Item name (for add or remove)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('category')
          .setDescription('Existing category name (for add)')
          .setRequired(false)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('image')
          .setDescription('Image filename (autocomplete da pasta /img/itens/)')
          .setRequired(false)
          .setAutocomplete(true)
      )
  );

module.exports = { configCommand };