// utils/embeds.js

const { EmbedBuilder } = require('discord.js');

const COLORS = {
  info:    0x0099FF,
  success: 0x00FF00,
  error:   0xFF0000
};

/**
 * Generic embed factory.
 */
function createEmbed({ color, title, description }) {
  const embed = new EmbedBuilder()
    .setColor(COLORS[color] || COLORS.info)
    .setTimestamp();

  if (title)       embed.setTitle(title);
  if (description) embed.setDescription(description);

  return embed;
}

/**
 * Embed for any command that needs to list many lines (e.g. /dkp balances, /rank).
 */
function createMultipleResultsEmbed(color, title, descriptions) {
  const embed = new EmbedBuilder()
    .setColor(COLORS[color] || COLORS.info)
    .setTitle(title)
    .setTimestamp();

  const maxLinesPerField = 25;
  const maxFieldLength   = 1024;
  let currentLines       = [];

  descriptions.forEach(desc => {
    const joined = currentLines.join('\n');
    if (joined.length + desc.length > maxFieldLength || currentLines.length >= maxLinesPerField) {
      embed.addFields({ name: '\u200B', value: joined, inline: true });
      currentLines = [];
    }
    currentLines.push(desc);
  });

  if (currentLines.length) {
    embed.addFields({ name: '\u200B', value: currentLines.join('\n'), inline: true });
  }

  return embed;
}

// ─────────────────────────────────────────────────────────────────────────────
// DKP embeds
// ─────────────────────────────────────────────────────────────────────────────

function createDkpBalanceEmbed(userDkp) {
  const desc = userDkp
    ? `You have **${userDkp.points}** DKP.`
    : "You don't have any DKP.";
  return createEmbed({ color: 'info', title: 'DKP Balance', description: desc });
}

function createDkpTransactionEmbed(user, points, transactionType) {
  const name      = user.displayName || user.username;
  const operation = transactionType === 'add' ? 'added to' : 'removed from';
  const desc      = `**${points}** DKP ${operation} ${name}.`;
  return createEmbed({
    color: transactionType === 'add' ? 'success' : 'error',
    title: `DKP ${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}`,
    description: desc
  });
}

function createDkpParameterDefinedEmbed(paramName, points, action) {
  let desc;
  if (action === 'added')   desc = `DKP parameter **${paramName}** with **${points}** points added.`;
  if (action === 'removed') desc = `DKP parameter **${paramName}** removed.`;
  if (action === 'edited')  desc = `DKP parameter **${paramName}** updated to **${points}** points.`;

  return createEmbed({
    color: action === 'removed' ? 'error' : 'success',
    title: 'DKP Parameter Update',
    description: desc
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Currency embeds (formerly “crow”)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called after /currency add|remove or /crow add|remove.
 *
 * @param amount         Positive = added, negative = removed
 * @param totalInBank    New total in bank
 * @param gameName       Friendly game name (e.g. "Odin")
 * @param currencyName   Currency label (e.g. "Crows")
 */
function createCurrencyUpdateEmbed(amount, totalInBank, gameName, currencyName) {
  const op    = amount > 0 ? 'added to' : 'removed from';
  const clr   = amount > 0 ? 'success' : 'error';
  const desc  = `**${Math.abs(amount)}** ${currencyName} ${op} **${gameName}** bank.\n`
              + `New total: **${totalInBank}** ${currencyName}.`;
  return createEmbed({ color: clr, title: `${currencyName} Update`, description: desc });
}

/**
 * Called by /bank or /currency bank for multi-game or single-game view
 *
 * @param amountsByGame  Array of lines like "Odin: 100 Crows"
 */
function createCurrencyBalanceEmbed(lines) {
  const desc = lines.join('\n');
  return createEmbed({ color: 'info', title: 'Guild Bank Balances', description: desc });
}

// ─────────────────────────────────────────────────────────────────────────────
// Event embeds
// ─────────────────────────────────────────────────────────────────────────────

function createEventStartedEmbed(parameterName, eventCode) {
  const desc = `Event started with **${parameterName}**\nCode: **${eventCode}**`;
  return createEmbed({ color: 'info', title: 'Event Started', description: desc });
}

function createCombinedEventEmbed(parameterName, eventCode, dkpParam, userDkp, guildConfig) {
  const ptsText = dkpParam.points > 1 ? 'points' : 'point';
  let desc = `Event **${parameterName}** started (code **${eventCode}**).\n`
           + `You earned **${dkpParam.points}** ${ptsText}. Your total will be **${userDkp.points}** after end.`;

  if (guildConfig?.guildName) {
    desc = `**${guildConfig.guildName.toUpperCase()}** event **${parameterName}**\n`
         + `Code: **${eventCode}**\n`
         + `You earned **${dkpParam.points}** ${ptsText}. Total: **${userDkp.points}**.`;
  }

  return createEmbed({ color: 'info', title: 'Event Started & Joined', description: desc });
}

function createEventEndedEmbed() {
  return createEmbed({ color: 'info', title: 'Event Ended', description: 'The event has ended.' });
}

function createJoinEventEmbed(dkpParam, userDkp, eventCode) {
  const ptsText = dkpParam.points > 1 ? 'points' : 'point';
  const desc    = `You joined event **${eventCode}** and earned **${dkpParam.points}** ${ptsText}.\n`
                + `Your total will be **${userDkp.points}** after the event end.`;
  return createEmbed({ color: 'info', title: 'Joined Event', description: desc });
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic info / error
// ─────────────────────────────────────────────────────────────────────────────

function createErrorEmbed(title = 'Error', description = '') {
  return createEmbed({ color: 'error', title, description });
}

function createInfoEmbed(title = 'Info', description = '') {
  return createEmbed({ color: 'info', title, description });
}

module.exports = {
  createMultipleResultsEmbed,

  // DKP
  createDkpBalanceEmbed,
  createDkpTransactionEmbed,
  createDkpParameterDefinedEmbed,

  // Currency (formerly “crow”)
  createCurrencyUpdateEmbed,
  createCurrencyBalanceEmbed,

  // Events
  createEventStartedEmbed,
  createCombinedEventEmbed,
  createEventEndedEmbed,
  createJoinEventEmbed,

  // Generic
  createErrorEmbed,
  createInfoEmbed
};
