const { getDkpParameterFromCache, refreshDkpParametersCache, getGuildCache } = require('../utils/cacheManagement');
const { createDkpBalanceEmbed, createDkpParameterDefinedEmbed, createMultipleResultsEmbed, createInfoEmbed } = require('../utils/embeds');
const { Dkp, DkpTotal, updateDkpTotal } = require('../schema/Dkp');
const DkpParameter = require('../schema/DkParameter');
const ChannelConfig = require('../schema/ChannelConfig');
const dkpCache = {};

async function handleDkpCommands(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cacheKey = `${guildId}_${userId}`;

    let userDkp = dkpCache[cacheKey] || await Dkp.findOne({ guildId: guildId, userId: userId });

    if (!userDkp) {
        userDkp = await Dkp.create({ userId, guildId, points: 0 });
        dkpCache[cacheKey] = userDkp;
    }

    switch (interaction.commandName) {
        case 'dkp':
            await interaction.reply({ embeds: [createDkpBalanceEmbed(userDkp)], ephemeral: true });
            break;
        case 'dkpadd':
        case 'dkpremove':
            await handleDkpAddRemove(interaction, userId, guildId, interaction.commandName === 'dkpadd');
            break;
        case 'rank':
            await handleDkpRank(interaction, guildId);
            break;
        case 'config':
            await handleConfig(interaction, guildId);
            break;
    }
}

async function handleDkpAddRemove(interaction, userId, guildId, isAdd) {
    const pointsToModify = interaction.options.getInteger('points');
    const userIDsInput = interaction.options.getString('users');
    const executingUser = interaction.user.username;

    if (!userIDsInput) {
        await interaction.reply({ content: "You must specify at least one user ID.", ephemeral: true });
        return;
    }

    const userIDs = userIDsInput.split(/[\s,]+/).filter(id => id);
    let descriptions = [];
    let totalPointsModified = 0;

    for (let userID of userIDs) {
        userID = userID.trim().replace(/<@|>/g, '');
        try {
            let userToModify;
            if (!userID.match(/^\d+$/)) {
                userToModify = interaction.guild.members.cache.find(member => member.user.username === userID);
                if (!userToModify) {
                    descriptions.push(`User ${userID} not found.`);
                    continue;
                }
                userID = userToModify.user.id;
            } else {
                userToModify = await interaction.client.users.fetch(userID);
            }
            let pointChange = isAdd ? pointsToModify : -pointsToModify;
            const userDkp = await Dkp.findOne({ userId: userID, guildId: guildId }) || await Dkp.create({ userId: userID, guildId: guildId, points: 0 });
            if (!isAdd && userDkp.points + pointChange < 0) {
                pointChange = -userDkp.points;
            }
            const updatedDkp = await Dkp.findOneAndUpdate(
                { userId: userID, guildId: guildId },
                { $inc: { points: pointChange },
                  $push: { transactions: { type: isAdd ? 'add' : 'remove', amount: pointChange, description: `${executingUser} ${isAdd ? 'added' : 'removed'} points` } }},
                { new: true, upsert: true });
            descriptions.push(`${pointChange > 0 ? 'Added' : 'Removed'} **${Math.abs(pointChange)}** points to <@${userID}>. Now have **${updatedDkp.points}** points.`);
            totalPointsModified += pointChange;
        } catch (error) {
            console.error(`Failed to modify points for user ID ${userID} due to an error:`, error);
            descriptions.push(`Failed to modify points for user ID <@${userID}> due to an error.`);
        }
    }

    if (totalPointsModified !== 0) {
        await updateDkpTotal(totalPointsModified, guildId);
    }

    const resultsEmbed = createMultipleResultsEmbed('info', `DKP ${isAdd ? 'Addition' : 'Removal'} Results`, descriptions);
    await interaction.reply({ embeds: [resultsEmbed], ephemeral: true });
}

async function handleDkpRank(interaction, guildId) {
    try {
        const allUsers = await Dkp.find({ guildId: guildId }).sort({ points: -1 });
        if (!allUsers.length) {
            await interaction.reply({ content: "No DKP data available.", ephemeral: true });
            return;
        }

        const descriptions = allUsers.map((user, index) => `${index + 1}. <@${user.userId}> - ${user.points.toFixed(0)} points`);
        const rankEmbed = createMultipleResultsEmbed('info', 'DKP Ranking', descriptions);

        await interaction.reply({ embeds: [rankEmbed], ephemeral: true });
    } catch (error) {
        console.error('Failed to retrieve DKP rankings:', error);
        await interaction.reply({ content: 'Failed to retrieve DKP rankings due to an error.', ephemeral: true });
    }
}

async function handleConfig(interaction, guildId) {
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
        const name = interaction.options.getString('name').toLowerCase();
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

    //if (!channel) {
    //    await interaction.reply({ content: 'You must specify a channel.', ephemeral: true });
    //    return;
    //}

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
            await interaction.reply({ embeds: [createInfoEmbed('Configured Channels', channels )], ephemeral: true });
        } else {
            await interaction.reply({ content: 'No channels configured.', ephemeral: true });
        }
    }
}

module.exports = { handleDkpCommands };
