// channelUtils.js

const ChannelConfig = require('../schema/ChannelConfig');
const { createInfoEmbed } = require('./embeds');

async function sendMessageToConfiguredChannels(interaction, description, messageType) {
    const channelConfig = await ChannelConfig.findOne({ guildId: interaction.guildId });
    if (channelConfig && channelConfig.channels.length > 0) {
        let embedTitle;
        switch (messageType) {
            case 'dkp':
                embedTitle = 'DKP Info';
                break;
            case 'event':
                embedTitle = 'Event Info';
                break;
            case 'crow':
                embedTitle = 'Crow Info';
                break;
            default:
                embedTitle = 'Info';
        }

        for (const channelId of channelConfig.channels) {
            const channel = interaction.client.channels.cache.get(channelId);
            if (channel) {
                await channel.send({ embeds: [createInfoEmbed(embedTitle, description)] });
            }
        }
    }
}

module.exports = { sendMessageToConfiguredChannels };
