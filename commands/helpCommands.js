//commands/helpCommands.js
const { createInfoEmbed } = require('../utils/embeds');

const commandCategories = {
  General: {
    description: 'General commands for basic bot operations.',
    commands: [
      { 
        name: '/help [command]', 
        description: 'Lists all available commands or shows detailed help for one.', 
        permissions: 'Members', 
        examples: ['/help', '/help dkp'] 
      },
      { 
        name: '/showhelp', 
        description: 'Displays all commands and descriptions publicly in this channel.', 
        permissions: 'Administrators, Moderators', 
        examples: ['/showhelp'] 
      },
      { 
        name: '/bank', 
        description: 'Shows the current amount of crows in the guild bank.', 
        permissions: 'Members', 
        examples: ['/bank'] 
      },
      { 
        name: '/reset <game>', 
        description: 'Resets DKP points, events, and crows for a specific game.', 
        permissions: 'Administrators', 
        examples: ['/reset odin'] 
      },
    ]
  },
  DKP: {
    description: 'Commands for managing and viewing DKP points.',
    commands: [
      { 
        name: '/dkp [game]', 
        description: 'Displays your current DKP balance, auto-selecting if you only have one game role.', 
        permissions: 'Members', 
        examples: ['/dkp', '/dkp odin'] 
      },
      { 
        name: '/dkp add <game> <users> <points>', 
        description: 'Adds DKP points to one or more users in a game.', 
        permissions: 'Administrators, Moderators', 
        examples: ['/dkp add odin @user1 10', '/dkp add odin @user1 @user2 5'] 
      },
      { 
        name: '/dkp remove <game> <users> <points>', 
        description: 'Removes DKP points from one or more users in a game.', 
        permissions: 'Administrators, Moderators', 
        examples: ['/dkp remove odin @user1 10', '/dkp remove odin @user2 5'] 
      },
      { 
        name: '/rank [game]', 
        description: 'Displays the DKP ranking for the guild (per-game).', 
        permissions: 'Members', 
        examples: ['/rank', '/rank odin'] 
      },
      { 
        name: '/rankreport <game>', 
        description: 'Generates a DKP rank report for a specific game as an Excel file.', 
        permissions: 'Administrators', 
        examples: ['/rankreport odin'] 
      },
    ]
  },
  Configuration: {
    description: 'Commands for configuring bot settings and permissions.',
    commands: [
      { 
        name: '/config role <game> <group> <role>', 
        description: 'Sets which role can run which command-group for a game.', 
        permissions: 'Administrators', 
        examples: ['/config role odin admin @AdminRole'] 
      },
      { 
        name: '/config dkp <game> <add|remove|edit|minimum> [name] [points]', 
        description: 'Manages DKP parameters or minimum points for a game.', 
        permissions: 'Administrators', 
        examples: ['/config dkp odin add bossKill 10', '/config dkp odin minimum 50'] 
      },
      { 
        name: '/config channel <game> <log|reminder> <#channel>', 
        description: 'Sets or clears the channel for log/reminder messages.', 
        permissions: 'Administrators', 
        examples: ['/config channel odin log #logs', '/config channel odin reminder #reminders'] 
      },
      { 
        name: '/config reminder <game> <add|remove|intervals> [parameter] [intervals]', 
        description: 'Manage which event parameters you want reminders for and at which intervals.', 
        permissions: 'Administrators', 
        examples: [
          '/config reminder odin add bossKill',
          '/config reminder odin intervals 1h,30m,10m',
        ]
      },
      { 
        name: '/config show <game> <parameters|channels|minimum|event|reminder>', 
        description: 'Shows current configuration of DKP parameters, channels, timers, or reminders.', 
        permissions: 'Administrators', 
        examples: ['/config show odin parameters', '/config show odin reminder'] 
      },
      { 
        name: '/config event <game> timer <minutes>', 
        description: 'Sets the default event timer length for a game.', 
        permissions: 'Administrators', 
        examples: ['/config event odin timer 15'] 
      },
      { 
        name: '/config game <add|remove|rename> [key] [name] [currency]', 
        description: 'Add, remove, or rename a game in this guild.', 
        permissions: 'Administrators', 
        examples: ['/config game add odin "Odin: Rise" crows'] 
      },
      { 
        name: '/config guildname <name>', 
        description: 'Sets the custom display name for this guild in embeds.', 
        permissions: 'Administrators', 
        examples: ['/config guildname "My Awesome Guild"'] 
      },
    ]
  },
  Event: {
    description: 'Commands for managing and participating in events.',
    commands: [
      { 
        name: '/event start <game> <parameter>', 
        description: 'Starts a DKP event for a given parameter in a game.', 
        permissions: 'Administrators, Moderators', 
        examples: ['/event start odin bossKill'] 
      },
      { 
        name: '/event end <game> <code>', 
        description: 'Ends the specified event and awards DKP.', 
        permissions: 'Administrators, Moderators', 
        examples: ['/event end odin AB3'] 
      },
      { 
        name: '/event cancel <game> <code>', 
        description: 'Cancels the event without awarding DKP.', 
        permissions: 'Administrators, Moderators', 
        examples: ['/event cancel odin AB3'] 
      },
      { 
        name: '/join <code>', 
        description: 'Join an active event by its code (auto-detects game).', 
        permissions: 'Members', 
        examples: ['/join AB3'] 
      },
      { 
        name: '/event rank <game> <parameter>', 
        description: 'Shows cumulative DKP earned across all events of that parameter.', 
        permissions: 'Members', 
        examples: ['/event rank odin bossKill'] 
      },
    ]
  },
  Crow: {
    description: 'Commands for managing “crows” in your guild bank.',
    commands: [
      { 
        name: '/crow add <game> <amount>', 
        description: 'Adds crows to the guild bank for a game.', 
        permissions: 'Administrators, Moderators', 
        examples: ['/crow add odin 100'] 
      },
      { 
        name: '/crow remove <game> <amount>', 
        description: 'Removes crows from the guild bank for a game.', 
        permissions: 'Administrators, Moderators', 
        examples: ['/crow remove odin 50'] 
      },
    ]
  },
  Reminder: {
    description: 'Commands for setting up spawn reminders on parameters.',
    commands: [
      { 
        name: '/reminder <game> <parameter(s)> <time(s)>', 
        description: 'Schedules countdown reminders (with pre-alerts) for event parameters.', 
        permissions: 'Members', 
        examples: [
          '/reminder odin bossKill 2h',
          '/reminder odin bossKill,dragon 1h30m,45m'
        ]
      },
    ]
  }
};

async function handleHelpCommand(interaction) {
  const cmd = interaction.options.getString('command');
  if (cmd) {
    const info = getDetailedCommandInfo(cmd);
    if (info) {
      return interaction.reply({ embeds: [ createInfoEmbed(`Help: ${cmd}`, info) ], ephemeral: true });
    } else {
      return interaction.reply({ content: 'Command not found.', ephemeral: true });
    }
  }

  // show full list
  const text = Object.entries(commandCategories)
    .map(([cat, { description, commands }]) => {
      const list = commands
        .map(c => `**${c.name}** – ${c.description} (Permissions: ${c.permissions})`)
        .join('\n');
      return `**${cat} Commands:**\n${description}\n${list}`;
    })
    .join('\n\n');

  return interaction.reply({ embeds: [ createInfoEmbed('Available Commands', text) ], ephemeral: true });
}

async function handleShowHelpCommand(interaction) {
  // same as /help but public
  const text = Object.entries(commandCategories)
    .map(([cat, { description, commands }]) => {
      const list = commands
        .map(c => `**${c.name}** – ${c.description}`)
        .join('\n');
      return `**${cat} Commands:**\n${description}\n${list}`;
    })
    .join('\n\n');

  return interaction.reply({ embeds: [ createInfoEmbed('Available Commands', text) ] });
}

function getDetailedCommandInfo(commandName) {
  const clean = commandName.startsWith('/') ? commandName : `/${commandName}`;
  for (const { commands } of Object.values(commandCategories)) {
    for (const cmd of commands) {
      if (cmd.name.split(' ')[0] === clean.split(' ')[0]) {
        const ex = cmd.examples.map(x => `\`${x}\``).join('\n');
        return `**Command:** ${cmd.name}\n**Description:** ${cmd.description}\n**Permissions:** ${cmd.permissions}\n**Examples:**\n${ex}`;
      }
    }
  }
  return null;
}

module.exports = { handleHelpCommand, handleShowHelpCommand };
