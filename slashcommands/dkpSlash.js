// slashcommands/dkpSlash.js
const { SlashCommandBuilder } = require('@discordjs/builders');

// Balance (optional game)
const dkpCommand = new SlashCommandBuilder()
  .setName('dkp')
  .setDescription('Check your DKP balance.')
  .addStringOption(opt =>
    opt
      .setName('game')
      .setDescription('Select the game to check DKP for (optional)')
      .setRequired(false)
      .setAutocomplete(true)
  );

// Rank (optional game)
const rankCommand = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Check DKP rank.')
  .addStringOption(opt =>
    opt
      .setName('game')
      .setDescription('Select the game to show rank for (optional)')
      .setRequired(false)
      .setAutocomplete(true)
  );

// Add (requires game)
const dkpAddCommand = new SlashCommandBuilder()
  .setName('dkpadd')
  .setDescription('Add DKP')
  .addStringOption(opt =>
    opt
      .setName('game')
      .setDescription('Select the game')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt
      .setName('users')
      .setDescription('Mentions or IDs (comma-separated)')
      .setRequired(true)
  )
  .addIntegerOption(opt =>
    opt
      .setName('points')
      .setDescription('Points to add')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt
      .setName('description')
      .setDescription('Optional description')
  );

// Remove (requires game)
const dkpRemoveCommand = new SlashCommandBuilder()
  .setName('dkpremove')
  .setDescription('Remove DKP')
  .addStringOption(opt =>
    opt
      .setName('game')
      .setDescription('Select the game')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(opt =>
    opt
      .setName('users')
      .setDescription('Mentions or IDs (comma-separated)')
      .setRequired(true)
  )
  .addIntegerOption(opt =>
    opt
      .setName('points')
      .setDescription('Points to remove')
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt
      .setName('description')
      .setDescription('Optional description')
  );

module.exports = { dkpCommand, rankCommand, dkpAddCommand, dkpRemoveCommand };
