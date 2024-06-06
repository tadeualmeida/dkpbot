const { handleDkpCommands } = require('./dkpCommands');
const { handleCrowCommands } = require('./crowCommands');
const { handleEventCommands } = require('./eventCommands');
const { handleResetCommand } = require('./resetCommands');
const { checkRolePermission } = require('../utils/permissions');
const { handleHelpCommand, handleShowHelpCommand } = require('./helpCommands');
const { handleConfigCommands } = require('./configCommands');
const { handleReportCommand } = require('./reportCommands');

const commandHandlers = {
    config: async (interaction) => {
        const subcommand = interaction.options.getSubcommand();
        const subcommandHandlers = {
            dkp: handleConfigCommands,
            channel: handleConfigCommands,
            show: handleConfigCommands,
            role: handleConfigCommands
        };

        const handler = subcommandHandlers[subcommand];
        if (handler) {
            await handler(interaction);
        } else {
            await interaction.reply({ content: "This subcommand is not recognized.", ephemeral: true });
        }
    },
    dkp: handleDkpCommands,
    dkpadd: handleDkpCommands,
    dkpremove: handleDkpCommands,
    rank: handleDkpCommands,
    addcrow: handleCrowCommands,
    removecrow: handleCrowCommands,
    bank: handleCrowCommands,
    event: handleEventCommands,
    join: handleEventCommands,
    reset: handleResetCommand,
    help: handleHelpCommand,
    showhelp: handleShowHelpCommand,
    rankreport: handleReportCommand
};

async function executeCommand(interaction) {
    if (!await checkRolePermission(interaction, interaction.commandName)) {
        return;
    }

    const handler = commandHandlers[interaction.commandName];

    if (handler) {
        await handler(interaction);
    } else {
        await interaction.reply({ content: "This command is not recognized.", ephemeral: true });
    }
}

module.exports = { executeCommand };
