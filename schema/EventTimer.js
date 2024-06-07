// EventTimer.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EventTimerSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  EventTimer: { type: Number, default: 10 }
}, { timestamps: true });

const EventTimer = mongoose.model('EventTimer', EventTimerSchema);

module.exports = EventTimer;