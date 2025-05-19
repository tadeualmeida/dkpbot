// utils/channelUtils.js

const { loadGuildConfig } = require('./config');
const { createInfoEmbed } = require('./embeds');

/**
 * Sends a single embed to the configured log channel for the given game.
 * If no channel is configured, silently does nothing.
 *
 * @param {CommandInteraction} interaction
 * @param {string} description      // já vem formatada com o executor e as linhas
 * @param {'dkp'|'event'|'crow'|string} messageType
 * @param {string} gameKey          // para buscar o canal correto
 */
async function sendMessageToConfiguredChannels(interaction, description, messageType, gameKey) {
  // 1) carrega configuração atualizada
  const cfg = await loadGuildConfig(interaction.guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  if (!game) return;               // jogo não encontrado
  const channelId = game.channels.log;
  if (!channelId) return;          // sem canal log configurado

  // 2) busca o canal
  const channel = interaction.client.channels.cache.get(channelId);
  if (!channel || !channel.send) return;

  // 3) título do embed
  let title;
  switch (messageType) {
    case 'dkp':   title = 'DKP Info';    break;
    case 'event': title = 'Event Info';  break;
    case 'crow':  title = 'Crow Info';   break;
    default:      title = 'Info';
  }

  // 4) envia
  await channel.send({
    embeds: [ createInfoEmbed(title, description) ]
  });
}

module.exports = { sendMessageToConfiguredChannels };
