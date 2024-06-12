// resetCommands.js

const Event = require('../schema/Event');
const GuildBank = require('../schema/GuildBank');
const { Dkp, DkpTotal } = require('../schema/Dkp');
const { refreshDkpParametersCache, clearCache, refreshDkpPointsCache, refreshDkpMinimumCache, refreshCrowCache, refreshEventTimerCache, refreshEligibleUsersCache, refreshDkpRankingCache } = require('../utils/cacheManagement');
const { createInfoEmbed } = require('../utils/embeds');
const { sendMessageToConfiguredChannels } = require('../utils/channelUtils');

async function handleResetCommand(interaction) {
    const guildId = interaction.guildId;
    const userName = interaction.member ? interaction.member.displayName : interaction.user.username;

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
    await refreshEligibleUsersCache(guildId),
    await refreshDkpRankingCache(guildId)

    // Envia mensagem aos canais configurados
    const resetMessage = `All DKP points, events, and crows have been reset for this guild by **${userName}**.`;
    await sendMessageToConfiguredChannels(interaction, resetMessage, 'dkp');

    // Responde ao usuário
    await interaction.reply({ embeds: [createInfoEmbed('Reset Complete', resetMessage)], ephemeral: true });
}

module.exports = { handleResetCommand };
