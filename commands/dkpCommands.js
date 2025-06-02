// commands/dkpCommands.js

const {
  getDkpPointsFromCache,
  refreshDkpPointsCache,
  refreshDkpMinimumCache,
  getCurrencyFromCache,
  refreshCurrencyCache,
  refreshEligibleUsersCache,
  refreshDkpRankingCache,
  getGamesFromCache,
  getGuildCache
} = require('../utils/cacheManagement');

const {
  createMultipleResultsEmbed,
  createInfoEmbed
} = require('../utils/embeds');

const {
  fetchUserToModify,
  getUserDkpChanges,
  createBulkOperations,
  replyWithError,
  updateDkpTotal
} = require('../utils/generalUtils');

const { resolveGameKey } = require('../utils/resolveGameKey');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');
const { sendUserNotification } = require('../events/messageHandler');

const Dkp = require('../schema/Dkp');

/**
 * Entrypoint for all DKP slash commands:
 * delegates to the specific handler based on commandName
 */
async function handleDkpCommands(interaction) {
  switch (interaction.commandName) {
    case 'dkp':
      return handleDkpBalance(interaction, interaction.guildId, interaction.user.id);
    case 'rank':
      return handleDkpRank(interaction, interaction.guildId, interaction.member);
    case 'dkpadd':
      return handleDkpAddRemove(interaction, interaction.guildId, true, interaction.member);
    case 'dkpremove':
      return handleDkpAddRemove(interaction, interaction.guildId, false, interaction.member);
    default:
      return replyWithError(interaction, 'Error', 'Invalid DKP command.');
  }
}

/**
 * /dkp — show either all balances or a single-game balance
 */
async function handleDkpBalance(interaction, guildId, userId) {
  const explicit = interaction.options.getString('game')?.toLowerCase();
  const gamesArr = await getGamesFromCache(guildId);

  // find games where member has the "user" role
  const playable = gamesArr.filter(g =>
    g.roles.user.some(roleId =>
      interaction.member.roles.cache.has(roleId)
    )
  );

  // explicit request → single
  if (explicit) {
    return showSingleBalance(interaction, guildId, userId, explicit);
  }

  // exactly one → single
  if (playable.length === 1) {
    return showSingleBalance(interaction, guildId, userId, playable[0].key);
  }

  // none → error
  if (!playable.length) {
    return interaction.reply({ content: `You don't have access to any game.`, ephemeral: true });
  }

  // multiple → list all
  await interaction.deferReply({ ephemeral: true });

  // refresh caches for each playable game
  await Promise.all(playable.map(g =>
    Promise.all([
      refreshDkpPointsCache(guildId, g.key),
      refreshEligibleUsersCache(guildId, g.key),
      refreshCurrencyCache(guildId, g.key),
      refreshDkpMinimumCache(guildId, g.key),
    ])
  ));

  const lines = await Promise.all(playable.map(async g => {
    const [dkpRec, min, bank] = await Promise.all([
      getDkpPointsFromCache(guildId, g.key, userId),
      getDkpMinimumFromCache(guildId, g.key),
      getCurrencyFromCache(guildId, g.key)
    ]);

    const pts    = dkpRec?.points ?? 0;
    const needed = min - pts;
    const curr   = g.currency.name;
    const name   = g.name;

    if (min === 0 || pts >= min) {
      return `**${name}**: **${pts}** DKP — Bank: **${bank}** ${curr}`;
    } else {
      return `**${name}**: **${pts}** DKP (below min **${min}**, need **${needed}** more)`;
    }
  }));

  return interaction.editReply({
    embeds: [ createMultipleResultsEmbed('info', 'Your DKP Balances', lines) ]
  });
}

/**
 * Helper to show a single‐game balance
 */
async function showSingleBalance(interaction, guildId, userId, gameKey) {
  await interaction.deferReply({ ephemeral: true });

  await Promise.all([
    refreshDkpPointsCache(guildId, gameKey),
    refreshEligibleUsersCache(guildId, gameKey),
    refreshCurrencyCache(guildId, gameKey),
    refreshDkpMinimumCache(guildId, gameKey),
  ]);

  const [dkpRec, min, bank] = await Promise.all([
    getDkpPointsFromCache(guildId, gameKey, userId),
    getDkpMinimumFromCache(guildId, gameKey),
    getCurrencyFromCache(guildId, gameKey),
  ]);

  const pts         = dkpRec?.points ?? 0;
  const needed      = min - pts;
  const cfg         = (await getGamesFromCache(guildId)).find(g => g.key === gameKey) || {};
  const displayName = cfg.name   || gameKey;
  const currName    = cfg.currency?.name || 'Currency';

  const desc = (min === 0 || pts >= min)
    ? `You have **${pts}** DKP in **${displayName}**.\nBank: **${bank}** ${currName}.`
    : `You have **${pts}** DKP in **${displayName}**, below minimum **${min}**, need **${needed}** more.`;

  return interaction.editReply({
    embeds: [ createInfoEmbed(`DKP — ${displayName}`, desc) ]
  });
}

/**
 * /rank — per‐game only, resolves via roles or explicit option
 */
async function handleDkpRank(interaction, guildId, member, forcedGameKey) {
  // step 1: determine gameKey
  let gameKey = forcedGameKey
    || interaction.options.getString('game')?.toLowerCase()
    || null;

  if (!gameKey) {
    gameKey = await resolveGameKey(interaction, member);
    if (!gameKey) return; // user was prompted or errored
  }

  // step 2: fetch & show ranking
  await interaction.deferReply({ ephemeral: true });
  await refreshDkpRankingCache(guildId, gameKey);

  const ranking = await getDkpRankingFromCache(guildId, gameKey);
  if (!ranking.length) {
    return interaction.editReply({
      embeds: [ createInfoEmbed('No DKP Ranking', 'No ranking available for this game.') ]
    });
  }

  const userIds = ranking.map(r => r.userId);
  const members = await interaction.guild.members.fetch({ user: userIds });
  const nameMap = new Map(members.map(m => [m.user.id, m.displayName]));

  const cfg         = (await getGamesFromCache(guildId)).find(g => g.key === gameKey) || {};
  const displayName = cfg.name || gameKey;

  const lines = ranking.map((r, idx) => {
    const uname = nameMap.get(r.userId) || `<@${r.userId}>`;
    return `${idx + 1}. **${uname}** — ${r.points} points`;
  });

  return interaction.editReply({
    embeds: [ createMultipleResultsEmbed('info', `DKP Ranking — ${displayName}`, lines) ]
  });
}

/**
 * /dkpadd & /dkpremove — per‐game only, requires explicit game option
 */
async function handleDkpAddRemove(interaction, guildId, isAdd, member) {
  const rawGame = interaction.options.getString('game');
  if (!rawGame) {
    return replyWithError(interaction, 'Error', 'A game key is required.');
  }
  const gameKey = rawGame.toLowerCase();

  await interaction.deferReply({ ephemeral: true });

  // 0️⃣ Immediately refresh all relevant caches for that game
  await Promise.all([
    refreshDkpPointsCache(guildId, gameKey),
    refreshEligibleUsersCache(guildId, gameKey),
    refreshCurrencyCache(guildId, gameKey),
    refreshDkpMinimumCache(guildId, gameKey),
  ]);

  const pointsToModify   = interaction.options.getInteger('points');
  const userIDsInput     = interaction.options.getString('users');
  const descriptionInput = interaction.options.getString('description') || '';

  if (!userIDsInput) {
    return interaction.editReply({ content: 'You must specify at least one user ID.', ephemeral: true });
  }

  // parse and dedupe user IDs
  const userIDs = Array.from(new Set(
    userIDsInput.split(/[,\s]+/).map(s => s.replace(/<@!?(\d+)>/, '$1'))
  ));

  const participants = [];
  let totalPts = 0;

  for (const userId of userIDs) {
    const userToModify = await fetchUserToModify(userId, interaction);
    if (!userToModify) continue;

    // 1️⃣ Pass a real cache‐setter function so getUserDkpChanges can update after each change
    const cacheSetter = (gid) => getGuildCache(gid);

    const { pointChange, userDkp } = await getUserDkpChanges(
      guildId,
      gameKey,
      userId,
      pointsToModify,
      isAdd,
      Dkp,
      getDkpPointsFromCache,
      cacheSetter
    );

    participants.push({ userId, pointChange });
    totalPts += pointChange;

    // 2️⃣ DM the user via your queue
    await sendUserNotification(userToModify, pointChange, userDkp.points, descriptionInput);
  }

  if (participants.length) {
    // 3️⃣ Bulk‐write all transactions
    const bulkOps = createBulkOperations(
      participants,
      guildId,
      gameKey,
      isAdd ? pointsToModify : -pointsToModify,
      descriptionInput
    );
    await Dkp.bulkWrite(bulkOps);
    await updateDkpTotal(totalPts, guildId, gameKey);

    // 4️⃣ Refresh caches again after the DB write
    await Promise.all([
      refreshDkpPointsCache(guildId, gameKey),
      refreshEligibleUsersCache(guildId, gameKey),
      refreshDkpRankingCache(guildId, gameKey),
    ]);

    // 5️⃣ Build & send one log embed to the configured “dkp” (log) channel
    const actor = interaction.member.displayName || interaction.user.username;
    const actionLines = participants.map(p =>
      p.pointChange > 0
        ? `Added **${p.pointChange}** DKP to <@${p.userId}>`
        : `Removed **${Math.abs(p.pointChange)}** DKP from <@${p.userId}>`
    );
    const logDesc = `**${actor}**\n${actionLines.join('\n')}` +
      (descriptionInput ? `\n\nReason: **${descriptionInput}**` : '');

    await sendMessageToConfiguredChannels(interaction, logDesc, 'dkp', gameKey);
  }

  // 6️⃣ Finally, reply with a summary
  const results = participants.map(p =>
    p.pointChange > 0
      ? `Added **${p.pointChange}** DKP to <@${p.userId}>`
      : `Removed **${Math.abs(p.pointChange)}** DKP from <@${p.userId}>`
  );
  return interaction.editReply({
    embeds: [ createMultipleResultsEmbed('info', 'DKP Modification Results', results) ]
  });
}

module.exports = {
  handleDkpCommands,
  handleDkpBalance,
  handleDkpRank,
  handleDkpAddRemove
};
