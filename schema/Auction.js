// schema/Auction.js
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
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  }
}, { timestamps: true });

// Garante que só exista um leilão “open” para este guild+game+item
AuctionSchema.index(
  { guildId: 1, gameKey: 1, item: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } }
);

module.exports = mongoose.model('Auction', AuctionSchema);
