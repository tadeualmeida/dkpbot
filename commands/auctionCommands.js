// File: commands/auctionCommands.js
const path = require('path');
const {
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const schedule = require('node-schedule');
const { parseDuration } = require('../utils/timeUtils');
const Auction = require('../schema/Auction');
const AuctionHistory = require('../schema/AuctionHistory');
const Bid = require('../schema/Bid');
const Dkp = require('../schema/Dkp');
const GuildConfig = require('../schema/GuildConfig');
const {
  getItemsFromCache,
  refreshOpenAuctionsCache,
  refreshDkpPointsCache
} = require('../utils/cacheManagement');
const {
  scheduleAuctionClose,
  isEndScheduled,
  cancelAuctionSchedule
} = require('../utils/auctionScheduler');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');
const { createInfoEmbed } = require('../utils/embeds');

async function handleAuctionCommand(interaction) {
  const guildId = interaction.guild.id;
  await interaction.deferReply({ ephemeral: true });

  const sub     = interaction.options.getSubcommand();
  const gameKey = interaction.options.getString('game')?.toLowerCase();

  // Load guild config and game context
  const cfg     = await GuildConfig.findOne({ guildId });
  const gameCfg = cfg?.games.find(g => g.key === gameKey);
  if (!gameCfg) {
    return interaction.editReply({ content: 'Game not configured.' });
  }
  const channelId = gameCfg.channels.auction;
  if (!channelId) {
    return interaction.editReply({ content: 'Auction channel not configured.' });
  }
  const channel = await interaction.guild.channels.fetch(channelId);

  // Auction duration (minutes)
  const durationMin = gameCfg.defaultAuctionDuration;

  // Helper: build embed for thread
  function buildEmbed(auction, item, quantity) {
    const totalDkpCost = item.category.minimumDkp * quantity;
    const totalMinBid  = item.category.minimumCurrency * quantity;
    const bidIncrement = item.category.bidIncrement * quantity;
    const endTs        = Math.floor(auction.endTimestamp.getTime() / 1000);

    return new EmbedBuilder()
      .setTitle(item.name)
      .addFields(
        { name: 'Category',       value: item.category.name, inline: true },
        { name: 'Quantity',       value: String(quantity), inline: true },
        { name: 'Total DKP Cost', value: String(totalDkpCost), inline: true },
        { name: 'Starting Price', value: String(totalMinBid), inline: true },
        { name: 'Bid Increment',  value: String(bidIncrement), inline: true },
        { name: 'Ends in',        value: `<t:${endTs}:R> (<t:${endTs}:f>)` }
      )
      .setFooter({ text: `Auction ID: ${auction._id}` });
  }

  try {
    // ─── START ───
    if (sub === 'start') {
      const itemId   = interaction.options.getString('item');
      const quantity = interaction.options.getInteger('quantity');
      if (quantity < 1) {
        return interaction.editReply({ content: 'Quantity must be at least 1.' });
      }

      const items = await getItemsFromCache(guildId, gameKey);
      const item  = items.find(i => i._id.toString() === itemId);
      if (!item) {
        return interaction.editReply({ content: 'Item not found.' });
      }

      const startTimestamp = new Date();
      const endTimestamp   = new Date(startTimestamp.getTime() + durationMin * 60000);

      const auction = await Auction.create({
        guildId,
        gameKey,
        item:           item._id,
        startingPrice:  item.category.minimumCurrency * quantity,
        quantity,
        startTimestamp,
        endTimestamp
      });

      await sendMessageToConfiguredChannels(
        interaction,
        `New auction created by **${interaction.member.displayName}**: **${item.name}** x${quantity}`,
        'log',
        gameKey
      );

      const annMsg = await channel.send(`@here 📢 New auction started: **${item.name}** x${quantity}!`);
      const thread = await annMsg.startThread({ name: `Auction: ${item.name}` });

      const imagePath = path.join(__dirname, '..', 'img', 'items', item.image);
      const embed     = buildEmbed(auction, item, quantity)
                          .setImage(`attachment://${item.image}`);
      await thread.send({
        embeds: [embed],
        files:  [{ attachment: imagePath, name: item.image }]
      });

      auction.threadId              = thread.id;
      auction.announcementMessageId = annMsg.id;
      await auction.save();
      await refreshOpenAuctionsCache(guildId, gameKey);
      scheduleAuctionClose(auction, interaction.client);

      return interaction.editReply({
        content: `Auction started in <#${channelId}>. See thread <#${thread.id}> for details.`
      });
    }

    // ─── EDIT ───
    if (sub === 'edit') {
      const auctionId    = interaction.options.getString('auctionid');
      const newQty       = interaction.options.getInteger('quantity');
      const rawDuration  = interaction.options.getString('duration');

      if (newQty == null && !rawDuration) {
        return interaction.editReply(
          'You must supply a new **quantity** and/or **duration**.'
        );
      }

      // Fetch & validate auction
      const auction = await Auction.findById(auctionId);
      if (!auction || auction.status !== 'open') {
        return interaction.editReply('Open auction not found for that ID.');
      }

      // Apply changes
      const changes = [];
      if (newQty != null) {
        auction.quantity = newQty;
        changes.push(`quantity → ${newQty}`);
      }
      if (rawDuration) {
        const ms = parseDuration(rawDuration);
        if (isNaN(ms) || ms <= 0) {
          return interaction.editReply(
            'Could not parse duration. Use formats like `10h30m`, `45m`, `2h`.'
          );
        }
        auction.endTimestamp = new Date(Date.now() + ms);
        changes.push(`duration → ${rawDuration}`);

        // cancel existing scheduled close if any
        const jobName = `close-auction-${auction._id}`;
        const existingJob = schedule.scheduledJobs[jobName];
        if (existingJob) existingJob.cancel();

        // schedule with new timestamp
        scheduleAuctionClose(auction, interaction.client);
      }

      await auction.save();
      await refreshOpenAuctionsCache(guildId, gameKey);
      if (rawDuration) {
        scheduleAuctionClose(auction, interaction.client);
      }

      // **Update the embed inside the existing thread**
      const items  = await getItemsFromCache(guildId, gameKey);
      const item   = items.find(i => i._id.equals(auction.item));
      const thread = await interaction.client.channels.fetch(auction.threadId);

      if (thread?.isThread()) {
        // 1️⃣ find the original embed message by footer
        const msgs = await thread.messages.fetch({ limit: 10 });
        const orig = msgs.find(m =>
          m.embeds[0]?.footer?.text?.includes(auction._id.toString())
        );

        if (orig) {
          // 2️⃣ delete that old message (embed + stray attachment)
          await orig.delete().catch(() => null);

          // 3️⃣ build & send new embed with its image attached
          const imagePath = path.join(__dirname, '..', 'img', 'items', item.image);
          const newEmbed  = buildEmbed(auction, item, auction.quantity)
            .setImage(`attachment://${item.image}`);

          await thread.send({
            embeds: [newEmbed],
            files:  [{ attachment: imagePath, name: item.image }]
          });
        }

        // 4️⃣ option- al status update
        await thread.send(`⚙️ Auction updated: ${changes.join(', ')}`);
      }

      return interaction.editReply(
        `Auction **${auctionId}** updated: ${changes.join(', ')}`
      );
    }

    // ─── END ───
    if (sub === 'end') {
      const auctionId = interaction.options.getString('auctionid');
      const auction   = await Auction.findOne({ _id: auctionId, gameKey })
        .populate({ path: 'item', populate: 'category' });
      if (!auction) {
        return interaction.editReply({ content: 'Auction not found.' });
      }

      // If auto-close is scheduled, ask for confirmation
      if (isEndScheduled(auctionId)) {
        const ts   = Math.floor(auction.endTimestamp.getTime() / 1000);
        const embed = createInfoEmbed(
          'Confirm Immediate End',
          `This auction is scheduled to end at <t:${ts}:f>.\n` +
          `Do you want to end it now?`
        );
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`confirm-end:${auctionId}`)
            .setLabel('End Now')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`cancel-end:${auctionId}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
        const reply = await interaction.editReply({ embeds: [embed], components: [row] });
        try {
          const btn = await reply.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            time: 30000
          });
          await btn.deferUpdate();
          if (btn.customId === `cancel-end:${auctionId}`) {
            return interaction.editReply({
              content: 'Action cancelled.',
              embeds: [],
              components: []
            });
          }
        } catch {
          return interaction.editReply({
            content: 'No response—cancelled.',
            embeds: [],
            components: []
          });
        }
      }

      // Cancel any pending auto-close/delete jobs
      cancelAuctionSchedule(auctionId);

      // Determine winner
      const bids      = await Bid.find({ auction: auctionId }).sort({ placedAt: 1 });
      const winnerBid = bids.reduce((max, b) => (!max || b.amount > max.amount) ? b : max, null);
      const closedAt  = new Date();

      // Announce inside thread
      const thread = await interaction.client.channels.fetch(auction.threadId).catch(() => null);
      if (thread) {
        const text = winnerBid
          ? `🏆 The winner is <@${winnerBid.userId}> with **${winnerBid.amount}**`
          : 'No bids were placed.';
        await thread.send(`🔒 Auction ended! ${text}`);
      }

      // Record history
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

      // Deduct DKP
      let oldBal, newBal;
      if (winnerBid) {
        const cost = auction.quantity * auction.item.category.minimumDkp;
        const rec  = await Dkp.findOne({
          guildId,
          gameKey,
          userId: winnerBid.userId
        });
        if (rec) {
          oldBal    = rec.points;
          rec.points = Math.max(0, oldBal - cost);
          newBal    = rec.points;
          await rec.save();
          await refreshDkpPointsCache(guildId, gameKey);

          // DM winner
          const threadUrl = `https://discord.com/channels/${guildId}/${channelId}/${auction.threadId}`;
          const user      = await interaction.client.users.fetch(winnerBid.userId).catch(() => null);
          if (user) {
            await user.send({
              embeds: [createInfoEmbed(
                'Auction Won!',
                `You won **${auction.item.name}** x${auction.quantity}.\n` +
                `Cost: **${cost}** DKP.\n` +
                `Balance: **${oldBal}** → **${newBal}** DKP.\n\n` +
                `View thread: ${threadUrl}`
              )]
            }).catch(() => null);
          }

          // Log
          if (gameCfg.channels.log) {
            const logCh = await interaction.client.channels.fetch(gameCfg.channels.log).catch(() => null);
            if (logCh?.isTextBased()) {
              let disp = 'Unknown';
              try {
                const guild  = await interaction.client.guilds.fetch(guildId);
                const member = await guild.members.fetch(winnerBid.userId);
                disp  = member.displayName;
              } catch {}
              await logCh.send({
                embeds: [createInfoEmbed(
                  'Auction Ended',
                  `Item: **${auction.item.name}** x${auction.quantity}\n` +
                  `Winner: **${disp}**\n` +
                  `Cost: **${cost}** DKP\n` +
                  `Balance: **${oldBal}** → **${newBal}** DKP\n\n` +
                  `Thread: https://discord.com/channels/${guildId}/${channelId}/${auction.threadId}`
                )]
              });
            }
          }
        }
      }

      // Delete announcement & thread
      const parent = await interaction.client.channels.fetch(channelId).catch(() => null);
      if (parent?.messages && auction.announcementMessageId) {
        const ann = await parent.messages.fetch(auction.announcementMessageId).catch(() => null);
        if (ann) await ann.delete().catch(() => null);
      }
      if (thread) await thread.delete().catch(() => null);

      // Finalize
      auction.status       = 'closed';
      auction.endTimestamp = closedAt;
      await auction.save();
      await refreshOpenAuctionsCache(guildId, gameKey);

      return interaction.editReply({
        content: 'Auction ended, history recorded and DKP updated.'
      });
    }
      // ─── CANCEL ───────────────────────────────────────────────────────────────────
    if (sub === 'cancel') {
      const auctionId = interaction.options.getString('auctionid');
      const auction   = await Auction.findOne({ _id: auctionId, gameKey });
      if (!auction || auction.status !== 'open') {
        return interaction.editReply({ content: 'Open auction not found for that ID.' });
      }

      // Delete announcement message
      if (auction.announcementMessageId) {
        const annMsg = await channel.messages
          .fetch(auction.announcementMessageId)
          .catch(() => null);
        if (annMsg) {
          await annMsg.delete().catch(() => null);
        }
      }

      // Delete the thread
      const thread = await interaction.client.channels.fetch(auction.threadId).catch(() => null);
      if (thread) {
        await thread.delete().catch(() => null);
      }

      // Remove auction entirely
      await Auction.deleteOne({ _id: auctionId });

      // Refresh cache
      await refreshOpenAuctionsCache(guildId, gameKey);

      // Log cancellation
      await sendMessageToConfiguredChannels(
        interaction,
        `Auction **${auctionId}** cancelled by **${interaction.member.displayName}**.`,
        'log',
        gameKey
      );

      return interaction.editReply({
        content: `Auction **${auctionId}** has been cancelled and removed.`
      });
    }

  } catch (err) {
    console.error('Error handling auction command:', err);
    return interaction.editReply({ content: 'Error processing auction.' });
  }
}

module.exports = { handleAuctionCommand };
