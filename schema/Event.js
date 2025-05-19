// schema/Event.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Event participant subdocument
const participantSchema = new Schema({
  userId:          { type: String, required: true, trim: true },
  username:        { type: String, trim: true },
  discordUsername: { type: String, trim: true },
  joinedAt:        { type: Date, default: Date.now }
}, { _id: false });

// Main Event schema, now per-game
const eventSchema = new Schema({
  guildId:       { type: String, required: true, index: true, trim: true },
  gameKey:       { type: String, required: true, index: true, lowercase: true, trim: true },
  parameterName: { type: String, required: true, lowercase: true, trim: true },
  isActive:      { type: Boolean, default: true },
  code:          { type: String, required: true, trim: true },
  participants:  [participantSchema]
}, {
  timestamps: true
});

// Composite unique index to ensure unique event codes per guild/game
eventSchema.index({ guildId: 1, gameKey: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Event', eventSchema);
