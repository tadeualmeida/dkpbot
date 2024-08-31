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
        try {
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
        } catch (error) {
            console.error('Error handling config command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    
    // Administrators
    dkpadd: async (interaction) => {
        try {
            await handleDkpCommands(interaction);
        } catch (error) {
            console.error('Error handling dkpadd command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    dkpremove: async (interaction) => {
        try {
            await handleDkpCommands(interaction);
        } catch (error) {
            console.error('Error handling dkpremove command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    reset: async (interaction) => {
        try {
            await handleResetCommand(interaction);
        } catch (error) {
            console.error('Error handling reset command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    config: async (interaction) => {
        try {
            await handleConfigCommands(interaction);
        } catch (error) {
            console.error('Error handling config command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    rankreport: async (interaction) => {
        try {
            await handleReportCommand(interaction);
        } catch (error) {
            console.error('Error handling rankreport command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    crow: async (interaction) => {
        try {
            await handleCrowCommands(interaction);
        } catch (error) {
            console.error('Error handling crow command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },

    // Moderators (can also use user commands)
    event: async (interaction) => {
        try {
            await handleEventCommands(interaction);
        } catch (error) {
            console.error('Error handling event command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    showhelp: async (interaction) => {
        try {
            await handleShowHelpCommand(interaction);
        } catch (error) {
            console.error('Error handling showhelp command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },

    // Users (can be used by Moderators and Administrators)
    dkp: async (interaction) => {
        try {
            await handleDkpCommands(interaction);
        } catch (error) {
            console.error('Error handling dkp command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    rank: async (interaction) => {
        try {
            await handleDkpCommands(interaction);
        } catch (error) {
            console.error('Error handling rank command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    bank: async (interaction) => {
        try {
            await handleCrowCommands(interaction);
        } catch (error) {
            console.error('Error handling bank command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    join: async (interaction) => {
        try {
            await handleEventCommands(interaction);
        } catch (error) {
            console.error('Error handling join command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    },
    help: async (interaction) => {
        try {
            await handleHelpCommand(interaction);
        } catch (error) {
            console.error('Error handling help command:', error);
            await interaction.reply({ content: "An error occurred while processing the command.", ephemeral: true });
        }
    }
};

async function executeCommand(interaction) {
    if (!await checkRolePermission(interaction, interaction.commandName)) {
        return;
    }

    const handler = commandHandlers[interaction.commandName];

    if (handler) {
        try {
            await handler(interaction);
        } catch (error) {
            console.error(`Error executing command ${interaction.commandName}:`, error);
            await interaction.reply({ content: "An error occurred while executing the command.", ephemeral: true });
        }
    } else {
        await interaction.reply({ content: "This command is not recognized.", ephemeral: true });
    }
}

module.exports = { executeCommand };
