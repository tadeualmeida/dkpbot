// channelUtils.js

const GuildConfig = require('../schema/GuildConfig');
const { createInfoEmbed } = require('./embeds');

async function sendMessageToConfiguredChannels(interaction, description, messageType) {
    const guildConfig = await GuildConfig.findOne({ guildId: interaction.guildId });
    if (guildConfig && guildConfig.channels.length > 0) {
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

        for (const channelId of guildConfig.channels) {
            const channel = interaction.client.channels.cache.get(channelId);
            if (channel) {
                await channel.send({ embeds: [createInfoEmbed(embedTitle, description)] });
            }
        }
    }
}

module.exports = { sendMessageToConfiguredChannels };
