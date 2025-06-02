// utils/generalUtils.js

const validator = require('validator');
const { createErrorEmbed } = require('./embeds');
const { loadGuildConfig, invalidateGuildConfig } = require('../utils/config');

/**
 * participants: [{ userId, pointChange }]
 * guildId: string
 * gameKey: string
 * dkpPoints: number (positivo ou negativo)
 * description: string
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function createBulkOperations(participants, guildId, gameKey, dkpPoints, description = '') {
  if (!Array.isArray(participants)) {
    throw new TypeError("participants must be an array");
  }
  if (typeof dkpPoints !== 'number') {
    throw new TypeError("dkpPoints must be a number");
  }

  return participants.map(participant => ({
    updateOne: {
      filter: { guildId, gameKey, userId: participant.userId },
      update: {
        $inc: { points: participant.pointChange },
        $push: {
          transactions: {
            type: participant.pointChange > 0 ? 'add' : 'remove',
            amount: Math.abs(participant.pointChange),
            description
          }
        }
      },
      upsert: true
    }
  }));
}

async function fetchGuildMember(guild, userId) {
  return guild.members.fetch(userId).catch(() => null);
}

async function fetchUserToModify(userID, interaction) {
  if (!/^\d+$/.test(userID)) {
    const username = validator.escape(userID);
    return interaction.guild.members.cache.find(m =>
      validator.escape(m.user.username) === username
    ) || null;
  }
  return interaction.guild.members.fetch(userID).catch(() => null);
}

/**
 * Returns { pointChange, userDkp }
 * If getGuildCache is a valid function, writes the updated DKP back into cache.
 */
async function getUserDkpChanges(
  guildId,
  gameKey,
  userID,
  pointsToModify,
  isAdd,
  Dkp,
  getDkpPointsFromCache,
  getGuildCache
) {
  let pointChange = isAdd ? pointsToModify : -pointsToModify;

  // Fetch or create the DKP record from the persisted DB via cache
  let userDkp = await getDkpPointsFromCache(guildId, gameKey, userID);
  if (!userDkp) {
    userDkp = await Dkp.create({ guildId, gameKey, userId: userID, points: 0 });
  }

  // Prevent going negative
  if (!isAdd && userDkp.points + pointChange < 0) {
    pointChange = -userDkp.points;
  }
  userDkp.points += pointChange;

  // If provided a valid getGuildCache, update the in‐memory cache
  if (typeof getGuildCache === 'function') {
    const cache = getGuildCache(guildId);
    if (cache && typeof cache.set === 'function') {
      cache.set(`dkpPoints:${gameKey}:${userID}`, userDkp);
    }
  }

  return { pointChange, userDkp };
}

async function replyWithError(interaction, title, description) {
  const embed = createErrorEmbed(title, description);
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp({ embeds: [embed], ephemeral: true });
  }
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Incrementa totalDkp dentro do objeto de jogo no GuildConfig
 */
async function updateDkpTotal(pointsToModify, guildId, gameKey) {
  const cfg = await loadGuildConfig(guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  if (!game) return null;

  game.totalDkp = (game.totalDkp || 0) + pointsToModify;
  await cfg.save();
  invalidateGuildConfig(guildId);
  return game.totalDkp;
}

// Helper to fetch gameName from config
async function getGameName(guildId, gameKey) {
  const cfg = await loadGuildConfig(guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  return game?.name || gameKey;
}

module.exports = {
  createBulkOperations,
  fetchGuildMember,
  fetchUserToModify,
  getUserDkpChanges,
  replyWithError,
  updateDkpTotal,
  isPositiveInteger,
  getGameName
};
