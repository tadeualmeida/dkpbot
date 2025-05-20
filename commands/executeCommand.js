// commands/executeCommands.js

const { handleDkpCommands }        = require('./dkpCommands');
const { handleCurrencyCommands }   = require('./currencyCommands');
const { handleEventCommands }      = require('./eventCommands');
const { handleResetCommand }       = require('./resetCommands');
const { handleHelpCommand, handleShowHelpCommand } = require('./helpCommands');
const { handleConfigCommands }     = require('./configCommands');
const { handleReportCommand }      = require('./reportCommands');
const { handleReminderCommand }      = require('./reminderCommands');
const { checkRolePermission }      = require('../utils/permissions');

/**
 * A wrapper to centralize error handling for all command handlers.
 */
async function safeInvoke(handler, interaction, name) {
  try {
    await handler(interaction);
  } catch (error) {
    console.error(`Error handling ${name} command:`, error);
    // only reply if not already replied or deferred
    if (!interaction.deferred && !interaction.replied) {
      await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
    }
  }
}

const commandHandlers = {
  // ─── Configuration ────────────────────────────────────────────────────────────
  config:     async (i) => await safeInvoke(handleConfigCommands,  i, 'config'),

  // ─── DKP Management ───────────────────────────────────────────────────────────
  dkp:        async (i) => await safeInvoke(handleDkpCommands,     i, 'dkp'),
  rank:       async (i) => await safeInvoke(handleDkpCommands,     i, 'rank'),
  dkpadd:     async (i) => await safeInvoke(handleDkpCommands,     i, 'dkpadd'),
  dkpremove:  async (i) => await safeInvoke(handleDkpCommands,     i, 'dkpremove'),

  // ─── Currency / Bank ─────────────────────────────────────────────────────────
  currency:   async (i) => await safeInvoke(handleCurrencyCommands, i, 'currency'),
  bank:       async (i) => await safeInvoke(handleCurrencyCommands, i, 'bank'),

  // ─── Events ───────────────────────────────────────────────────────────────────
  event:      async (i) => await safeInvoke(handleEventCommands,    i, 'event'),
  join:       async (i) => await safeInvoke(handleEventCommands,    i, 'join'),

  // ─── Reports & Resets ─────────────────────────────────────────────────────────
  rankreport: async (i) => await safeInvoke(handleReportCommand,    i, 'rankreport'),
  reset:      async (i) => await safeInvoke(handleResetCommand,     i, 'reset'),

  // ─── Help ─────────────────────────────────────────────────────────────────────
  help:       async (i) => await safeInvoke(handleHelpCommand,      i, 'help'),
  showhelp:   async (i) => await safeInvoke(handleShowHelpCommand,  i, 'showhelp'),

  // ─── Reminder ─────────────────────────────────────────────────────────────────
  reminder:       async (i) => await safeInvoke(handleReminderCommand,      i, 'reminder'),
};

async function executeCommand(interaction) {
  // Permission guard
  if (!await checkRolePermission(interaction, interaction.commandName)) {
    return;
  }

  const handler = commandHandlers[interaction.commandName];
  if (!handler) {
    return interaction.reply({ content: "This command is not recognized.", ephemeral: true });
  }

  // Dispatch
  await handler(interaction);
}

module.exports = { executeCommand };
