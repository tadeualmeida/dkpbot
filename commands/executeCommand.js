const { handleDkpCommands } = require('./dkpCommands');
const { handleCrowCommands } = require('./crowCommands');
const { handleSetRoleCommand } = require('./roleCommands');
const { handleEventCommands } = require('./eventCommands');
const { handleResetCommand } = require('./resetCommands');
const { checkRolePermission } = require('../utils/permissions');
const { handleHelpCommand, handleShowHelpCommand } = require('./helpCommands');
const { handleConfigCommands } = require('./configCommands');

async function executeCommand(interaction) {
    if (!await checkRolePermission(interaction, interaction.commandName)) {
        return;
    }
    if (interaction.commandName === 'config') {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'dkp':
            case 'channel':
                await handleConfigCommands(interaction);
                break;
            case 'role':
                await handleSetRoleCommand(interaction);
                break;
            default:
                await interaction.reply({ content: "This subcommand is not recognized.", ephemeral: true });
                break;
            }
     } else {
        switch (interaction.commandName) {
            case 'dkpadd':
            case 'dkpremove':
            case 'dkp':
            case 'rank':    
                await handleDkpCommands(interaction);
                break;
            case 'addcrow':
            case 'removecrow':
            case 'bank':
                await handleCrowCommands(interaction);
                break;
            case 'event':
            case 'join':
                await handleEventCommands(interaction);
                break;
            case 'reset':
                await handleResetCommand(interaction);
                break;
            case 'help':
                await handleHelpCommand(interaction);
            case 'showhelp':
                await handleShowHelpCommand(interaction);
                break;
            default:
                await interaction.reply({ content: "This command is not recognized.", ephemeral: true });
                break;
        }
    }
}
module.exports = { executeCommand };
