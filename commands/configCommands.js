// configCommands.js

const {
    getGuildCache,
    refreshDkpParametersCache,
    refreshDkpMinimumCache,
    getDkpMinimumFromCache,
    getChannelsFromCache,
    getEventTimerFromCache,
    refreshEventTimerCache,
    refreshGuildConfigCache,
    refreshRoleConfigCache
} = require('../utils/cacheManagement');
const {
    createDkpParameterDefinedEmbed,
    createMultipleResultsEmbed,
    createInfoEmbed,
    createErrorEmbed
} = require('../utils/embeds');
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
    const points = interaction.options.getInteger('points');

    const guildConfig = await GuildConfig.findOne({ guildId });
    if (!guildConfig) return replyWithError(interaction, null, "Guild configuration not found.");

    switch (action) {
        case 'add':
        case 'edit':
            if (points == null) return replyWithError(interaction, null, "You must specify a valid points value.");
            const paramIndex = guildConfig.dkpParameters.findIndex(param => param.name === name);
            if (paramIndex !== -1) {
                guildConfig.dkpParameters[paramIndex].points = points;
            } else {
                guildConfig.dkpParameters.push({ name, points });
            }
            await saveAndRefresh(guildConfig, guildId, 'added', name, points, refreshDkpParametersCache, interaction);
            break;

        case 'remove':
            guildConfig.dkpParameters = guildConfig.dkpParameters.filter(param => param.name !== name);
            await saveAndRefresh(guildConfig, guildId, 'removed', name, null, refreshDkpParametersCache, interaction);
            break;

        case 'minimum':
            if (points == null) return replyWithError(interaction, null, "You must specify a valid minimum points value.");
            guildConfig.minimumPoints = points;
            await saveAndRefresh(guildConfig, guildId, null, null, null, refreshDkpMinimumCache, interaction, 'Minimum DKP Points Set', `Minimum DKP points set to ${points} successfully.`);
            break;
    }
}

async function handleConfigChannel(interaction, guildId) {
    const action = interaction.options.getString('action');
    const channel = interaction.options.getChannel('channel');

    const guildConfig = await GuildConfig.findOne({ guildId });
    if (!guildConfig) return replyWithError(interaction, null, "Guild configuration not found.");

    switch (action) {
        case 'add':
            if (guildConfig.channels.includes(channel.id)) return replyWithError(interaction, null, 'This channel is already added.');
            guildConfig.channels.push(channel.id);
            await saveAndRefresh(guildConfig, guildId, 'added', `Channel <#${channel.id}>`, null, refreshGuildConfigCache, interaction);
            break;

        case 'remove':
            if (!guildConfig.channels.includes(channel.id)) return replyWithError(interaction, null, 'This channel is not configured.');
            guildConfig.channels = guildConfig.channels.filter(id => id !== channel.id);
            await saveAndRefresh(guildConfig, guildId, 'removed', `Channel <#${channel.id}>`, null, refreshGuildConfigCache, interaction);
            break;
    }
}

async function handleConfigShow(interaction, guildId) {
    const action = interaction.options.getString('action');
    const guildConfig = await GuildConfig.findOne({ guildId });
    if (!guildConfig) return replyWithError(interaction, null, "Guild configuration not found.");

    switch (action) {
        case 'parameters':
            const descriptions = guildConfig.dkpParameters.map(param => `${param.name}: **${param.points}** points`);
            await interaction.reply({ embeds: [createMultipleResultsEmbed('info', 'DKP Parameters List', descriptions)], ephemeral: true });
            break;

        case 'channels':
            const channelList = guildConfig.channels.map(id => `<#${id}>`).join('\n');
            if (channelList) {
                await interaction.reply({ embeds: [createInfoEmbed('Configured Channels', channelList)], ephemeral: true });
            } else {
                await interaction.reply({ content: 'No channels configured.', ephemeral: true });
            }
            break;

        case 'minimum':
            const minimumDkp = guildConfig.minimumPoints || 'Not set';
            const description = `Minimum DKP: **${minimumDkp}** points.`;
            await interaction.reply({ embeds: [createInfoEmbed('Minimum DKP', description)], ephemeral: true });
            break;

        case 'event':
            const eventTimer = guildConfig.eventTimer || 'Not set';
            const descriptionEvent = `Event Timeout: **${eventTimer}** minutes.`;
            await interaction.reply({ embeds: [createInfoEmbed('Event Timeout', descriptionEvent)], ephemeral: true });
            break;
    }
}

async function handleConfigEvent(interaction, guildId) {
    const action = interaction.options.getString('action');
    const minutes = interaction.options.getInteger('minutes');

    const guildConfig = await GuildConfig.findOne({ guildId });
    if (!guildConfig) return replyWithError(interaction, null, "Guild configuration not found.");

    if (action === 'timer') {
        if (minutes == null || minutes <= 0) return replyWithError(interaction, null, "You must specify a valid timeout duration in minutes.");
        guildConfig.eventTimer = minutes;
        await saveAndRefresh(guildConfig, guildId, null, null, null, refreshEventTimerCache, interaction, 'Event Timeout Set', `Event timeout set to ${minutes} minutes successfully.`);
    }
}

async function handleSetRoleCommand(interaction, guildId) {
    const commandGroup = interaction.options.getString('commandgroup');
    const role = interaction.options.getRole('role');

    const guildConfig = await GuildConfig.findOne({ guildId });
    if (!guildConfig) return replyWithError(interaction, null, "Guild configuration not found.");

    const existingRoleConfig = guildConfig.roles.find(r => r.commandGroup === commandGroup);
    if (existingRoleConfig) {
        existingRoleConfig.roleId = role.id;
    } else {
        guildConfig.roles.push({ commandGroup, roleId: role.id });
    }

    await saveAndRefresh(guildConfig, guildId, null, null, null, () => {
        refreshGuildConfigCache(guildId);
        refreshRoleConfigCache(guildId);
    }, interaction, 'Role Set', `Role **${role.name}** has been set for command group **${commandGroup}**.`);
}

async function handleSetGuildName(interaction, guildId) {
    const guildName = interaction.options.getString('name');
    const guildConfig = await GuildConfig.findOne({ guildId });
    if (!guildConfig) return replyWithError(interaction, null, "Guild configuration not found.");

    guildConfig.guildName = guildName;
    await saveAndRefresh(guildConfig, guildId, null, null, null, refreshGuildConfigCache, interaction, 'Guild Name Set', `The guild name has been set to **${guildName}**.`);
}

async function saveAndRefresh(guildConfig, guildId, actionText, name, points, refreshCacheFn, interaction, title = null, description = null) {
    await guildConfig.save();
    await refreshCacheFn(guildId);
    if (title && description) {
        await interaction.reply({ embeds: [createInfoEmbed(title, description)], ephemeral: true });
    } else {
        await interaction.reply({ embeds: [createDkpParameterDefinedEmbed(name, points, actionText)], ephemeral: true });
    }
}

module.exports = { handleConfigCommands };
