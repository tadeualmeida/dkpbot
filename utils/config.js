//utils/config.js
const GuildConfig = require('../schema/GuildConfig');
const configCache = new Map(); // guildId → GuildConfig document

/**
 * Carrega do cache ou do Mongo a configuração da guild,
 * criando um documento vazio caso não exista.
 */
async function loadGuildConfig(guildId) {
  if (configCache.has(guildId)) {
    return configCache.get(guildId);
  }

  let cfg = await GuildConfig.findOne({ guildId });
  if (!cfg) {
    cfg = await GuildConfig.create({ 
      guildId, 
      guildName: '',      // você poderá preencher via comando de setup
      games: [], 
      defaultGame: null 
    });
  }

  configCache.set(guildId, cfg);
  return cfg;
}

/**
 * Remove do cache (use sempre que alterar config via comandos).
 */
function invalidateGuildConfig(guildId) {
  configCache.delete(guildId);
}

module.exports = {
  loadGuildConfig,
  invalidateGuildConfig
};
