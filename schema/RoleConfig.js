// RoleConfig.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roleConfigSchema = new Schema({
    guildId: { type: String, required: true, trim: true, index: true }, // Adicionado trim e index
    commandGroup: { type: String, required: true, lowercase: true, trim: true }, // Adicionado lowercase e trim
    roleId: { type: String, required: true, trim: true } // Adicionado trim
}, { timestamps: true });

// Define um índice único para a combinação de guildId e commandGroup
roleConfigSchema.index({ guildId: 1, commandGroup: 1 }, { unique: true });

const RoleConfig = mongoose.model('RoleConfig', roleConfigSchema);

module.exports = RoleConfig;
