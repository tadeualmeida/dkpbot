// dkpSlash.js

const { SlashCommandBuilder } = require('@discordjs/builders');

const dkpCommand = new SlashCommandBuilder()
  .setName('dkp')
  .setDescription('Check your DKP balance.');

const rankCommand = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Check DKP rank.');

const dkpAddCommand = new SlashCommandBuilder()
  .setName('dkpadd')
  .setDescription('Add DKP')
  .addStringOption(option =>
    option.setName('users')
      .setDescription('The users to add DKP to, separated by commas for multiple users')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('points')
      .setDescription('Number of DKP points to add')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Optional description for adding DKP'));

const dkpRemoveCommand = new SlashCommandBuilder()
  .setName('dkpremove')
  .setDescription('Remove DKP')
  .addStringOption(option =>
    option.setName('users')
      .setDescription('The users to remove DKP from, separated by commas for multiple users')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('points')
      .setDescription('Number of DKP points to remove')
      .setRequired(true))
  .addStringOption(option =>
    option.setName('description')
      .setDescription('Optional description for removing DKP'));

module.exports = { dkpCommand, dkpAddCommand, dkpRemoveCommand, rankCommand };
