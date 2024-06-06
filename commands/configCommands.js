const { getGuildCache, refreshDkpParametersCache, refreshDkpMinimumCache, getDkpParameterFromCache, getDkpMinimumFromCache, getChannelsFromCache } = require('../utils/cacheManagement');
const { createDkpParameterDefinedEmbed, createMultipleResultsEmbed, createInfoEmbed, createErrorEmbed } = require('../utils/embeds');
const DkpParameter = require('../schema/DkParameter');
const ChannelConfig = require('../schema/ChannelConfig');
const DkpMinimum = require('../schema/DkpMinimum');
const validator = require('validator');

async function handleConfigCommands(interaction) {
    const guildId = interaction.guildId;
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'dkp') {
        await handleConfigDkp(interaction, guildId);
    } else if (subcommand === 'channel') {
        await handleConfigChannel(interaction, guildId);
    } else if (subcommand === 'show') {
        await handleConfigShow(interaction, guildId);
    }
}

async function handleConfigDkp(interaction, guildId) {
    const action = interaction.options.getString('action');
    const name = interaction.options.getString('name') ? validator.escape(interaction.options.getString('name').toLowerCase()) : null;
    
    if ((action === 'remove' || action === 'edit') && !name) {
        await interaction.reply({ embeds: [createErrorEmbed("Parameter name is required for remove and edit actions.")], ephemeral: true });
        return;
    }

    if (action === 'add' || action === 'edit') {
        const points = interaction.options.getInteger('points');
        if (points == null) {
            await interaction.reply({ embeds: [createErrorEmbed("You must specify a valid points value.")], ephemeral: true });
            return;
        }
        const updatedParameter = await DkpParameter.findOneAndUpdate(
            { name, guildId },
            { $set: { points } },
            { new: true, upsert: true }
        );
        await refreshDkpParametersCache(guildId);
        const actionText = action === 'add' ? 'added' : 'edited';
        await interaction.reply({ embeds: [createDkpParameterDefinedEmbed(name, updatedParameter.points, actionText)], ephemeral: true });
    } else if (action === 'remove') {
        await DkpParameter.findOneAndDelete({ guildId, name });
        await refreshDkpParametersCache(guildId);
        await interaction.reply({ embeds: [createDkpParameterDefinedEmbed(name, null, 'removed')], ephemeral: true });
    } else if (action === 'minimum') {
        const minimumPoints = interaction.options.getInteger('points');
        if (minimumPoints == null) {
            await interaction.reply({ embeds: [createErrorEmbed("You must specify a valid minimum points value.")], ephemeral: true });
            return;
        }
        await DkpMinimum.findOneAndUpdate(
            { guildId },
            { $set: { minimumPoints } },
            { new: true, upsert: true }
        );
        await refreshDkpMinimumCache(guildId);
        await interaction.reply({ embeds: [createInfoEmbed('Minimum DKP Points Set', `Minimum DKP points set to ${minimumPoints} successfully.`)], ephemeral: true });
    }
}

async function handleConfigChannel(interaction, guildId) {
    const action = interaction.options.getString('action');
    const channel = interaction.options.getChannel('channel');
    const existingConfig = await ChannelConfig.findOne({ guildId });

    if (action === 'add') {
        if (existingConfig) {
            if (existingConfig.channels.includes(channel.id)) {
                await interaction.reply({ embeds: [createErrorEmbed('This channel is already added.')], ephemeral: true });
                return;
            }
            existingConfig.channels.push(channel.id);
            await existingConfig.save();
        } else {
            const newConfig = new ChannelConfig({ guildId, channels: [channel.id] });
            await newConfig.save();
        }
        await interaction.reply({ embeds: [createInfoEmbed('Channel Added', `Channel <#${channel.id}> added successfully.`)], ephemeral: true });
    } else if (action === 'remove') {
        if (!existingConfig || !existingConfig.channels.includes(channel.id)) {
            await interaction.reply({ embeds: [createErrorEmbed('This channel is not configured.')], ephemeral: true });
            return;
        }
        existingConfig.channels = existingConfig.channels.filter(id => id !== channel.id);
        await existingConfig.save();
        await interaction.reply({ embeds: [createInfoEmbed('Channel Removed', `Channel <#${channel.id}> removed successfully.`)], ephemeral: true });
    } 
}

async function handleConfigShow(interaction, guildId) {
    const action = interaction.options.getString('action');

    if (action === 'parameters') {
        const guildCache = getGuildCache(guildId);
        const allParameters = guildCache.keys()
            .filter(key => key.startsWith('dkpParameter:'))
            .map(key => guildCache.get(key))
            .filter(param => param && param.guildId === guildId);
        const descriptions = allParameters.map(param => `${param.name}: **${param.points}** points`);
        await interaction.reply({ embeds: [createMultipleResultsEmbed('info', 'DKP Parameters List', descriptions)], ephemeral: true });
    } else if (action === 'channels') {
        const channels = await getChannelsFromCache(guildId);
        if (channels.length > 0) {
            const channelList = channels.map(id => `<#${id}>`).join('\n');
            await interaction.reply({ embeds: [createInfoEmbed('Configured Channels', channelList)], ephemeral: true });
        } else {
            await interaction.reply({ content: 'No channels configured.', ephemeral: true });
        }
    } else if (action === 'minimum') {
        const minimumDkp = await getDkpMinimumFromCache(guildId);
        const description = minimumDkp !== null ? `Minimum DKP: **${minimumDkp}** points.` : 'No minimum DKP set.';
        await interaction.reply({ embeds: [createInfoEmbed('Minimum DKP', description)], ephemeral: true });
    }
}

module.exports = { handleConfigCommands };
