// slashcommands/eventSlash.js

const { SlashCommandBuilder } = require('@discordjs/builders');

const eventSlashCommand = new SlashCommandBuilder()
  .setName('event')
  .setDescription('Manage events')
  // /event start
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('Start a new event')
      .addStringOption(option =>
        option
          .setName('game')
          .setDescription('Select the game for this event')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('parameter')
          .setDescription('The DKP parameter for the event')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  // /event end
  .addSubcommand(subcommand =>
    subcommand
      .setName('end')
      .setDescription('End an event')
      .addStringOption(option =>
        option
          .setName('game')
          .setDescription('Select the game of the event to end')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('code')
          .setDescription('The code of the event to end')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  // /event list
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List participants of an event')
      .addStringOption(option =>
        option
          .setName('game')
          .setDescription('Select the game of the event')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('code')
          .setDescription('The code of the event to list participants')
          .setRequired(true)
      )
  )
  // /event cancel
  .addSubcommand(subcommand =>
    subcommand
      .setName('cancel')
      .setDescription('Cancel an event and remove points from participants')
      .addStringOption(option =>
        option
          .setName('game')
          .setDescription('Select the game of the event to cancel')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('code')
          .setDescription('The event code')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  // /event rank
  .addSubcommand(subcommand =>
    subcommand
      .setName('rank')
      .setDescription('Get the ranking of participants for a specific DKP parameter')
      .addStringOption(option =>
        option
          .setName('game')
          .setDescription('Select the game for the parameter ranking')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(option =>
        option
          .setName('parameter')
          .setDescription('The DKP parameter to rank participants by')
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

const joinCommand = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Join the current event.')
  .addStringOption(option =>
    option
      .setName('code')
      .setDescription('Enter the code for the event.')
      .setRequired(true)
  );

module.exports = { eventSlashCommand, joinCommand };
