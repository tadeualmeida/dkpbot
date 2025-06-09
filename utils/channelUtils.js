// utils/channelUtils.js

const { loadGuildConfig } = require('./config');
const { createInfoEmbed } = require('./embeds');
const { enqueueAction } = require('./messageQueue')

/**
 * Sends a single embed to the configured channel for the given game.
 * If no channel is configured, silently does nothing.
 *
 * @param {CommandInteraction} interaction
 * @param {string} description      // already formatted with executor and lines
 * @param {'dkp'|'event'|'crow'|'reminder'|string} messageType
 * @param {string} gameKey          // to look up the right game in config
 */
async function sendMessageToConfiguredChannels(interaction, description, messageType, gameKey) {
  // 1) load the latest config
  const cfg  = await loadGuildConfig(interaction.guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  if (!game) return;            // no such game

  // 2) choose the correct channel based on messageType
  let channelId;
  if (messageType === 'reminder') {
    channelId = game.channels.reminder;
  } else {
    // all other types default to the log channel
    channelId = game.channels.log;
  }
  if (!channelId) return;       // channel not set

  // 3) fetch the channel
  const channel = interaction.client.channels.cache.get(channelId);
  if (!channel || typeof channel.send !== 'function') return;

  // 4) build an appropriate title for the embed
  let title;
  switch (messageType) {
    case 'dkp':      title = 'DKP Info';    break;
    case 'event':    title = 'Event Info';  break;
    case 'crow':     title = 'Crow Info';   break;
    case 'reminder': title = 'Reminder';    break;
    case 'info':     title = 'Info';        break;
    default:         title = 'Info';
  }

  const embedPayload = { embeds: [ createInfoEmbed(title, description) ] };

  // Instead of channel.send(embedPayload) directly, enqueue it:
  enqueueAction(() => channel.send(embedPayload));
}

module.exports = { sendMessageToConfiguredChannels };
