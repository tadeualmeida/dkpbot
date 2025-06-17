// utils/registerCommands.js

const { REST, Routes } = require('discord.js');
const {
  dkpCommand,
  dkpAddCommand,
  dkpRemoveCommand,
  rankCommand
} = require('../slashcommands/dkpSlash');
const {
  eventSlashCommand,
  joinCommand
} = require('../slashcommands/eventSlash');
const {
  currencyCommand,
  bankCommand
} = require('../slashcommands/currencySlash');
const {
  configCommand
} = require('../slashcommands/configSlash');
const {
  resetCommand
} = require('../slashcommands/resetSlash');
const {
  helpCommand,
  showHelpCommand
} = require('../slashcommands/helpSlash');
const {
  reportSlash
} = require('../slashcommands/reportSlash');
const {
  reminderCommand
} = require('../slashcommands/reminderSlash');
const { 
  auctionCommand 
} = require('../slashcommands/auctionSlash');
const { 
  bidCommand 
} = require('../slashcommands/bidSlash');
const { 
  transactionsCommand 
} = require('../slashcommands/transactionsSlash');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands(guildId) {
  const commands = [
    // DKP
    dkpCommand,
    dkpAddCommand,
    dkpRemoveCommand,
    rankCommand,

    // Currency (formerly “crow”)
    currencyCommand,
    bankCommand,

    // Config
    configCommand,

    // Events
    eventSlashCommand,
    joinCommand,

    // Reset & Report
    resetCommand,
    reportSlash,

    // Help
    helpCommand,
    showHelpCommand,

    //Reminder
    reminderCommand,

    //Auctions
    auctionCommand,
    bidCommand,

    //transactions
    transactionsCommand
  ].map(cmd => cmd.toJSON());

  try {
    console.log(`Refreshing application (/) commands for guild ${guildId}…`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
      { body: commands }
    );
    console.log(`Successfully reloaded commands for guild ${guildId}`);
  } catch (error) {
    console.error(`Failed to refresh commands for guild ${guildId}:`, error);
  }
}

module.exports = { registerCommands };
