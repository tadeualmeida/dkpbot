const Event = require('../schema/Event');
const GuildBank = require('../schema/GuildBank');
const { Dkp, DkpTotal } = require('../schema/Dkp');
const DkParameter = require('../schema/DkParameter');
const { refreshDkpParametersCache, clearCache } = require('../utils/cacheManagement');
const { createInfoEmbed } = require('../utils/embeds');

async function handleResetCommand(interaction) {
    const guildId = interaction.guildId;

    // Verificar e resetar pontos DKP
    const dkpExists = await Dkp.exists({ guildId });
    if (dkpExists) {
        await Dkp.deleteMany({ guildId });
    }

    // Verificar e resetar eventos
    const eventExists = await Event.exists({ guildId });
    if (eventExists) {
        await Event.deleteMany({ guildId });
    }

    // Verificar e resetar crows no banco
    const bankExists = await GuildBank.exists({ guildId });
    if (bankExists) {
        await GuildBank.updateOne({ guildId }, { crows: 0 }, { upsert: true });
    }

    const DkpTotalExist = await DkpTotal.exists({ guildId });
    if (DkpTotalExist) {
        await DkpTotal.updateOne({ guildId }, { totalDkp: 0 }, { upsert: true });
    }

    // Verificar e resetar parâmetros DKP
    //const dkpParameterExists = await DkParameter.exists({ guildId });
    //if (dkpParameterExists) {
     //   await DkpParameter.deleteMany({ guildId });
    //}

    clearCache(guildId);
    refreshDkpParametersCache(guildId);

    await interaction.reply({ embeds: [createInfoEmbed('Reset Complete', 'All DKP points, events, and crows have been reset for this guild.')], ephemeral: true });
}

module.exports = { handleResetCommand };
