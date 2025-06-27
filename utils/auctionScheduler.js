// File: utils/auctionScheduler.js
const schedule = require('node-schedule');
const path = require('path');
const Auction = require('../schema/Auction');
const AuctionHistory = require('../schema/AuctionHistory');
const Bid = require('../schema/Bid');
const Dkp = require('../schema/Dkp');
const GuildConfig = require('../schema/GuildConfig');
const {
  refreshOpenAuctionsCache,
  refreshDkpPointsCache
} = require('./cacheManagement');
const { createInfoEmbed } = require('../utils/embeds');

/**
 * Returns true if there's a pending "close" job for this auction.
 */
function isEndScheduled(auctionId) {
  return Boolean(schedule.scheduledJobs[`close-auction-${auctionId}`]);
}

/**
 * Cancels any scheduled close or delete jobs for this auction.
 */
function cancelAuctionSchedule(auctionId) {
  const closeJob = schedule.scheduledJobs[`close-auction-${auctionId}`];
  if (closeJob) closeJob.cancel();
  const deleteJob = schedule.scheduledJobs[`delete-auction-${auctionId}`];
  if (deleteJob) deleteJob.cancel();
}

/**
 * Delete both announcement message and thread.
 */
async function deleteAnnouncementAndThread(auctionId, client) {
  try {
    const auc = await Auction.findById(auctionId).lean();
    if (!auc) return;
    const cfg     = await GuildConfig.findOne({ guildId: auc.guildId });
    const gameCfg = cfg?.games.find(g => g.key === auc.gameKey);
    if (!gameCfg?.channels.auction) return;

    const parent = await client.channels.fetch(gameCfg.channels.auction).catch(() => null);
    if (!parent?.isTextBased?.() && !parent?.threads) return;

    // delete announcement
    if (auc.announcementMessageId) {
      const annMsg = await parent.messages
        .fetch(auc.announcementMessageId)
        .catch(() => null);
      if (annMsg) await annMsg.delete().catch(() => null);
    }

    // delete thread
    const thread = await client.channels.fetch(auc.threadId).catch(() => null);
    if (thread) await thread.delete().catch(() => null);
  } catch (err) {
    console.error('Error in deleteAnnouncementAndThread:', err);
  }
}

/**
 * Core close logic (like /auction end).
 */
async function closeAuction(auctionId, client) {
  const auction = await Auction.findById(auctionId)
    .populate({ path: 'item', populate: 'category' });
  if (!auction || auction.status !== 'open') return;

  const cfg     = await GuildConfig.findOne({ guildId: auction.guildId });
  const gameCfg = cfg?.games.find(g => g.key === auction.gameKey);
  if (!gameCfg?.channels.auction) return;

  const auctionChannelId = gameCfg.channels.auction;
  const threadUrl = `https://discord.com/channels/${auction.guildId}/${auctionChannelId}/${auction.threadId}`;

  // determine winner
  const bids      = await Bid.find({ auction: auctionId }).sort({ placedAt: 1 });
  const winnerBid = bids.reduce((m, b) => (!m || b.amount > m.amount) ? b : m, null);
  const closedAt  = new Date();

  // announce in thread
  const thread = await client.channels.fetch(auction.threadId).catch(() => null);
  if (thread) {
    const currencyName = gameCfg.currency.name;
    const text = winnerBid
      ? `🏆 The winner is <@${winnerBid.userId}> with **${winnerBid.amount}** ${currencyName}`
      : 'No bids were placed.';
    await thread.send(`🔒 Auction ended! ${text}`);
  }

  // record history
  await AuctionHistory.create({
    auctionId:     auction._id,
    winnerUserId:  winnerBid?.userId   || 'None',
    winningAmount: winnerBid?.amount   || 0,
    closedAt,
    itemName:      auction.item.name,
    categoryName:  auction.item.category.name,
    bids: bids.map(b => ({
      userId:   b.userId,
      amount:   b.amount,
      placedAt: b.placedAt
    }))
  });

  // deduct DKP
  let oldBalance = null, newBalance = null;
  if (winnerBid) {
    const cost   = auction.quantity * auction.item.category.minimumDkp;
    const dkpRec = await Dkp.findOne({
      guildId: auction.guildId,
      gameKey: auction.gameKey,
      userId:  winnerBid.userId
    });
    if (dkpRec) {
      oldBalance    = dkpRec.points;
      dkpRec.points = Math.max(0, oldBalance - cost);
      newBalance    = dkpRec.points;
      await dkpRec.save();
      await refreshDkpPointsCache(auction.guildId, auction.gameKey);

      // DM the winner
      const user = await client.users.fetch(winnerBid.userId).catch(() => null);
      if (user) {
        const dmEmbed = createInfoEmbed(
          'Auction Won!',
          `You won **${auction.item.name}** x${auction.quantity}.\n` +
          `Cost: **${cost}** DKP.\n` +
          `Balance: **${oldBalance}** → **${newBalance}** DKP.\n\n` +
          `View the auction thread:\n${threadUrl}`
        );
        await user.send({ embeds: [dmEmbed] }).catch(() => null);
      }
    }
  }

  // log to game’s log channel
if (gameCfg.channels.log && winnerBid && oldBalance !== null && newBalance !== null) {
  const logChannel = await client.channels.fetch(gameCfg.channels.log).catch(() => null);

  if (logChannel?.isTextBased()) {
    // agora pegamos direto do bid
    const displayName = winnerBid.displayName ?? winnerBid.userId;
    const cost        = auction.quantity * auction.item.category.minimumDkp;
    const embed       = createInfoEmbed(
      'Auction Ended',
      `Item: **${auction.item.name}** x${auction.quantity}\n` +
      `Winner: **${displayName}**\n` +
      `DKP Cost: **${cost}**\n` +
      `Balance: **${oldBalance}** → **${newBalance}** DKP\n\n` +
      `Auction thread: ${threadUrl}`
    );
    await logChannel.send({ embeds: [embed] });
  }
}

  // finalize
  auction.status       = 'closed';
  auction.endTimestamp = closedAt;
  await auction.save();
  await refreshOpenAuctionsCache(auction.guildId, auction.gameKey);
}

/**
 * Schedule automatic close & thread/announcement delete.
 */
function scheduleAuctionClose(auction, client) {
  if (!auction.endTimestamp) return;

  // auto‐close
  schedule.scheduleJob(
    `close-auction-${auction._id}`,
    auction.endTimestamp,
    () => closeAuction(auction._id, client).catch(console.error)
  );

  // auto‐delete 6h later
  const deleteTime = new Date(auction.endTimestamp.getTime() + 2 * 60 * 1000);
  schedule.scheduleJob(
    `delete-auction-${auction._id}`,
    deleteTime,
    () => deleteAnnouncementAndThread(auction._id, client)
  );
}

/**
 * On startup:
 *  - schedule close jobs for open auctions
 *  - schedule or perform delete jobs for closed auctions
 */
async function initAuctionScheduler(client) {
  const now = new Date();

  // open auctions → schedule close & delete
  const openAuctions = await Auction.find({
    status:       'open',
    endTimestamp: { $gte: now }
  });
  for (const auc of openAuctions) {
    scheduleAuctionClose(auc, client);
  }

  // closed auctions → delete if due or schedule later
  const closedAuctions = await Auction.find({
    status:       'closed',
    endTimestamp: { $lte: now }
  });
  for (const auc of closedAuctions) {
    const deleteTime = new Date(auc.endTimestamp.getTime() + 2 * 60 * 1000);
    if (deleteTime <= now) {
      await deleteAnnouncementAndThread(auc._id, client);
    } else {
      schedule.scheduleJob(
        `delete-auction-${auc._id}`,
        deleteTime,
        () => deleteAnnouncementAndThread(auc._id, client)
      );
    }
  }
}

module.exports = {
  scheduleAuctionClose,
  initAuctionScheduler,
  isEndScheduled,
  cancelAuctionSchedule
};
