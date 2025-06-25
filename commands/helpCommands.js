// File: commands/helpCommands.js
const { EmbedBuilder } = require('discord.js');
const { createInfoEmbed } = require('../utils/embeds');

const commandCategories = {
  General: {
    description: 'General commands for basic bot operations.',
    commands: [
      { name: '/help', description: 'Lists all available commands.', permissions: 'Members', examples: ['/help', '/help dkp'] },
      { name: '/showhelp', description: 'Displays commands to everyone in the channel.', permissions: 'Administrators, Moderators', examples: ['/showhelp'] },
      { name: '/bank', description: 'Shows the guild bank.', permissions: 'Members', examples: ['/bank'] },
      { name: '/reset', description: 'Resets all DKP, events, and bank.', permissions: 'Administrators', examples: ['/reset'] }
    ]
  },
  DKP: {
    description: 'Manage and view DKP points.',
    commands: [
      { name: '/dkp', description: 'Your current DKP balance.', permissions: 'Members', examples: ['/dkp'] },
      { name: '/dkp add <users> <points>', description: 'Add DKP to users.', permissions: 'Admins, Mods', examples: ['/dkp add @u1 10'] },
      { name: '/dkp remove <users> <points>', description: 'Remove DKP from users.', permissions: 'Admins, Mods', examples: ['/dkp remove @u1 5'] },
      { name: '/rank', description: 'Guild DKP ranking.', permissions: 'Members', examples: ['/rank'] },
      { name: '/rankreport', description: 'Export DKP ranking report.', permissions: 'Administrators', examples: ['/rankreport'] }
    ]
  },
  Configuration: {
    description: 'Bot configuration and permissions.',
    commands: [
      { name: '/config dkp add|remove|edit|minimum <game> <name> <points>', description: 'Manage DKP parameters.', permissions: 'Administrators', examples: ['/config dkp add bossKill 10'] },
      { name: '/config role <game> <group> <@role>', description: 'Set command‐group roles.', permissions: 'Administrators', examples: ['/config role dkp mod @ModRole'] },
      { name: '/config channel <game> <type> <#channel>', description: 'Set log/auction/reminder channels.', permissions: 'Administrators', examples: ['/config channel dkp auction #auctions'] },
      { name: '/config event timer <game> <minutes>', description: 'Default event timer.', permissions: 'Administrators', examples: ['/config event timer dkp 15'] },
      { name: '/config show <game> <what>', description: 'View current settings.', permissions: 'Administrators', examples: ['/config show dkp channels'] },
      { name: '/config category add <game> <name> <minDkp> <minCurrency> <bidIncrement>', description: 'Add an auction category.', permissions: 'Administrators', examples: ['/config category add dkp Helm 10 100 5'] },
      { name: '/config category remove <game> <name>', description: 'Remove an auction category.', permissions: 'Administrators', examples: ['/config category remove dkp Helm'] },
      { name: '/config category edit <game> <name> <newName> <minDkp> <minCurrency> <bidIncrement>', description: 'Edit an auction category.', permissions: 'Administrators', examples: ['/config category edit dkp Helm Helm2 15 150 10'] },
      { name: '/config item add <game> <name> <category> <image>', description: 'Add an item with optional image.', permissions: 'Administrators', examples: ['/config item add dkp Advari Helm advari.png'] },
      { name: '/config item remove <game> <name>', description: 'Remove an item.', permissions: 'Administrators', examples: ['/config item remove dkp Advari'] },
      { name: '/config item edit <game> <name> [newName] [category] [image]', description: 'Edit item properties.', permissions: 'Administrators', examples: ['/config item edit dkp Advari newAdvari', '/config item edit dkp Advari category:Helm image:advari2.png'] },
      { name: '/config auction timer <game> <duration>', description: 'Default new auction duration (e.g. 1h30m).', permissions: 'Administrators', examples: ['/config auction timer dkp 1h'] }
    ]
  },
  Event: {
    description: 'Create and manage timed events.',
    commands: [
      { name: '/event start <game> <parameter>', description: 'Start an event.', permissions: 'Admins, Mods', examples: ['/event start dkp bossKill'] },
      { name: '/event end <game> <code>', description: 'End an event.', permissions: 'Admins, Mods', examples: ['/event end AB3'] },
      { name: '/event cancel <game> <code>', description: 'Cancel an event.', permissions: 'Admins, Mods', examples: ['/event cancel AB3'] },
      { name: '/join <code>', description: 'Join an active event.', permissions: 'Members', examples: ['/join AB3'] },
      { name: '/event rank <game> <parameter>', description: 'View event reminder ranking.', permissions: 'Members', examples: ['/event rank dkp bossKill'] }
    ]
  },
  Currency: {
    description: 'Manage the guild bank.',
    commands: [
      { name: '/currency add <game> <amount>', description: 'Add currency to bank.', permissions: 'Admins, Mods', examples: ['/currency add dkp 100'] },
      { name: '/currency remove <game> <amount>', description: 'Remove currency from bank.', permissions: 'Admins, Mods', examples: ['/currency remove dkp 50'] }
    ]
  },
  Auction: {
    description: 'Start and run DKP auctions.',
    commands: [
      { name: '/auction start <game> <item> <quantity>', description: 'Begin an auction.', permissions: 'Mods, Admins', examples: ['/auction start dkp advari 2'] },
      { name: '/auction edit <game> <auctionId> [quantity] [duration]', description: 'Adjust quantity and/or duration.', permissions: 'Mods, Admins', examples: ['/auction edit dkp 123abc 3', '/auction edit dkp 123abc duration:1h30m'] },
      { name: '/auction end <game> <auctionId>', description: 'End an auction now.', permissions: 'Mods, Admins', examples: ['/auction end dkp 123abc'] },
      { name: '/auction cancel <game> <auctionId>', description: 'Cancel and delete an auction.', permissions: 'Mods, Admins', examples: ['/auction cancel dkp 123abc'] },
      { name: '/auction history <game>', description: 'List auctions closed in last 24h.', permissions: 'Members', examples: ['/auction history dkp'] },
      { name: '/bid <value>', description: 'Place a bid inside an auction thread.', permissions: 'Members', examples: ['/bid 150'] }
    ]
  }
};

async function handleHelpCommand(interaction) {
  const cmdName = interaction.options.getString('command');
  if (cmdName) {
    const detail = getDetailed(cmdName);
    if (!detail) {
      return interaction.reply({ content: 'Command not found.', ephemeral: true });
    }
    const embed = createInfoEmbed(`Help: ${cmdName}`, detail);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // build one embed per category
  const embeds = [];
  for (const [category, { description, commands }] of Object.entries(commandCategories)) {
    const embed = new EmbedBuilder()
      .setTitle(`${category} Commands`)
      .setDescription(description)
      .setColor('Blue');
    for (const cmd of commands) {
      embed.addFields({
        name: cmd.name,
        value: `${cmd.description}\n*(Permissions: ${cmd.permissions})*`,
        inline: false
      });
    }
    embeds.push(embed);
  }

  return interaction.reply({ embeds, ephemeral: true });
}

async function handleShowHelpCommand(interaction) {
  // same as above, but public
  const embeds = [];
  for (const [category, { description, commands }] of Object.entries(commandCategories)) {
    const embed = new EmbedBuilder()
      .setTitle(`${category} Commands`)
      .setDescription(description)
      .setColor('Blue');
    for (const cmd of commands) {
      embed.addFields({
        name: cmd.name,
        value: `${cmd.description}\n*(Permissions: ${cmd.permissions})*`,
        inline: false
      });
    }
    embeds.push(embed);
  }
  return interaction.reply({ embeds });
}

function getDetailed(name) {
  const clean = name.startsWith('/') ? name : `/${name}`;
  for (const { commands } of Object.values(commandCategories)) {
    for (const cmd of commands) {
      if (cmd.name.split(' ')[0] === clean.split(' ')[0]) {
        return (
          `**Command:** ${cmd.name}\n` +
          `**Description:** ${cmd.description}\n` +
          `**Permissions:** ${cmd.permissions}\n` +
          `**Examples:**\n${cmd.examples.map(e => `\`${e}\``).join('\n')}`
        );
      }
    }
  }
  return null;
}

module.exports = { handleHelpCommand, handleShowHelpCommand };
