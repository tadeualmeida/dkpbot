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
  const closeJob  = schedule.scheduledJobs[`close-auction-${auctionId}`];
  const deleteJob = schedule.scheduledJobs[`delete-auction-${auctionId}`];
  if (closeJob)  closeJob.cancel();
  if (deleteJob) deleteJob.cancel();
}

/**
 * Deletes both the announcement message and the thread for a given auction.
 */
async function deleteAnnouncementAndThread(auctionId, client) {
  try {
    const auc = await Auction.findById(auctionId).lean();
    if (!auc) return;

    const cfg     = await GuildConfig.findOne({ guildId: auc.guildId });
    const gameCfg = cfg?.games.find(g => g.key === auc.gameKey);
    if (!gameCfg?.channels.auction) return;

    const parent = await client.channels.fetch(gameCfg.channels.auction).catch(() => null);
    if (!parent?.messages) return;

    // delete the announcement in the channel
    if (auc.announcementMessageId) {
      const msg = await parent.messages.fetch(auc.announcementMessageId).catch(() => null);
      if (msg) await msg.delete().catch(() => null);
    }

    // delete the thread
    const thread = await client.channels.fetch(auc.threadId).catch(() => null);
    if (thread) await thread.delete().catch(() => null);

  } catch (err) {
    console.error('Error deleting announcement/thread:', err);
  }
}

/**
 * Performs the shared "close" logic (same as /auction end).
 */
async function closeAuction(auctionId, client) {
  const auction = await Auction.findById(auctionId)
    .populate({ path: 'item', populate: 'category' });
  if (!auction || auction.status !== 'open') return;

  const cfg     = await GuildConfig.findOne({ guildId: auction.guildId });
  const gameCfg = cfg?.games.find(g => g.key === auction.gameKey);
  if (!gameCfg?.channels.auction) return;

  const channelId = gameCfg.channels.auction;
  const threadUrl = `https://discord.com/channels/${auction.guildId}/${channelId}/${auction.threadId}`;

  // determine mode & labels
  const useDkp        = gameCfg.auctionMode === 'dkp';
  const currencyLabel = useDkp ? 'DKP' : gameCfg.currency.name;

  // determine winner
  const bids      = await Bid.find({ auction: auctionId }).sort({ amount: -1 });
  const winnerBid = bids[0] || null;
  const closedAt  = new Date();

  // announce in thread
  const thread = await client.channels.fetch(auction.threadId).catch(() => null);
  if (thread) {
    if (winnerBid) {
      await thread.send(
        `🔒 Auction ended! 🏆 The winner is <@${winnerBid.userId}> with **${winnerBid.amount}** ${currencyLabel}`
      );
    } else {
      await thread.send(`🔒 Auction ended! No bids were placed.`);
    }
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

  // deduct currency
  let oldBal, newBal;
  if (winnerBid) {
    if (useDkp) {
      // charge exactly the bid amount from DKP
      const rec = await Dkp.findOne({
        guildId: auction.guildId,
        gameKey: auction.gameKey,
        userId:  winnerBid.userId
      });
      if (rec) {
        oldBal      = rec.points;
        rec.points  = Math.max(0, oldBal - winnerBid.amount);
        newBal      = rec.points;
        await rec.save();
        await refreshDkpPointsCache(auction.guildId, auction.gameKey);
      }
    } else {
      // charge category.minimumDkp × quantity from DKP
      const cost = auction.item.category.minimumDkp * auction.quantity;
      const rec  = await Dkp.findOne({
        guildId: auction.guildId,
        gameKey: auction.gameKey,
        userId:  winnerBid.userId
      });
      if (rec) {
        oldBal      = rec.points;
        rec.points  = Math.max(0, oldBal - cost);
        newBal      = rec.points;
        await rec.save();
        await refreshDkpPointsCache(auction.guildId, auction.gameKey);
      }
    }
  }

  // DM the winner
  if (winnerBid && oldBal != null) {
    const user = await client.users.fetch(winnerBid.userId).catch(() => null);
    if (user) {
      const dm = createInfoEmbed(
        'Auction Won!',
        `You won **${auction.item.name}** x${auction.quantity}.\n` +
        (useDkp
          ? `Cost: **${winnerBid.amount}** DKP\n`
          : `Cost: **${auction.item.category.minimumDkp * auction.quantity}** DKP\n`) +
        `Balance: **${oldBal}** → **${newBal}** DKP\n\n` +
        `View the auction thread:\n${threadUrl}`
      );
      await user.send({ embeds: [dm] }).catch(() => null);
    }
  }

  // log to configured log channel
  if (gameCfg.channels.log && winnerBid && oldBal != null) {
    const logCh = await client.channels.fetch(gameCfg.channels.log).catch(() => null);
    if (logCh?.isTextBased()) {
      let name = winnerBid.userId;
      try {
        const member = await client.guilds
          .fetch(auction.guildId)
          .then(g => g.members.fetch(winnerBid.userId));
        name = member.displayName;
      } catch {}
      const cost = useDkp
        ? winnerBid.amount
        : auction.item.category.minimumDkp * auction.quantity;
      const embed = createInfoEmbed(
        'Auction Ended',
        `Item: **${auction.item.name}** x${auction.quantity}\n` +
        `Winner: **${name}**\n` +
        `Cost: **${cost}** DKP\n` +
        `Balance: **${oldBal}** → **${newBal}** DKP\n\n` +
        `Auction thread: ${threadUrl}`
      );
      await logCh.send({ embeds: [embed] });
    }
  }

  // finalize
  auction.status       = 'closed';
  auction.endTimestamp = closedAt;
  await auction.save();
  await refreshOpenAuctionsCache(auction.guildId, auction.gameKey);
}

/**
 * Schedule automatic close at endTimestamp, and delete announcement+thread
 * defaultAuctionDelete (in minutes) is pulled from gameCfg.
 */
async function scheduleAuctionClose(auction, client) {
  if (!auction.endTimestamp) return;

  // cancel any previous jobs
  cancelAuctionSchedule(auction._id);

  // 1) schedule close
  schedule.scheduleJob(
    `close-auction-${auction._id}`,
    auction.endTimestamp,
    () => closeAuction(auction._id, client).catch(console.error)
  );

  // 2) schedule delete X minutes after close
  const cfg     = await GuildConfig.findOne({ guildId: auction.guildId });
  const gameCfg = cfg?.games.find(g => g.key === auction.gameKey);
  const deleteMinutes = gameCfg?.defaultAuctionDelete ?? 480; // default 8h
  const deleteAt = new Date(auction.endTimestamp.getTime() + deleteMinutes * 60_000);

  schedule.scheduleJob(
    `delete-auction-${auction._id}`,
    deleteAt,
    () => deleteAnnouncementAndThread(auction._id, client)
  );
}

/**
 * On bot startup, re-schedule all open and closed auctions.
 */
async function initAuctionScheduler(client) {
  const now = new Date();

  // open auctions → close + delete
  const openAuctions = await Auction.find({
    status:       'open',
    endTimestamp: { $gte: now }
  });
  for (const auc of openAuctions) {
    await scheduleAuctionClose(auc, client);
  }

  // closed auctions → delete immediately or schedule delete
  const closedAuctions = await Auction.find({
    status:       'closed',
    endTimestamp: { $lte: now }
  });
  for (const auc of closedAuctions) {
    const cfg     = await GuildConfig.findOne({ guildId: auc.guildId });
    const gameCfg = cfg?.games.find(g => g.key === auc.gameKey);
    const deleteMinutes = gameCfg?.defaultAuctionDelete ?? 480;
    const deleteAt = new Date(auc.endTimestamp.getTime() + deleteMinutes * 60_000);

    if (deleteAt <= now) {
      await deleteAnnouncementAndThread(auc._id, client);
    } else {
      schedule.scheduleJob(
        `delete-auction-${auc._id}`,
        deleteAt,
        () => deleteAnnouncementAndThread(auc._id, client)
      );
    }
  }
}

module.exports = {
  isEndScheduled,
  cancelAuctionSchedule,
  closeAuction,
  scheduleAuctionClose,
  initAuctionScheduler
};
