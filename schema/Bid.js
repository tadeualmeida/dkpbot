// schema/Bid.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const BidSchema = new Schema({
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
  auction: {
    type: Schema.Types.ObjectId,
    ref: 'Auction',
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  placedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Removido o índice unique para permitir múltiplos lances por usuário/auction,
// mas a lógica de negócio terá de verificar se esse usuário já possui o maior lance ou não.
module.exports = mongoose.model('Bid', BidSchema);
