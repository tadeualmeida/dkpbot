// GuildConfig.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const guildConfigSchema = new Schema({
    guildId: { type: String, required: true, trim: true, index: true },
    guildName: { type: String, required: true, trim: true }
}, { timestamps: true });

const GuildConfig = mongoose.model('GuildConfig', guildConfigSchema);

module.exports = GuildConfig;
