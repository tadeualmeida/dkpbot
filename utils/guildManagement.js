//guildManagement.js

const { scheduleJob, cancelScheduledJob } = require('./scheduler');
const Dkp = require('../schema/Dkp');
const GuildConfig = require('../schema/GuildConfig');
const Event = require('../schema/Event');
const { clearCache } = require('./cacheManagement');

const scheduledDeletions = new Map();

async function checkForOrphanedGuilds(client) {
    try {
        const allGuildIds = new Set(client.guilds.cache.keys());
        const storedGuilds = await GuildConfig.distinct('guildId');

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

    const job = await scheduleJob(guildId, guildId, 1440, async () => {  // 1440 minutes = 24 hours
        try {
            console.log(`Deleting data for guild ${guildId}.`);

            const deletePromises = [
                Dkp.deleteMany({ guildId }),
                Event.deleteMany({ guildId }),
                GuildConfig.deleteMany({ guildId })
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
    cancelScheduledJob(guildId);
    scheduledDeletions.delete(guildId);
    console.log(`Cancelled deletion for guild ${guildId}`);
}

module.exports = { checkForOrphanedGuilds, scheduleGuildDeletion, cancelScheduledGuildDeletion };
