// File: commands/bidCommands.js
const { ChannelType } = require('discord.js');
const Auction = require('../schema/Auction');
const Bid = require('../schema/Bid');
const { enqueueAction } = require('../utils/messageQueue');
const { createInfoEmbed, createErrorEmbed } = require('../utils/embeds');
const { getDkpPointsFromCache } = require('../utils/cacheManagement');

/**
 * Handler for /bid commands
 */
async function handleBidCommand(interaction) {
  const guildId  = interaction.guild.id;
  const threadId = interaction.channelId;
  const userId   = interaction.user.id;

  // 1️⃣ Only inside a thread
  if (![ChannelType.PublicThread, ChannelType.PrivateThread].includes(interaction.channel.type)) {
    return interaction.reply({
      embeds: [createInfoEmbed('Invalid Context', 'You can only place bids inside an auction thread.')],
      ephemeral: true
    });
  }

  // 2️⃣ Find the active auction for this thread
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

  // 2️⃣• DKP sufficiency check
  // 2.1) total DKP the user has
  const dkpRecord = await getDkpPointsFromCache(guildId, auction.gameKey, userId);
  const userDkp   = dkpRecord?.points ?? 0;

  // 2.2) DKP already reserved by this user as highest bidder in other open auctions
  const otherAuctions = await Auction.find({
    guildId,
    gameKey: auction.gameKey,
    status: 'open'
  }).populate({ path: 'item', populate: 'category' });

  let reservedDkp = 0;
  for (const auc of otherAuctions) {
    const topBid = await Bid.findOne({ auction: auc._id }).sort({ amount: -1 });
    if (topBid?.userId === userId) {
      reservedDkp += auc.quantity * auc.item.category.minimumDkp;
    }
  }

  // 2.3) DKP needed for *this* auction
  const neededDkp = auction.quantity * auction.item.category.minimumDkp;

  if (userDkp < reservedDkp + neededDkp) {
    return interaction.reply({
      embeds: [createErrorEmbed(
        'Insufficient DKP',
        `You have **${userDkp}** DKP, but **${reservedDkp + neededDkp}** is required ` +
        `(including **${reservedDkp}** already reserved).`
      )],
      ephemeral: true
    });
  }

  // 3️⃣ Calculate minimum allowable bid using bidIncrement
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

  // Keep previous highest bid to notify later
  const previousHighest = highest;

  // 4️⃣ Record the new bid
  await Bid.create({
    guildId,
    gameKey:  auction.gameKey,
    auction:  auction._id,
    userId,
    amount:   value,
    placedAt: new Date()
  });

  // 5️⃣ Announce in the auction thread
  await interaction.channel.send(
    `💰 <@${userId}> placed a bid of **${value}**!`
  );

  // 6️⃣ Notify the previous highest bidder via messageQueue with an embed
  if (previousHighest && previousHighest.userId !== userId) {
    const threadLink = `https://discord.com/channels/${guildId}/${threadId}`;
    const dmEmbed = createInfoEmbed(
      'Outbid Notice',
      `Your bid of **${previousHighest.amount}** was outbid by **${value}**.\n` +
      `Check the auction here: ${threadLink}`
    );
    enqueueAction(async () => {
      const user = await interaction.client.users.fetch(previousHighest.userId);
      return user.send({ embeds: [dmEmbed] });
    });
  }

  // 7️⃣ Acknowledge to the bidder
  return interaction.reply({
    embeds: [createInfoEmbed('Bid Placed', `Your bid of **${value}** has been placed!`)],
    ephemeral: true
  });
}

module.exports = { handleBidCommand };
