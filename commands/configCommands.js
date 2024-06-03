const { getGuildCache, refreshDkpParametersCache, getDkpParameterFromCache } = require('../utils/cacheManagement');
const { createDkpParameterDefinedEmbed, createMultipleResultsEmbed, createInfoEmbed } = require('../utils/embeds');
const DkpParameter = require('../schema/DkParameter');
const ChannelConfig = require('../schema/ChannelConfig');
const validator = require('validator');

async function handleConfigCommands(interaction, guildId) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'dkp') {
        await handleConfigDkp(interaction, guildId);
    } else if (subcommand === 'channel') {
        await handleConfigChannel(interaction, guildId);
    }
}

async function handleConfigDkp(interaction, guildId) {
    const action = interaction.options.getString('action');
    if (action === 'add' || action === 'remove') {
        const name = validator.escape(interaction.options.getString('name').toLowerCase());
        const parameter = await getDkpParameterFromCache(guildId, name);
        if (!parameter && action === 'remove') {
            await interaction.reply({ content: "Parameter not found.", ephemeral: true });
            return;
        }
        if (action === 'add') {
            const points = interaction.options.getInteger('points');
            const updatedParameter = await DkpParameter.findOneAndUpdate(
                { name, guildId: guildId },
                { $set: { points } },
                { new: true, upsert: true }
            );
            await refreshDkpParametersCache(guildId);
            await interaction.reply({ embeds: [createDkpParameterDefinedEmbed(name, updatedParameter.points, 'added')], ephemeral: true });
        } else if (action === 'remove') {
            await DkpParameter.findOneAndDelete({ guildId, name });
            await refreshDkpParametersCache(guildId);
            await interaction.reply({ embeds: [createDkpParameterDefinedEmbed(name, null, 'removed')], ephemeral: true });
        }
    } else if (action === 'list') {
        const guildCache = getGuildCache(guildId);
        const allParameters = guildCache.keys().map(key => guildCache.get(key)).filter(param => param && param.guildId === guildId);
        const descriptions = allParameters.map(param => `${param.name}: **${param.points}** points`);
        await interaction.reply({ embeds: [createMultipleResultsEmbed('info', 'DKP Parameters List', descriptions)], ephemeral: true });
    }
}

async function handleConfigChannel(interaction, guildId) {
    const action = interaction.options.getString('action');
    const channel = interaction.options.getChannel('channel');

    const existingConfig = await ChannelConfig.findOne({ guildId });

    if (action === 'add') {
        if (existingConfig) {
            if (existingConfig.channels.includes(channel.id)) {
                await interaction.reply({ content: 'This channel is already added.', ephemeral: true });
            } else {
                existingConfig.channels.push(channel.id);
                await existingConfig.save();
                await interaction.reply({ content: `Channel <#${channel.id}> added successfully.`, ephemeral: true });
            }
        } else {
            const newConfig = new ChannelConfig({ guildId, channels: [channel.id] });
            await newConfig.save();
            await interaction.reply({ content: `Channel <#${channel.id}> added successfully.`, ephemeral: true });
        }
    } else if (action === 'remove') {
        if (existingConfig && existingConfig.channels.includes(channel.id)) {
            existingConfig.channels = existingConfig.channels.filter(id => id !== channel.id);
            await existingConfig.save();
            await interaction.reply({ content: `Channel <#${channel.id}> removed successfully.`, ephemeral: true });
        } else {
            await interaction.reply({ content: 'This channel is not configured.', ephemeral: true });
        }
    } else if (action === 'list') {
        if (existingConfig && existingConfig.channels.length > 0) {
            const channels = existingConfig.channels.map(id => `<#${id}>`).join('\n');
            await interaction.reply({ embeds: [createInfoEmbed('Configured Channels', channels)], ephemeral: true });
        } else {
            await interaction.reply({ content: 'No channels configured.', ephemeral: true });
        }
    }
}

module.exports = { handleConfigCommands };
