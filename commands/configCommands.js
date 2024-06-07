// configCommands.js

const { getGuildCache, refreshDkpParametersCache, refreshDkpMinimumCache, getDkpMinimumFromCache, getChannelsFromCache, getEventTimerFromCache, refreshEventTimerCache } = require('../utils/cacheManagement');
const { createDkpParameterDefinedEmbed, createMultipleResultsEmbed, createInfoEmbed, createErrorEmbed } = require('../utils/embeds');
const DkpParameter = require('../schema/DkParameter');
const ChannelConfig = require('../schema/ChannelConfig');
const DkpMinimum = require('../schema/DkpMinimum');
const RoleConfig = require('../schema/RoleConfig');
const EventTimer = require('../schema/EventTimer');
const validator = require('validator');

async function handleConfigCommands(interaction) {
    const guildId = interaction.guildId;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'dkp':
            await handleConfigDkp(interaction, guildId);
            break;
        case 'channel':
            await handleConfigChannel(interaction, guildId);
            break;
        case 'role':
            await handleSetRoleCommand(interaction, guildId);
            break;
        case 'show':
            await handleConfigShow(interaction, guildId);
            break;
        case 'event':
            await handleConfigEvent(interaction, guildId);
            break;
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
    } else if (action === 'event') {
        const eventTimer = await getEventTimerFromCache(guildId);
        const description = `Event Timeout: **${eventTimer}** minutes.`;
        await interaction.reply({ embeds: [createInfoEmbed('Event Timeout', description)], ephemeral: true });
    }
}

async function handleConfigEvent(interaction, guildId) {
    const action = interaction.options.getString('action');
    if (action === 'timer') {
        const minutes = interaction.options.getInteger('minutes');
        if (minutes == null || minutes <= 0) {
            await interaction.reply({ embeds: [createErrorEmbed("You must specify a valid timeout duration in minutes.")], ephemeral: true });
            return;
        }

        await EventTimer.findOneAndUpdate(
            { guildId },
            { $set: { EventTimer: minutes } },
            { new: true, upsert: true }
        );

        await refreshEventTimerCache(guildId); // Atualiza o cache do timeout do evento

        await interaction.reply({ embeds: [createInfoEmbed('Event Timeout Set', `Event timeout set to ${minutes} minutes successfully.`)], ephemeral: true });
    }
}

async function handleSetRoleCommand(interaction, guildId) {
    const commandGroup = interaction.options.getString('commandgroup');
    const role = interaction.options.getRole('role');

    try {
        await RoleConfig.updateOne(
            { commandGroup, guildId },
            { $set: { roleId: role.id } },
            { upsert: true }
        );
        await interaction.reply({ embeds: [createInfoEmbed('Role Set', `Role **${role.name}** has been set for command group **${commandGroup}**.`)], ephemeral: true });
    } catch (error) {
        console.error('Error setting role:', error);
        await interaction.reply({ embeds: [createErrorEmbed('Failed to set role due to an error.')], ephemeral: true });
    }
}

module.exports = { handleConfigCommands };
