// messageHandler.js

const { getActiveEventsFromCache } = require('../utils/cacheManagement');

async function handleMessageCreate(message) {
    if (message.author.bot) return;

    const guildId = message.guild.id;
    const activeEvents = getActiveEventsFromCache(guildId);

    const event = activeEvents.find(event => message.content.includes(event.code));
    if (event) {
        await message.delete();

        try {
            await message.author.send(`Please do not type the event code in the channels. To join the event, use the command \`/join ${event.code}\`.`);
        } catch (error) {
            console.error(`Could not send a direct message to user ${message.author.tag}:`, error);
        }
    } else if (message.content.startsWith('/join')) {
        const eventCode = message.content.split(' ')[1];
        const activeEvent = activeEvents.find(event => event.code === eventCode);
        if (activeEvent) {
            await message.delete();

            try {
                await message.author.send(`Please do not type the event code in the channels. To join the event, use the command \`/join ${activeEvent.code}\`.`);
            } catch (error) {
                console.error(`Could not send a direct message to user ${message.author.tag}:`, error);
            }
        }
    }
}

module.exports = { handleMessageCreate };
