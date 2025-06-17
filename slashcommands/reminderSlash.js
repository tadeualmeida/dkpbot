// slashcommands/reminderSlash.js
const { SlashCommandBuilder } = require('@discordjs/builders');

const reminderCommand = new SlashCommandBuilder()
  .setName('reminder')
  .setDescription('Set a countdown reminder for a game parameter')

  // Which game’s reminders?
  .addStringOption(opt =>
    opt
      .setName('game')
      .setDescription('Select the game to use')
      .setRequired(true)
      .setAutocomplete(true)
  )

  // Which parameter within that game?
  .addStringOption(opt =>
    opt
      .setName('parameter')
      .setDescription('Select a reminder parameter')
      .setRequired(true)
      .setAutocomplete(true)
  )

  // How long until the reminder?
  .addStringOption(opt =>
    opt
      .setName('time')
      .setDescription('Countdown duration (e.g. 1h30m, 45m, 10s)')
      .setRequired(true)
  );

module.exports = { reminderCommand };
