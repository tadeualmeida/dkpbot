// GuildConfig.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roleConfigSchema = new Schema({
  commandGroup: { type: String, required: true, lowercase: true, trim: true },
  roleId: { type: String, required: true, trim: true }
}, { _id: false });

const dkpParameterSchema = new Schema({
  name: { type: String, required: true, lowercase: true, trim: true },
  points: { type: Number, required: true, min: 0 }
}, { _id: false });

const guildConfigSchema = new Schema({
  guildId: { type: String, required: true, trim: true, unique: true },
  guildName: { type: String, required: true, trim: true },
  eventTimer: { type: Number, default: 10 },
  minimumPoints: { type: Number, required: true, default: 0 },
  dkpParameters: [dkpParameterSchema],
  roles: [roleConfigSchema],
  channels: { type: [String], default: [] },
  totalDkp: { type: Number, default: 0 },
  crows: { type: Number, default: 0, min: 0 }  // Adicionando o campo crows
}, { timestamps: true });

const GuildConfig = mongoose.model('GuildConfig', guildConfigSchema);

module.exports = GuildConfig;
