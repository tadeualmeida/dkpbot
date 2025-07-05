// File: commands/bidCommands.js
const { ChannelType } = require('discord.js');
const Auction = require('../schema/Auction');
const Bid = require('../schema/Bid');
const { enqueueAction } = require('../utils/messageQueue');
const { createInfoEmbed, createErrorEmbed } = require('../utils/embeds');
const {
  getDkpPointsFromCache,
  getGamesFromCache,
  refreshOpenAuctionsCache
} = require('../utils/cacheManagement');
const {
  scheduleAuctionClose,
  cancelAuctionSchedule
} = require('../utils/auctionScheduler');

async function handleBidCommand(interaction) {
  const guildId  = interaction.guild.id;
  const threadId = interaction.channelId;
  const userId   = interaction.user.id;

  // Only inside threads
  if (![ChannelType.PublicThread, ChannelType.PrivateThread].includes(interaction.channel.type)) {
    return interaction.reply({
      embeds: [createErrorEmbed(
        'Invalid Context',
        'You can only place bids inside an auction thread.'
      )],
      ephemeral: true
    });
  }

  // Find the active auction for this thread
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

  // Load game config (mode, currency name, bid extend)
  const games   = await getGamesFromCache(guildId);
  const gameCfg = games.find(g => g.key === auction.gameKey);
  const auctionMode    = gameCfg.auctionMode || 'currency'; // 'currency' or 'dkp'
  const currencyName   = auctionMode === 'currency'
    ? gameCfg.currency.name
    : 'DKP';
  const bidExtendMin   = gameCfg.auctionBidExtend ?? 0;

  // User's DKP balance
  const dkpRec  = await getDkpPointsFromCache(guildId, auction.gameKey, userId);
  const userDkp = dkpRec?.points ?? 0;

  // Determine minimum bid
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

  // Calculate DKP reserved in other open auctions (top bid per auction)
  const openAuctions = await Auction.find({ guildId, gameKey: auction.gameKey, status: 'open' });
  let reserved = 0;
  for (const other of openAuctions) {
    const top = await Bid.findOne({ auction: other._id }).sort({ amount: -1 });
    if (top?.userId === userId) reserved += top.amount;
  }

  // Check DKP sufficiency
  if (auctionMode === 'currency') {
    // need minimumDkp × qty plus reserved
    const required = auction.item.category.minimumDkp * auction.quantity;
    if (userDkp < reserved + required) {
      return interaction.reply({
        embeds: [createErrorEmbed(
          'Insufficient DKP',
          `You need **${required}** DKP + **${reserved}** reserved = **${reserved + required}** total (you have **${userDkp}**).`
        )],
        ephemeral: true
      });
    }
  } else {
    // DKP-mode: reserve bid value plus reserved
    if (userDkp < reserved + value) {
      return interaction.reply({
        embeds: [createErrorEmbed(
          'Insufficient DKP',
          `You need **${value}** DKP + **${reserved}** reserved = **${reserved + value}** total (you have **${userDkp}**).`
        )],
        ephemeral: true
      });
    }
  }

  // Keep track of the previous top bid
  const previousHighest = highest;

  // Record the new bid
  await Bid.create({
    guildId,
    gameKey:      auction.gameKey,
    auction:      auction._id,
    userId,
    displayName:  interaction.member.displayName,
    amount:       value,
    placedAt:     new Date()
  });

  // Announce in the auction thread
  await interaction.channel.send(
    `💰 <@${userId}> placed a bid of **${value}** ${currencyName}!`
  );

  // 🔟 Notify the previous highest bidder via DM
  if (previousHighest && previousHighest.userId !== userId) {
    const threadLink = `https://discord.com/channels/${guildId}/${threadId}`;
    const dmEmbed = createInfoEmbed(
      'Outbid Notice',
      `Your bid of **${previousHighest.amount}** was outbid by **${value}** ${currencyName}.\n` +
      `Check the auction here: ${threadLink}`
    );
    enqueueAction(async () => {
      const user = await interaction.client.users.fetch(previousHighest.userId);
      return user?.send({ embeds: [dmEmbed] });
    });
  }

  // Conditionally extend auction time:
  //      only if remaining time < bidExtendMin
  if (bidExtendMin > 0 && previousHighest) {
    const now       = Date.now();
    const endMillis = auction.endTimestamp.getTime();
    const remainMs  = endMillis - now;
    const extendMs  = bidExtendMin * 60000;

    if (remainMs < extendMs) {
      // bump endTimestamp by exactly bidExtendMin
      auction.endTimestamp = new Date(endMillis + extendMs);
      await auction.save();
      await refreshOpenAuctionsCache(guildId, auction.gameKey);

      // reschedule its jobs
      cancelAuctionSchedule(auction._id);
      scheduleAuctionClose(auction, interaction.client);

      // notify in thread
      await interaction.channel.send(
        `⏱ Auction extended by **${bidExtendMin}** minutes due to new bid!`
      );
    }
  }

  // Acknowledge to the bidder
  return interaction.reply({
    embeds: [createInfoEmbed(
      'Bid Placed',
      `Your bid of **${value}** ${currencyName} has been placed!`
    )],
    ephemeral: true
  });
}

module.exports = { handleBidCommand };
