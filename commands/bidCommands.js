// File: commands/bidCommands.js
const { ChannelType } = require('discord.js');
const Auction = require('../schema/Auction');
const Bid     = require('../schema/Bid');
const { enqueueAction }    = require('../utils/messageQueue');
const { createInfoEmbed, createErrorEmbed } = require('../utils/embeds');
const { getDkpPointsFromCache, getGamesFromCache } = require('../utils/cacheManagement');

async function handleBidCommand(interaction) {
  const guildId  = interaction.guild.id;
  const threadId = interaction.channelId;
  const userId   = interaction.user.id;

  // 1) only in thread
  if (![ChannelType.PublicThread, ChannelType.PrivateThread].includes(interaction.channel.type)) {
    return interaction.reply({
      embeds: [createInfoEmbed(
        'Invalid Context',
        'You can only place bids inside an auction thread.'
      )],
      ephemeral: true
    });
  }

  // 2) find auction
  const auction = await Auction.findOne({
    guildId,
    threadId,
    status: 'open'
  }).populate({ path: 'item', populate: 'category' });

  if (!auction) {
    return interaction.reply({
      embeds: [createInfoEmbed('No Auction', 'No active auction found for this thread.')],
      ephemeral: true
    });
  }

  // 2.1) DKP sufficiency
  const dkpRec   = await getDkpPointsFromCache(guildId, auction.gameKey, userId);
  const userDkp  = dkpRec?.points ?? 0;

  // reserved DKP in other open auctions
  const otherAuctions = await Auction.find({
    guildId,
    gameKey: auction.gameKey,
    status: 'open'
  }).populate({ path: 'item', populate: 'category' });

  let reserved = 0;
  for (const o of otherAuctions) {
    const top = await Bid.findOne({ auction: o._id }).sort({ amount: -1 });
    if (top?.userId === userId) {
      reserved += o.quantity * o.item.category.minimumDkp;
    }
  }
  const needDkp = auction.quantity * auction.item.category.minimumDkp;
  if (userDkp < reserved + needDkp) {
    return interaction.reply({
      embeds: [createErrorEmbed(
        'Insufficient DKP',
        `You have **${userDkp}** DKP, but **${reserved + needDkp}** is required ` +
        `(including **${reserved}** already reserved).`
      )],
      ephemeral: true
    });
  }

  // 3) min bid
  const value     = interaction.options.getInteger('value');
  const highest   = await Bid.findOne({ auction: auction._id }).sort({ amount: -1 });
  const increment = auction.item.category.bidIncrement * auction.quantity;
  const minBid    = highest
    ? highest.amount + increment
    : auction.startingPrice;

  if (value < minBid) {
    return interaction.reply({
      embeds: [createErrorEmbed('Bid Too Low', `Your bid must be at least **${minBid}**.`)],
      ephemeral: true
    });
  }

  // 2.5) fetch currency name
  const gamesArr    = await getGamesFromCache(guildId);
  const gameCfg     = gamesArr.find(g => g.key === auction.gameKey);
  const currencyName = gameCfg.currency.name;

  const previousHighest = highest;

  // 4) record bid
  await Bid.create({
    guildId,
    gameKey:  auction.gameKey,
    auction:  auction._id,
    userId,
    displayName: interaction.member.displayName,
    amount:   value,
    placedAt: new Date()
  });

  // 5) announce in thread with currency
  await interaction.channel.send(
    `💰 <@${userId}> placed a bid of **${value}** ${currencyName}!`
  );

  // 6) notify outbid user
  if (previousHighest && previousHighest.userId !== userId) {
    const threadLink = `https://discord.com/channels/${guildId}/${threadId}`;
    const dmEmbed = createInfoEmbed(
      'Outbid Notice',
      `Your bid of **${previousHighest.amount}** was outbid by **${value}**.\n` +
      `Check the auction here: ${threadLink}`
    );
    enqueueAction(async () => {
      const user = await interaction.client.users.fetch(previousHighest.userId);
      return user?.send({ embeds: [dmEmbed] });
    });
  }

  // 7) ack
  return interaction.reply({
    embeds: [createInfoEmbed(
      'Bid Placed',
      `Your bid of **${value}** ${currencyName} has been placed!`
    )],
    ephemeral: true
  });
}

module.exports = { handleBidCommand };
