//schema/Dkp.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define each DKP transaction
const transactionSchema = new Schema({
  type: { type: String, enum: ['add', 'remove'], required: true },
  amount: { type: Number, required: true },
  description: String
}, { timestamps: true });

// Main DKP schema, now per-game
const dkpSchema = new Schema({
  guildId:    { type: String, required: true, index: true, trim: true },
  gameKey:    { type: String, required: true, index: true, lowercase: true, trim: true },
  userId:     { type: String, required: true, index: true, trim: true },
  points:     { type: Number, default: 0 },
  transactions: [transactionSchema]
}, { timestamps: true });

// Composite index to prevent duplicate records per user/game
dkpSchema.index({ guildId: 1, gameKey: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Dkp', dkpSchema);