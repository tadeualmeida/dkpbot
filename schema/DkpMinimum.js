const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const dkpMinimumSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  minimumPoints: { type: Number, required: true }
}, { timestamps: true });

const DkpMinimum = mongoose.model('DkpMinimum', dkpMinimumSchema);

module.exports = DkpMinimum;
