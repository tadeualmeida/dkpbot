// events/messageHandler.js

const { getActiveEventsFromCache } = require('../utils/cacheManagement');
const { createInfoEmbed }          = require('../utils/embeds');
const { enqueueAction }            = require('../utils/messageQueue');

/**
 * Intercepts plain‐text messages that match active event codes
 * or manual “/join CODE” attempts and redirects users to the slash commands.
 */
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

  // 1) If someone mentions an event code in chat, delete and DM them
  const found = activeEvents.find(evt => message.content.includes(evt.code));
  if (found) {
    await message.delete().catch(() => {});
    const embed = createInfoEmbed(
      'Event Code Detected',
      `Please do not type the event code in channels. Use \`/join ${found.code}\` to join the event.`
    );

    // Enqueue a DM to the user
    enqueueAction(() => message.author.send({ embeds: [embed] })
      .catch(err => console.error(`Could not DM ${message.author.tag}:`, err))
    );
    return;
  }

  // 2) Intercept manual "/join CODE" attempts
  if (message.content.startsWith('/join ')) {
    const [, code] = message.content.split(/\s+/);
    const evt = activeEvents.find(e => e.code === code);
    if (evt) {
      await message.delete().catch(() => {});
      const embed = createInfoEmbed(
        'Join Event',
        `Please use the slash command instead: \`/join ${evt.code}\`.`
      );

      // Enqueue a DM to the user
      enqueueAction(() => message.author.send({ embeds: [embed] })
        .catch(err => console.error(`Could not DM ${message.author.tag}:`, err))
      );
    }
  }
}

/**
 * Sends a DM to the user notifying about DKP gain or loss.
 * This now uses the queue so we don’t hit rate limits.
 *
 * @param {User} user            - Discord.js User object
 * @param {number} pointChange   - Positive or negative change
 * @param {number} totalPoints   - User’s new total DKP
 * @param {string} description   - Optional description of why
 */
async function sendUserNotification(user, pointChange, totalPoints, description) {
  const action = pointChange > 0 ? 'gained' : 'lost';
  const embed = createInfoEmbed(
    `DKP ${action.charAt(0).toUpperCase() + action.slice(1)}`,
    `You have ${action} **${Math.abs(pointChange)}** DKP. You now have **${totalPoints}** DKP.` +
      (description ? `\n\nReason: **${description}**` : '')
  );

  // Enqueue the DM so we don’t flood the gateway
  enqueueAction(() =>
    user.send({ embeds: [embed] })
      .catch(err => console.error(`Failed to DM ${user.id}:`, err))
  );
}

module.exports = { handleMessageCreate, sendUserNotification };
