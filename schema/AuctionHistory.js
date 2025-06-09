// schema/AuctionHistory.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuctionHistorySchema = new Schema({
  auctionId: {
    type: Schema.Types.ObjectId,
    ref: 'Auction',
    required: true,
    index: true
  },
  winnerUserId: {
    type: String,
    required: true
  },
  winningAmount: {
    type: Number,
    required: true,
    min: 0
  },
  closedAt: {
    type: Date,
    default: Date.now
  },
  // armazenamos também nome do item e categoria para facilitar consultas
  itemName: {
    type: String,
    required: true
  },
  categoryName: {
    type: String,
    required: true
  },
  // um array com todo o histórico de lances até o fechamento
  bids: [
    {
      userId: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      placedAt: {
        type: Date,
        required: true
      }
    }
  ]
}, { timestamps: true });

// Nenhum índice adicional necessário aqui além do auctionId já indexado
module.exports = mongoose.model('AuctionHistory', AuctionHistorySchema);
