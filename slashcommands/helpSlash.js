const { SlashCommandBuilder } = require('@discordjs/builders');

const helpCommand = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lists all available commands and what each one does.');
    
module.exports = { helpCommand };