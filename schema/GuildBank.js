const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const guildBankSchema = new Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    crows: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

guildBankSchema.pre('save', function(next) {
    if (this.isModified('crows') && this.crows < 0) {
        return next(new Error('Crows cannot be negative'));
    }
    next();
});

const GuildBank = mongoose.model('GuildBank', guildBankSchema);

module.exports = GuildBank;
