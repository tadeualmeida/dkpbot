// /utils/crowManager.js
const GuildBank = require('../schema/GuildBank');

async function addCrows(guildId, amount) {
    return GuildBank.findOneAndUpdate({ guildId }, { $inc: { crows: amount } }, { new: true, upsert: true });
}

async function removeCrows(guildId, amount) {
    return GuildBank.findOneAndUpdate({ guildId }, { $inc: { crows: -amount } }, { new: true });
}

async function getCrows(guildId) {
    const guildBank = await GuildBank.findOne({ guildId });
    return guildBank ? guildBank.crows : 0;
}

module.exports = { addCrows, removeCrows, getCrows };
