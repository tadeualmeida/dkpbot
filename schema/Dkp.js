// Dkp.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
  type: { type: String, enum: ['add', 'remove'], required: true },
  amount: { type: Number, required: true },
  description: String
}, { timestamps: true });

const dkpSchema = new Schema({
  guildId: { type: String, required: true, index: true }, // Adicionado guildId
  userId: { type: String, required: true, index: true },
  points: { type: Number, default: 0 },
  transactions: [transactionSchema]
}, { timestamps: true });

const Dkp = mongoose.model('Dkp', dkpSchema);

module.exports = Dkp;
