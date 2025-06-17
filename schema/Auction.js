// File: schema/Auction.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuctionSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  gameKey: {
    type: String,
    required: true,
    index: true
  },
  // qual item está sendo leiloado
  item: {
    type: Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  // preço mínimo de partida (pode vir de Category.minimumCurrency)
  startingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  // ← campo que faltava
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  // timestamps de início e fim do leilão
  startTimestamp: {
    type: Date,
    required: true
  },
  endTimestamp: {
    type: Date,
    required: true,
    index: true
  },
  // ids de mensagem e thread no Discord
  messageId: {
    type: String,
    default: null
  },
  threadId: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  announcementMessageId: {
    type: String,
    default: null
  }
}, { timestamps: true });

// REMOVED: unique partial index on item, to allow multiple concurrent auctions of the same item
// AuctionSchema.index(
//   { guildId: 1, gameKey: 1, item: 1, status: 1 },
//   { unique: true, partialFilterExpression: { status: 'open' } }
// );

module.exports = mongoose.model('Auction', AuctionSchema);
