const { createInfoEmbed } = require('../utils/embeds');

async function handleHelpCommand(interaction) {
    const description = `
**/help** - Lists all available commands and what each one does.
**/dkp** - List your own DKP.
**/dkp add <users> <points>** - Adds DKP points to one or more users.
**/dkp remove <users> <points>** - Removes DKP points from one or more users.
**/rank** - Shows the guild DKP rank.
**/config dkp <action> <name> <points>** - Manages DKP parameters.
**/config role <role> <commandGroup>** - Sets role permissions for command groups.
**/event start <parameter>** - Starts an event with the specified parameter.
**/event end <code>** - Ends the event with the specified code.
**/join <code>** - Joins the event with the specified code.
**/bank** - Shows the amount of crows in the guild bank.
**/reset** - Resets all DKP points, events, and crows for the guild.
`;
    await interaction.reply({ embeds: [createInfoEmbed('Available Commands', description)] });
}

module.exports = { handleHelpCommand };
