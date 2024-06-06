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
    try {
        const allGuildIds = new Set(client.guilds.cache.keys());
        const storedGuilds = await Dkp.distinct('guildId');

        const orphanedGuilds = storedGuilds.filter(guildId => !allGuildIds.has(guildId));
        
        orphanedGuilds.forEach(guildId => {
            console.log(`Orphaned guild found: ${guildId}`);
            scheduleGuildDeletion(guildId);
        });
    } catch (error) {
        console.error('Error checking for orphaned guilds:', error);
    }
}

async function scheduleGuildDeletion(guildId) {
    console.log(`Scheduling deletion for guild ${guildId}`);

    const job = schedule.scheduleJob(Date.now() + 24 * 60 * 60 * 1000, async function() {
        try {
            console.log(`Deleting data for guild ${guildId}.`);

            const deletePromises = [
                Dkp.deleteMany({ guildId }),
                DkpTotal.deleteMany({ guildId }),
                Event.deleteMany({ guildId }),
                DkpParameter.deleteMany({ guildId }),
                ChannelConfig.deleteMany({ guildId }),
                GuildBank.deleteMany({ guildId }),
                RoleConfig.deleteMany({ guildId }),
                DkpMinimum.deleteMany({ guildId })
            ];

            await Promise.all(deletePromises);
            clearCache(guildId);
            
            console.log(`Successfully deleted data for guild ${guildId}.`);
            scheduledDeletions.delete(guildId);
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
