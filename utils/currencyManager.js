//utils/currencyManager.js
const { loadGuildConfig } = require('./config');
const { refreshCurrencyCache } = require('./cacheManagement');

/**
 * Modify the currency total for a specific game in the guild’s config.
 * @param {string} guildId
 * @param {string} gameKey
 * @param {number} amount  Positive to add, negative to remove.
 * @throws {Error} if the game isn’t found or funds are insufficient.
 * @returns {{ name: string, total: number }} The updated currency object.
 */
async function modifyCurrency(guildId, gameKey, amount) {
  // Load (and cache) the GuildConfig
  const cfg = await loadGuildConfig(guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  if (!game) {
    throw new Error(`Game "${gameKey}" not found.`);
  }

  // Check sufficient funds on removal
  if (amount < 0 && game.currency.total + amount < 0) {
    throw new Error('Insufficient currency in the bank.');
  }

  // Apply change and persist
  game.currency.total += amount;
  await cfg.save();

  // Refresh the in-memory cache for this game’s currency
  await refreshCurrencyCache(guildId, gameKey);

  return game.currency;
}

/**
 * Fetch the current currency total for a specific game.
 * @param {string} guildId
 * @param {string} gameKey
 * @returns {number} 0 if not configured.
 */
async function getCurrency(guildId, gameKey) {
  const cfg = await loadGuildConfig(guildId);
  const game = cfg.games.find(g => g.key === gameKey);
  return game?.currency.total ?? 0;
}

module.exports = { modifyCurrency, getCurrency };
