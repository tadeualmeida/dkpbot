const Event = require('../schema/Event');
const GuildBank = require('../schema/GuildBank');
const { Dkp, DkpTotal } = require('../schema/Dkp');
const { refreshDkpParametersCache, clearCache, refreshDkpPointsCache, refreshDkpMinimumCache, refreshCrowCache, refreshEventTimerCache, refreshEligibleUsersCache } = require('../utils/cacheManagement');
const { createInfoEmbed } = require('../utils/embeds');

async function handleResetCommand(interaction) {
    const guildId = interaction.guildId;

    // Funções de reset para diferentes coleções
    const resetOperations = [
        Dkp.deleteMany({ guildId }).exec(),
        Event.deleteMany({ guildId }).exec(),
        GuildBank.updateOne({ guildId }, { crows: 0 }, { upsert: true }).exec(),
        DkpTotal.updateOne({ guildId }, { totalDkp: 0 }, { upsert: true }).exec()
    ];

    // Executa todas as operações de reset em paralelo
    await Promise.all(resetOperations);

    // Limpa e atualiza o cache
    clearCache(guildId);
    await refreshDkpParametersCache(guildId), 
    await refreshDkpPointsCache(guildId), 
    await refreshDkpMinimumCache(guildId), 
    await refreshCrowCache(guildId), 
    await refreshEventTimerCache(guildId), 
    await refreshEligibleUsersCache(guildId)

    // Responde ao usuário
    await interaction.reply({ embeds: [createInfoEmbed('Reset Complete', 'All DKP points, events, and crows have been reset for this guild.')], ephemeral: true });
}

module.exports = { handleResetCommand };
