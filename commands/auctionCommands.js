// File: commands/auctionCommands.js
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');
const {
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const {
  parseDuration
} = require('../utils/timeUtils');
const Auction = require('../schema/Auction');
const AuctionHistory = require('../schema/AuctionHistory');
const Bid    = require('../schema/Bid');
const Dkp    = require('../schema/Dkp');
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

  // Load config
  const cfg     = await GuildConfig.findOne({ guildId });
  const gameCfg = cfg?.games.find(g => g.key === gameKey);
  if (!gameCfg) return interaction.editReply('Game not configured.');
  const channelId = gameCfg.channels.auction;
  if (!channelId) return interaction.editReply('Auction channel not configured.');
  const channel = await interaction.guild.channels.fetch(channelId);

  // Mode & labels
  const useDkp        = gameCfg.auctionMode === 'dkp';
  const currencyLabel = useDkp ? 'DKP' : gameCfg.currency.name;
  const durationMin   = gameCfg.defaultAuctionDuration;

  // Build embed
  function buildEmbed(auction, item, qty) {
    const totalDkpCost = item.category.minimumDkp * qty;
    const startVal     = (useDkp
      ? item.category.minimumDkp
      : item.category.minimumCurrency) * qty;
    const incrVal      = (useDkp
      ? item.category.bidIncrement
      : item.category.minimumDkp) * qty;
    const endTs        = Math.floor(auction.endTimestamp.getTime() / 1000);

    const fields = [
      { name: 'Category',       value: item.category.name,          inline: true },
      { name: 'Quantity',       value: String(qty),                 inline: true },
    ];

    if (!useDkp) {
      fields.push({
        name: 'Total DKP Cost',
        value: `${totalDkpCost} DKP`,
        inline: true
      });
    }

    fields.push(
      { name: 'Starting Price', value: `${startVal} ${currencyLabel}`, inline: true },
      { name: 'Bid Increment',  value: `${incrVal} ${currencyLabel}`,  inline: true },
      { name: 'Ends in',        value: `<t:${endTs}:R> (<t:${endTs}:f>)` }
    );

    return new EmbedBuilder()
      .setTitle(item.name)
      .addFields(fields)
      .setFooter({ text: `Auction ID: ${auction._id}` });
  }

  try {
    // ── START ─────────────────────────────────────────────────────────────
    if (sub === 'start') {
      const itemId   = interaction.options.getString('item');
      const quantity = interaction.options.getInteger('quantity');
      if (quantity < 1) return interaction.editReply('Quantity must be at least 1.');

      const items = await getItemsFromCache(guildId, gameKey);
      const item  = items.find(i => i._id.toString() === itemId);
      if (!item) return interaction.editReply('Item not found.');

      const now        = new Date();
      const endAt      = new Date(now.getTime() + durationMin * 60000);
      const starting   = (useDkp
        ? item.category.minimumDkp
        : item.category.minimumCurrency) * quantity;

      const auction = await Auction.create({
        guildId,
        gameKey,
        item:          item._id,
        startingPrice: starting,
        quantity,
        startTimestamp: now,
        endTimestamp:   endAt
      });

      // Log + announce
      await sendMessageToConfiguredChannels(
        interaction,
        `New auction by **${interaction.member.displayName}**: **${item.name}** x${quantity}`,
        'log',
        gameKey
      );
      const ann = await channel.send(`📢 New auction: **${item.name}** x${quantity}!`);
      const thread = await ann.startThread({ name: `Auction: ${item.name}` });

      // Resize image
      const imgPath = path.join(__dirname, '..', 'img', 'items', item.image);
      let buf = fs.readFileSync(imgPath);
      buf = await sharp(buf)
        .resize({ width: 390, height: 530, fit: 'inside' })
        .toBuffer();

      const embed = buildEmbed(auction, item, quantity)
        .setImage(`attachment://${item.image}`);
      await thread.send({
        embeds: [embed],
        files:  [{ attachment: buf, name: item.image }]
      });

      auction.threadId              = thread.id;
      auction.announcementMessageId = ann.id;
      await auction.save();
      await refreshOpenAuctionsCache(guildId, gameKey);
      scheduleAuctionClose(auction, interaction.client);

      return interaction.editReply(
        `Auction started in <#${channelId}>; see <#${thread.id}>.`
      );
    }

    // ── EDIT ──────────────────────────────────────────────────────────────
    if (sub === 'edit') {
      const auctionId   = interaction.options.getString('auctionid');
      const newQty      = interaction.options.getInteger('quantity');
      const rawDur      = interaction.options.getString('duration');

      if (newQty == null && !rawDur) {
        return interaction.editReply('Provide new **quantity** and/or **duration**.');
      }

      const auction = await Auction.findById(auctionId);
      if (!auction || auction.status !== 'open') {
        return interaction.editReply('Open auction not found.');
      }

      const changes = [];
      if (newQty != null) {
        auction.quantity = newQty;
        changes.push(`quantity → ${newQty}`);
      }
      if (rawDur) {
        const ms = parseDuration(rawDur);
        if (isNaN(ms) || ms<=0) {
          return interaction.editReply('Invalid duration; use formats like `1h30m`, `45m`.');
        }
        auction.endTimestamp = new Date(Date.now() + ms);
        changes.push(`duration → ${rawDur}`);
        cancelAuctionSchedule(auctionId);
        scheduleAuctionClose(auction, interaction.client);
      }

      await auction.save();
      await refreshOpenAuctionsCache(guildId, gameKey);

      // Refresh embed in thread (delete old, post new)
      const items = await getItemsFromCache(guildId, gameKey);
      const item  = items.find(i => i._id.equals(auction.item));
      const thread = await interaction.client.channels.fetch(auction.threadId).catch(()=>null);
      if (thread?.isThread()) {
        const msgs = await thread.messages.fetch({ limit: 10 });
        const orig = msgs.find(m => m.embeds[0]?.footer?.text?.includes(auction._id.toString()));
        if (orig) await orig.delete().catch(()=>null);

        let buf = fs.readFileSync(path.join(__dirname,'..','img','items',item.image));
        buf = await sharp(buf).resize({ width:390, height:530, fit:'inside' }).toBuffer();
        const newEmbed = buildEmbed(auction, item, auction.quantity)
          .setImage(`attachment://${item.image}`);
        await thread.send({ embeds:[newEmbed], files:[{attachment:buf,name:item.image}] });
        await thread.send(`⚙️ Auction updated: ${changes.join(', ')}`);
      }

      return interaction.editReply(`Updated: ${changes.join(', ')}`);
    }

    // ── END ────────────────────────────────────────────────────────────────
    if (sub === 'end') {
      const auctionId = interaction.options.getString('auctionid');
      const auction   = await Auction.findOne({ _id: auctionId, gameKey })
        .populate({ path:'item', populate:'category' });
      if (!auction) {
        return interaction.editReply('Auction not found.');
      }

      // Confirm if already scheduled
      if (isEndScheduled(auctionId)) {
        const ts = Math.floor(auction.endTimestamp.getTime()/1000);
        const embed = createInfoEmbed(
          'Confirm Immediate End',
          `Scheduled to end at <t:${ts}:f>. End now?`
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
        const rep = await interaction.editReply({ embeds:[embed], components:[row] });
        try {
          const btn = await rep.awaitMessageComponent({ filter:i=>i.user.id===interaction.user.id, time:30000 });
          await btn.deferUpdate();
          if (btn.customId === `cancel-end:${auctionId}`) {
            return interaction.editReply({ content:'Cancelled.', embeds:[], components:[] });
          }
        } catch {
          return interaction.editReply({ content:'No reply; cancelled.', embeds:[], components:[] });
        }
      }

      cancelAuctionSchedule(auctionId);

      // Collect bids & winner
      const bids      = await Bid.find({ auction: auctionId }).sort({ placedAt:1 });
      const winnerBid = bids.reduce((m,b)=>!m||b.amount>m.amount?b:m,null);
      const closedAt  = new Date();

      // Thread announcement
      const thread = await interaction.client.channels.fetch(auction.threadId).catch(()=>null);
      if (thread) {
        const txt = winnerBid
          ? `🏆 The winner is <@${winnerBid.userId}> with **${winnerBid.amount}** ${currencyLabel}`
          : 'No bids placed.';
        await thread.send(`🔒 Auction ended! ${txt}`);
      }

      // Save history
      await AuctionHistory.create({
        auctionId:     auction._id,
        winnerUserId:  winnerBid?.userId || 'None',
        winningAmount: winnerBid?.amount || 0,
        closedAt,
        itemName:      auction.item.name,
        categoryName:  auction.item.category.name,
        bids: bids.map(b=>({
          userId:b.userId,
          amount:b.amount,
          placedAt:b.placedAt
        }))
      });

      // Deduction: both modes
      if (winnerBid) {
        const rec = await Dkp.findOne({ guildId, gameKey, userId: winnerBid.userId });
        if (rec) {
          const oldBal = rec.points;
          // game-currency mode: charge category.minimumDkp*qty
          // DKP-mode:           charge winning bid amount
          const cost = useDkp
            ? winnerBid.amount
            : auction.quantity * auction.item.category.minimumDkp;
          rec.points = Math.max(0, oldBal - cost);
          const newBal = rec.points;
          await rec.save();
          await refreshDkpPointsCache(guildId, gameKey);

          // DM winner
          const threadUrl = `https://discord.com/channels/${guildId}/${channelId}/${auction.threadId}`;
          const user      = await interaction.client.users.fetch(winnerBid.userId).catch(()=>null);
          if (user) {
            await user.send({
              embeds: [createInfoEmbed(
                'Auction Won!',
                `You won **${auction.item.name}** x${auction.quantity}.\n`+
                `Cost: **${cost}** DKP.\n`+
                `Balance: **${oldBal} → ${newBal}** DKP.\n\n`+
                `View thread: ${threadUrl}`
              )]
            }).catch(()=>null);
          }
        }
      }

      // Clean up announcement & thread
      if (auction.announcementMessageId) {
        const ann = await channel.messages.fetch(auction.announcementMessageId).catch(()=>null);
        if (ann) await ann.delete().catch(()=>null);
      }
      if (thread) await thread.delete().catch(()=>null);

      // Finalize
      auction.status       = 'closed';
      auction.endTimestamp = closedAt;
      await auction.save();
      await refreshOpenAuctionsCache(guildId, gameKey);

      return interaction.editReply(
        'Auction ended, history recorded and DKP updated.'
      );
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

    // ─── HISTORY ───────────────────────────────────────────────────────────────
    if (sub === 'history') {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const raw = await AuctionHistory.find({ closedAt: { $gte: since } })
        .populate({ path: 'auctionId', match: { guildId, gameKey } })
        .sort({ closedAt: -1 })
        .limit(10)
        .lean();

      const list = raw.filter(h => h.auctionId);
      if (!list.length) {
        return interaction.editReply('No auctions closed in the last 24 hours.');
      }

      const embed = new EmbedBuilder()
        .setTitle(`Auction History (last 24 h for ${gameKey})`)
        .addFields(list.map(h => {
          const ts = Math.floor(new Date(h.closedAt).getTime() / 1000);
          return {
            name:  `${h.itemName}`,
            value: `Winner: <@${h.winnerUserId}>\n` +
                   `Amount: **${h.winningAmount}**\n` +
                   `Closed: <t:${ts}:f>`
          };
        }));

      return interaction.editReply({ embeds: [embed] });
    }

  } catch (err) {
    console.error('Error handling auction command:', err);
    return interaction.editReply({ content: 'Error processing auction.' });
  }
}

module.exports = { handleAuctionCommand };
