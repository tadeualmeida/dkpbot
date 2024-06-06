const schedule = require('node-schedule');
const { Dkp, DkpTotal } = require('../schema/Dkp');
const Event = require('../schema/Event');
const { clearCache } = require('./cacheManagement');
const DkpParameter = require('../schema/DkParameter');
const ChannelConfig = require('../schema/ChannelConfig');
const GuildBank = require('../schema/GuildBank');
const RoleConfig = require('../schema/RoleConfig');
const DkpMinimum = require('../schema/DkpMinimum');

const scheduledDeletions = new Map();

async function checkForOrphanedGuilds(client) {
    const allGuildIds = client.guilds.cache.map(guild => guild.id);
    const storedGuilds = await Dkp.distinct('guildId');
    
    for (const guildId of storedGuilds) {
        if (!allGuildIds.includes(guildId)) {
            console.log(`Orphaned guild find: ${guildId}`);
            await scheduleGuildDeletion(guildId);
        }
    }
}

async function scheduleGuildDeletion(guildId) {
    console.log(`Scheduling deletion for guild ${guildId}`);
    const job = schedule.scheduleJob(Date.now() + 24 * 60 * 60 * 1000, async function() {
        console.log(`Deleting data for guild ${guildId}.`);
        try {
            await Dkp.deleteMany({ guildId: guildId });
            await DkpTotal.deleteMany({ guildId: guildId });
            await Event.deleteMany({ guildId: guildId });
            await DkpParameter.deleteMany({ guildId: guildId });
            await ChannelConfig.deleteMany({ guildId: guildId });
            await GuildBank.deleteMany({ guildId: guildId });
            await RoleConfig.deleteMany({ guildId: guildId });
            await DkpMinimum.deleteMany({ guildId: guildId }); // Limpa o cache para a guilda
            clearCache(guildId); // Limpa o cache para a guilda
            console.log(`Successfully deleted data for guild ${guildId}.`);
            scheduledDeletions.delete(guildId); // Remove a referência após a execução
        } catch (error) {
            console.error(`Failed to delete data for guild ${guildId}:`, error);
        }
    });

    scheduledDeletions.set(guildId, job);
}

function cancelScheduledGuildDeletion(guildId) {
    const job = scheduledDeletions.get(guildId);
    if (job) {
        job.cancel();
        scheduledDeletions.delete(guildId);
        console.log(`Cancelled deletion for guild ${guildId}`);
    }
}

module.exports = { checkForOrphanedGuilds, scheduleGuildDeletion, cancelScheduledGuildDeletion };
