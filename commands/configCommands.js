// configCommands.js

const { 
    getGuildCache, 
    refreshDkpParametersCache, 
    refreshDkpMinimumCache, 
    getDkpMinimumFromCache, 
    getChannelsFromCache, 
    getEventTimerFromCache, 
    refreshEventTimerCache, 
    refreshGuildConfigCache 
} = require('../utils/cacheManagement');
const { createDkpParameterDefinedEmbed, createMultipleResultsEmbed, createInfoEmbed, createErrorEmbed } = require('../utils/embeds');
const { replyWithError } = require('../utils/generalUtils');
const validator = require('validator');
const GuildConfig = require('../schema/GuildConfig');

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
        case 'guildname':
            await handleSetGuildName(interaction, guildId);
            break;
    }
}

async function handleConfigDkp(interaction, guildId) {
    const action = interaction.options.getString('action');
    const name = interaction.options.getString('name') ? validator.escape(interaction.options.getString('name').toLowerCase()) : null;
    
    if ((action === 'remove' || action === 'edit') && !name) {
        await replyWithError(interaction, null, "Parameter name is required for remove and edit actions.");
        return;
    }

    const guildConfig = await GuildConfig.findOne({ guildId });

    if (!guildConfig) {
        await replyWithError(interaction, null, "Guild configuration not found.");
        return;
    }

    if (action === 'add' || action === 'edit') {
        const points = interaction.options.getInteger('points');
        if (points == null) {
            await replyWithError(interaction, null, "You must specify a valid points value.");
            return;
        }
        const existingParameterIndex = guildConfig.dkpParameters.findIndex(param => param.name === name);
        if (existingParameterIndex !== -1) {
            guildConfig.dkpParameters[existingParameterIndex].points = points;
        } else {
            guildConfig.dkpParameters.push({ name, points });
        }
        await guildConfig.save();
        await refreshDkpParametersCache(guildId);
        const actionText = action === 'add' ? 'added' : 'edited';
        await interaction.reply({ embeds: [createDkpParameterDefinedEmbed(name, points, actionText)], ephemeral: true });
    } else if (action === 'remove') {
        guildConfig.dkpParameters = guildConfig.dkpParameters.filter(param => param.name !== name);
        await guildConfig.save();
        await refreshDkpParametersCache(guildId);
        await interaction.reply({ embeds: [createDkpParameterDefinedEmbed(name, null, 'removed')], ephemeral: true });
    } else if (action === 'minimum') {
        const minimumPoints = interaction.options.getInteger('points');
        if (minimumPoints == null) {
            await replyWithError(interaction, null, "You must specify a valid minimum points value.");
            return;
        }
        guildConfig.minimumPoints = minimumPoints;
        await guildConfig.save();
        await refreshDkpMinimumCache(guildId);
        await interaction.reply({ embeds: [createInfoEmbed('Minimum DKP Points Set', `Minimum DKP points set to ${minimumPoints} successfully.`)], ephemeral: true });
    }
}

async function handleConfigChannel(interaction, guildId) {
    const action = interaction.options.getString('action');
    const channel = interaction.options.getChannel('channel');
    const guildConfig = await GuildConfig.findOne({ guildId });

    if (!guildConfig) {
        await replyWithError(interaction, null, "Guild configuration not found.");
        return;
    }

    if (action === 'add') {
        if (guildConfig.channels.includes(channel.id)) {
            await replyWithError(interaction, null, 'This channel is already added.');
            return;
        }
        guildConfig.channels.push(channel.id);
        await guildConfig.save();
        await refreshGuildConfigCache(guildId);
        await interaction.reply({ embeds: [createInfoEmbed('Channel Added', `Channel <#${channel.id}> added successfully.`)], ephemeral: true });
    } else if (action === 'remove') {
        if (!guildConfig.channels.includes(channel.id)) {
            await replyWithError(interaction, null, 'This channel is not configured.');
            return;
        }
        guildConfig.channels = guildConfig.channels.filter(id => id !== channel.id);
        await guildConfig.save();
        await refreshGuildConfigCache(guildId);
        await interaction.reply({ embeds: [createInfoEmbed('Channel Removed', `Channel <#${channel.id}> removed successfully.`)], ephemeral: true });
    }
}

async function handleConfigShow(interaction, guildId) {
    const action = interaction.options.getString('action');
    const guildConfig = await GuildConfig.findOne({ guildId });

    if (!guildConfig) {
        await replyWithError(interaction, null, "Guild configuration not found.");
        return;
    }

    if (action === 'parameters') {
        const descriptions = guildConfig.dkpParameters.map(param => `${param.name}: **${param.points}** points`);
        await interaction.reply({ embeds: [createMultipleResultsEmbed('info', 'DKP Parameters List', descriptions)], ephemeral: true });
    } else if (action === 'channels') {
        const channelList = guildConfig.channels.map(id => `<#${id}>`).join('\n');
        if (channelList) {
            await interaction.reply({ embeds: [createInfoEmbed('Configured Channels', channelList)], ephemeral: true });
        } else {
            await interaction.reply({ content: 'No channels configured.', ephemeral: true });
        }
    } else if (action === 'minimum') {
        const minimumDkp = guildConfig.minimumPoints || 'Not set';
        const description = `Minimum DKP: **${minimumDkp}** points.`;
        await interaction.reply({ embeds: [createInfoEmbed('Minimum DKP', description)], ephemeral: true });
    } else if (action === 'event') {
        const eventTimer = guildConfig.eventTimer || 'Not set';
        const description = `Event Timeout: **${eventTimer}** minutes.`;
        await interaction.reply({ embeds: [createInfoEmbed('Event Timeout', description)], ephemeral: true });
    }
}

async function handleConfigEvent(interaction, guildId) {
    const action = interaction.options.getString('action');
    const guildConfig = await GuildConfig.findOne({ guildId });

    if (!guildConfig) {
        await replyWithError(interaction, null, "Guild configuration not found.");
        return;
    }

    if (action === 'timer') {
        const minutes = interaction.options.getInteger('minutes');
        if (minutes == null || minutes <= 0) {
            await replyWithError(interaction, null, "You must specify a valid timeout duration in minutes.");
            return;
        }
        guildConfig.eventTimer = minutes;
        await guildConfig.save();
        await refreshEventTimerCache(guildId);
        await interaction.reply({ embeds: [createInfoEmbed('Event Timeout Set', `Event timeout set to ${minutes} minutes successfully.`)], ephemeral: true });
    }
}

async function handleSetRoleCommand(interaction, guildId) {
    const commandGroup = interaction.options.getString('commandgroup');
    const role = interaction.options.getRole('role');
    const guildConfig = await GuildConfig.findOne({ guildId });

    if (!guildConfig) {
        await replyWithError(interaction, null, "Guild configuration not found.");
        return;
    }

    const existingRoleConfig = guildConfig.roles.find(r => r.commandGroup === commandGroup);

    if (existingRoleConfig) {
        existingRoleConfig.roleId = role.id;
    } else {
        guildConfig.roles.push({ commandGroup, roleId: role.id });
    }

    await guildConfig.save();
    await refreshGuildConfigCache(guildId);
    await refreshRoleConfigCache(guildId);
    await interaction.reply({ embeds: [createInfoEmbed('Role Set', `Role **${role.name}** has been set for command group **${commandGroup}**.`)], ephemeral: true });
}

async function handleSetGuildName(interaction, guildId) {
    const guildName = interaction.options.getString('name');
    const guildConfig = await GuildConfig.findOne({ guildId });

    if (!guildConfig) {
        await replyWithError(interaction, null, "Guild configuration not found.");
        return;
    }

    guildConfig.guildName = guildName;
    await guildConfig.save();
    await refreshGuildConfigCache(guildId);
    await interaction.reply({ embeds: [createInfoEmbed('Guild Name Set', `The guild name has been set to **${guildName}**.`)], ephemeral: true });
}

module.exports = { handleConfigCommands };
