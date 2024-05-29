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
      .setRequired(true));
const dkpRemoveCommand = new SlashCommandBuilder()
    .setName('dkpremove')
    .setDescription('Remove DKP')
    .addStringOption(option =>
      option.setName('users')
        .setDescription('The users to remove DKP to, separated by commas for multiple users')
        .setRequired(true))
    .addIntegerOption(option =>
    option.setName('points')
      .setDescription('Number of DKP points to remove')
      .setRequired(true));
      
module.exports = { dkpCommand, dkpAddCommand, dkpRemoveCommand, rankCommand};