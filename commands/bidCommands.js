// File: commands/bidCommands.js
const { ChannelType } = require('discord.js');
const Auction         = require('../schema/Auction');
const Bid             = require('../schema/Bid');
const { enqueueAction } = require('../utils/messageQueue');
const { createInfoEmbed, createErrorEmbed } = require('../utils/embeds');
const {
  getDkpPointsFromCache,
  getGamesFromCache
} = require('../utils/cacheManagement');

async function handleBidCommand(interaction) {
  const guildId  = interaction.guild.id;
  const threadId = interaction.channelId;
  const userId   = interaction.user.id;

  // 1️⃣ Só em threads
  if (![ChannelType.PublicThread, ChannelType.PrivateThread].includes(interaction.channel.type)) {
    return interaction.reply({
      embeds: [createErrorEmbed(
        'Invalid Context',
        'You can only place bids inside an auction thread.'
      )],
      ephemeral: true
    });
  }

  // 2️⃣ Busca a auction aberta desta thread
  const auction = await Auction.findOne({
    guildId,
    threadId,
    status: 'open'
  }).populate({ path: 'item', populate: 'category' });

  if (!auction) {
    return interaction.reply({
      embeds: [createErrorEmbed(
        'No Auction',
        'No active auction found for this thread.'
      )],
      ephemeral: true
    });
  }

  // 3️⃣ Configuração do jogo: modo e nome da currency
  const games   = await getGamesFromCache(guildId);
  const gameCfg = games.find(g => g.key === auction.gameKey);
  const auctionMode  = gameCfg.auctionMode || 'currency'; // 'currency' ou 'dkp'
  const currencyName = auctionMode === 'currency'
    ? gameCfg.currency.name
    : 'DKP';

  // 4️⃣ Saldo de DKP do usuário
  const dkpRec  = await getDkpPointsFromCache(guildId, auction.gameKey, userId);
  const userDkp = dkpRec?.points ?? 0;

  // 5️⃣ Lance mínimo (startingPrice ou highest + increment)
  const value     = interaction.options.getInteger('value');
  const highest   = await Bid.findOne({ auction: auction._id }).sort({ amount: -1 });
  const increment = auction.item.category.bidIncrement * auction.quantity;
  const minBid    = highest
    ? highest.amount + increment
    : auction.startingPrice;

  if (value < minBid) {
    return interaction.reply({
      embeds: [createErrorEmbed(
        'Bid Too Low',
        `Your bid must be at least **${minBid}** ${currencyName}.`
      )],
      ephemeral: true
    });
  }

  // 6️⃣ Calcula DKP reservado em outras auctions abertas (top bid por auction)
  const openAuctions = await Auction.find({
    guildId,
    gameKey: auction.gameKey,
    status: 'open'
  });
  let reserved = 0;
  for (const other of openAuctions) {
    const top = await Bid.findOne({ auction: other._id })
      .sort({ amount: -1 });
    if (top?.userId === userId) reserved += top.amount;
  }

  // 7️⃣ Verifica suficiência de DKP para o modo selecionado
  if (auctionMode === 'currency') {
    // precisa ter DKP mínimo da categoria × quantidade, mais o reservado
    const required = auction.item.category.minimumDkp * auction.quantity;
    if (userDkp < reserved + required) {
      return interaction.reply({
        embeds: [createErrorEmbed(
          'Insufficient DKP',
          `You need **${required}** DKP plus **${reserved}** reserved = **${reserved + required}** total (you have **${userDkp}**).`
        )],
        ephemeral: true
      });
    }
  } else {
    // modo DKP: bloqueia DKP equivalente ao lance proposto + reservado
    if (userDkp < reserved + value) {
      return interaction.reply({
        embeds: [createErrorEmbed(
          'Insufficient DKP',
          `You need **${value}** DKP plus **${reserved}** reserved = **${reserved + value}** total (you have **${userDkp}**).`
        )],
        ephemeral: true
      });
    }
  }

  // 8️⃣ Grava o lance
  const previousHighest = highest;
  await Bid.create({
    guildId,
    gameKey:   auction.gameKey,
    auction:   auction._id,
    userId,
    displayName: interaction.member.displayName,
    amount:    value,
    placedAt:  new Date()
  });

  // 9️⃣ Anuncia no thread
  await interaction.channel.send(
    `💰 <@${userId}> placed a bid of **${value}** ${currencyName}!`
  );

  // 🔟 Notifica por DM o lance anterior, se houver e for de outro usuário
  if (previousHighest && previousHighest.userId !== userId) {
    const threadLink = `https://discord.com/channels/${guildId}/${threadId}`;
    const dmEmbed = createInfoEmbed(
      'Outbid Notice',
      `Your bid of **${previousHighest.amount}** was outbid by **${value}** ${currencyName}.\n` +
      `Check it here: ${threadLink}`
    );
    enqueueAction(async () => {
      const user = await interaction.client.users.fetch(previousHighest.userId);
      return user?.send({ embeds: [dmEmbed] });
    });
  }

  // 1️⃣1️⃣ Confirma ao autor
  return interaction.reply({
    embeds: [createInfoEmbed(
      'Bid Placed',
      `Your bid of **${value}** ${currencyName} has been placed!`
    )],
    ephemeral: true
  });
}

module.exports = { handleBidCommand };
