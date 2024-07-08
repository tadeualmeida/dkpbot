// messageHandler.js

const { getActiveEventsFromCache } = require('../utils/cacheManagement');
const { createInfoEmbed, createErrorEmbed } = require('../utils/embeds');

async function handleMessageCreate(message) {
    if (message.author.bot) return;

    const guildId = message.guild.id;
    const activeEvents = getActiveEventsFromCache(guildId);

    const event = activeEvents.find(event => message.content.includes(event.code));
    if (event) {
        await message.delete();

        try {
            const embed = createInfoEmbed('Event Code', `Please do not type the event code in the channels. To join the event, use the command \`/join ${event.code}\`.`);
            await message.author.send({ embeds: [embed] });
        } catch (error) {
            console.error(`Could not send a direct message to user ${message.author.tag}:`, error);
        }
    } else if (message.content.startsWith('/join')) {
        const eventCode = message.content.split(' ')[1];
        const activeEvent = activeEvents.find(event => event.code === eventCode);
        if (activeEvent) {
            await message.delete();

            try {
                const embed = createInfoEmbed('Event Code', `Please do not type the event code in the channels. To join the event, use the command \`/join ${activeEvent.code}\`.`);
                await message.author.send({ embeds: [embed] });
            } catch (error) {
                console.error(`Could not send a direct message to user ${message.author.tag}:`, error);
            }
        }
    }
}

async function sendUserNotification(user, pointChange, totalPoints, description) {
    const action = pointChange > 0 ? 'gained' : 'lost';
    const message = `You have ${action} **${Math.abs(pointChange)}** DKP. You now have a total of **${totalPoints}** DKP.${description ? `\n\nReason: **${description}**` : ''}`;
    const embed = createInfoEmbed(`DKP ${action.charAt(0).toUpperCase() + action.slice(1)}`, message);

    try {
        await user.send({ embeds: [embed] });
    } catch (error) {
        console.error(`Failed to send a direct message to user ${user.displayName}:`, error);
    }
}

module.exports = { handleMessageCreate, sendUserNotification };
