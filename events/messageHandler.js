// events/messageHandler.js

const { getActiveEventsFromCache } = require('../utils/cacheManagement');
const { createInfoEmbed } = require('../utils/embeds');

async function handleMessageCreate(message) {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  let activeEvents = getActiveEventsFromCache(guildId);

  // Normalize activeEvents into an array
  if (!Array.isArray(activeEvents)) {
    if (activeEvents instanceof Map) {
      activeEvents = Array.from(activeEvents.values());
    } else if (typeof activeEvents === 'object' && activeEvents !== null) {
      activeEvents = Object.values(activeEvents);
    } else {
      activeEvents = [];
    }
  }

  // If someone types an event code in chat, intercept
  const found = activeEvents.find(evt => message.content.includes(evt.code));
  if (found) {
    await message.delete().catch(() => {});
    try {
      const embed = createInfoEmbed(
        'Event Code Detected',
        `Please do not type the event code in channels. Use \`/join ${found.code}\` to join the event.`
      );
      await message.author.send({ embeds: [embed] });
    } catch (err) {
      console.error(`Could not DM ${message.author.tag}:`, err);
    }
    return;
  }

  // Also intercept manual "/join CODE" attempts
  if (message.content.startsWith('/join ')) {
    const [, code] = message.content.split(/\s+/);
    const evt = activeEvents.find(e => e.code === code);
    if (evt) {
      await message.delete().catch(() => {});
      try {
        const embed = createInfoEmbed(
          'Join Event',
          `Please use the slash command instead: \`/join ${evt.code}\`.`
        );
        await message.author.send({ embeds: [embed] });
      } catch (err) {
        console.error(`Could not DM ${message.author.tag}:`, err);
      }
    }
  }
}

async function sendUserNotification(user, pointChange, totalPoints, description) {
  const action = pointChange > 0 ? 'gained' : 'lost';
  const embed = createInfoEmbed(
    `DKP ${action.charAt(0).toUpperCase() + action.slice(1)}`,
    `You have ${action} **${Math.abs(pointChange)}** DKP. You now have **${totalPoints}** DKP.` +
      (description ? `\n\nReason: **${description}**` : '')
  );
  try {
    await user.send({ embeds: [embed] });
  } catch (err) {
    console.error(`Failed to DM ${user.id}:`, err);
  }
}

module.exports = { handleMessageCreate, sendUserNotification };
