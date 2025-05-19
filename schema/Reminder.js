//schema/Reminder.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReminderSchema = new Schema({
  guildId:         { type: String, required: true, index: true },
  gameKey:         { type: String, required: true },
  parameterName:   { type: String, required: true },
  targetTimestamp: { type: Date,   required: true, index: true },
  intervals:       [{ type: String }], // e.g. ['1h','30m','10m']
  createdAt:       { type: Date,   default: Date.now },
}, {
  timestamps: true,
});

// ensure one reminder per user+game+param
ReminderSchema.index(
  { guildId: 1, gameKey: 1, parameterName: 1 },
  { unique: true }
);

module.exports = mongoose.model('Reminder', ReminderSchema);
