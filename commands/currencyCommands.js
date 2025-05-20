// commands/currencyCommands.js

const {
  getGamesFromCache,
  getCurrencyFromCache,
  refreshCurrencyCache,
  getDkpMinimumFromCache,
  getEligibleUsersFromCache
} = require('../utils/cacheManagement');
const {
  createCurrencyUpdateEmbed,
  createCurrencyBalanceEmbed,
  createErrorEmbed
} = require('../utils/embeds');
const { modifyCurrency, getCurrency } = require('../utils/currencyManager');
const { isPositiveInteger, replyWithError } = require('../utils/generalUtils');
const { loadGuildConfig } = require('../utils/config');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');

async function handleCurrencyCommands(interaction) {
  const guildId = interaction.guildId;
  const cmd     = interaction.commandName;               // 'currency' or 'bank'
  const sub     = interaction.options.getSubcommand(false); // 'add'|'remove' or undefined
  const rawGame = interaction.options.getString('game');
  const gameKey = rawGame?.toLowerCase();

  // Defer reply so we can do async work
  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  try {
    if (cmd === 'currency') {
      // require gameKey
      if (!gameKey) {
        return replyWithError(interaction, 'Game Required', 'Use `/currency <game>` to select a game.');
      }
      if (sub !== 'add' && sub !== 'remove') {
        return replyWithError(interaction, 'Invalid Action', 'Use `/currency <game> add` or `/currency <game> remove`.');
      }
      return handleModifyCurrency(interaction, guildId, gameKey, sub === 'add');
    }

    if (cmd === 'bank') {
      return handleBank(interaction, guildId, gameKey);
    }

    // shouldn't happen
    return replyWithError(interaction, 'Unknown Command', 'This command is not supported.');
  } catch (err) {
    console.error('💥 currency handler error:', err);
    return replyWithError(interaction, 'Internal Error', err.message || 'Something went wrong.');
  }
}

async function handleModifyCurrency(interaction, guildId, gameKey, isAdd) {
  const amount = interaction.options.getInteger('amount');
  if (!isPositiveInteger(amount)) {
    return replyWithError(interaction, 'Invalid Amount', 'Please provide a positive integer.');
  }

  const delta      = isAdd ? amount : -amount;
  const cfg        = await loadGuildConfig(guildId);
  const gameCfg    = cfg.games.find(g => g.key === gameKey);
  if (!gameCfg) {
    return replyWithError(interaction, 'Game Not Found', `There's no game with key \`${gameKey}\`.`);
  }
  const gameName   = gameCfg.name;
  const currName   = gameCfg.currency.name;

  // Perform update in database
  const updated = await modifyCurrency(guildId, gameKey, delta);

  // Refresh cache
  await refreshCurrencyCache(guildId, gameKey);

  // 1) Log into configured channel (if any)
  const actor   = interaction.member.displayName || interaction.user.username;
  const action  = isAdd ? 'added' : 'removed';
  const logDesc = `**${actor}** ${action} **${amount}** ${currName} ${isAdd ? 'to' : 'from'} **${gameName}** bank. New total: **${updated.currency.total}** ${currName}.`;
  await sendMessageToConfiguredChannels(
    interaction,
    logDesc,
    'currency',   // you can use 'crow' if you still want that embed style key
    gameKey
  );

  // 2) Reply to the user
  return interaction.editReply({
    embeds: [
      createCurrencyUpdateEmbed(
        delta,
        updated.currency.total,
        gameName,
        currName
      )
    ]
  });
}

async function handleBank(interaction, guildId, explicitGameKey) {
  const games = await getGamesFromCache(guildId);

  // If user specified a game, show just that one
  if (explicitGameKey) {
    const game = games.find(g => g.key === explicitGameKey);
    if (!game) {
      return replyWithError(interaction, 'Game Not Found', `No game with key \`${explicitGameKey}\`.`);
    }

    await refreshCurrencyCache(guildId, explicitGameKey);
    const total = await getCurrency(guildId, explicitGameKey);

    return interaction.editReply({
      embeds: [
        createCurrencyBalanceEmbed([
          `**${game.name}**: **${total}** ${game.currency.name}`
        ])
      ]
    });
  }

  // Otherwise, list all games at once
  await Promise.all(games.map(g => refreshCurrencyCache(guildId, g.key)));

  // (Optional) show estimated crows per DKP if you want:
  // const [min, elig] = await Promise.all([
  //   getDkpMinimumFromCache(guildId),
  //   getEligibleUsersFromCache(guildId)
  // ]);
  // const totalDkp = elig.reduce((sum, u) => sum + u.points, 0);

  const lines = await Promise.all(games.map(async g => {
    const total = await getCurrency(guildId, g.key);
    return `**${g.name}**: **${total}** ${g.currency.name}`;
  }));

  return interaction.editReply({
    embeds: [ createCurrencyBalanceEmbed(lines) ]
  });
}

module.exports = { handleCurrencyCommands };
