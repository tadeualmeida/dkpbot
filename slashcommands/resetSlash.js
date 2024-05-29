const { SlashCommandBuilder } = require('@discordjs/builders');

const resetCommand = new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Reset all DKP points, events, and crows');
    
module.exports = { resetCommand };