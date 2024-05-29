const mongoose = require('mongoose');

const ChannelConfigSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    channels: {
        type: [String],
        default: []
    }
});

const ChannelConfig = mongoose.model('ChannelConfig', ChannelConfigSchema);

module.exports = ChannelConfig;
