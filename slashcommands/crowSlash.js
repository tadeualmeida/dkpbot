// /commands/crowCommands.js
const { SlashCommandBuilder } = require('@discordjs/builders');

const addCrowCommand = new SlashCommandBuilder()
    .setName('addcrow')
    .setDescription('Add crows to the guild bank.')
    .addIntegerOption(option =>
        option.setName('amount')
        .setDescription('The amount of crows to add')
        .setRequired(true));

const removeCrowCommand = new SlashCommandBuilder()
    .setName('removecrow')
    .setDescription('Remove crows from the guild bank.')
    .addIntegerOption(option =>
        option.setName('amount')
        .setDescription('The amount of crows to remove')
        .setRequired(true));

const bankCommand = new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Displays the number of crows in the guild bank.');

module.exports = { addCrowCommand, removeCrowCommand, bankCommand };
