const { EmbedBuilder } = require('discord.js');

const COLORS = {
    info: 0x0099FF,
    success: 0x00FF00,
    error: 0xFF0000
};

function createEmbed({ color, title, description }) {
    return new EmbedBuilder()
        .setColor(COLORS[color] || COLORS.info)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

function createMultipleResultsEmbed(color, title, descriptions) {
    const embed = new EmbedBuilder()
        .setColor(COLORS[color] || COLORS.info)
        .setTitle(title)
        .setTimestamp();

    const maxLinesPerField = 25;
    const maxFieldLength = 1024;

    let currentFieldLines = [];
    let fieldCount = 0;

    descriptions.forEach((desc, index) => {
        // Se adicionar esta linha exceder o limite de caracteres ou de linhas, cria um novo campo
        if ((currentFieldLines.join('\n').length + desc.length > maxFieldLength) || currentFieldLines.length >= maxLinesPerField) {
            //embed.addFields({ name: `Details ${fieldCount + 1}`, value: currentFieldLines.join('\n'), inline: true });
            embed.addFields({ name: '\u200B', value: currentFieldLines.join('\n'), inline: true });
            currentFieldLines = [];
            fieldCount++;
        }
        currentFieldLines.push(`${desc}`);
    });

    // Adiciona o último campo se houver linhas restantes
    if (currentFieldLines.length > 0) {
        embed.addFields({ name: '\u200B', value: currentFieldLines.join('\n'), inline: true });
    }

    return embed;
}

function createDkpBalanceEmbed(userDkp) {
    const description = userDkp ? `You have **${userDkp.points}** DKP.` : "You don't have any DKP.";
    return createEmbed({ color: 'info', title: 'DKP Balance', description });
}

function createDkpTransactionEmbed(user, points, transactionType) {
    const name = user.displayName || user.username;
    const operation = transactionType === 'add' ? 'added to' : 'removed from';
    const description = `**${points}** DKP ${operation} ${name}.`;
    return createEmbed({
        color: transactionType === 'add' ? 'success' : 'error',
        title: `DKP ${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}`,
        description
    });
}

function createDkpParameterDefinedEmbed(name, points, action) {
    let description;
    if (action === 'added') {
        description = `DKP parameter **'${name}'** with ${points} points added successfully.`;
    } else if (action === 'removed') {
        description = `DKP parameter **'${name}'** removed successfully.`;
    } else {
        description = `Action not recognized.`;  // Para o caso de uma ação desconhecida
    }

    return createEmbed({ color: action === 'added' ? 'success' : 'danger', title: 'DKP Parameter Update', description });
}

function createCrowUpdateEmbed(amount, totalCrows) {
    const operation = amount > 0 ? 'added to' : 'removed from';
    const color = amount > 0 ? 'success' : 'error';
    const description = `${Math.abs(amount)} crows ${operation} the guild bank. The bank now has **${totalCrows}** crows.`;
    return createEmbed({ color, title: 'Crows Update', description });
}

function createCrowBalanceEmbed(crows, totalDkp) {
    const crowsPerDkp = totalDkp > 0 ? (crows / totalDkp).toFixed(2) : '0';
    const description = `The guild bank currently has **${crows}** crows.\n\n` +
                        `Total DKP accumulated: **${totalDkp}**\n\n` +
                        `Crows per DKP: **${crowsPerDkp}** crows`;

    return createEmbed({ color: 'info', title: 'Guild Bank Crows', description });
}

function createEventStartedEmbed(parameterName, eventCode) {
    const description = `An event has started with DKP parameter: ${parameterName}\n\n Event code: ${eventCode}`;
    return createEmbed({ color: 'info', title: 'Event Started', description});
}

function createEventEndedEmbed() {
    const description = 'The event has now ended.';
    return createEmbed({ color: 'info', title: 'Event Ended', description});
}

function createJoinEventEmbed(dkpParameter,userDkp) {
    const pointText = dkpParameter.points > 1 ? 'points' : 'point';
    const description = `You earned **${dkpParameter.points}** ${pointText}. Now you have **${userDkp.points}** total.`;
    return createEmbed({ color: 'info', title: 'Joined Event', description});
}

function createErrorEmbed(description) {
    return createEmbed({ color: 'error', title: 'Error', description});
}

function createInfoEmbed(title, description) {
    return createEmbed({ color: 'info', title, description});
}

module.exports = {
    createDkpBalanceEmbed,
    createDkpTransactionEmbed,
    createCrowUpdateEmbed,
    createCrowBalanceEmbed,
    createDkpParameterDefinedEmbed,
    createMultipleResultsEmbed,
    createEventStartedEmbed,
    createEventEndedEmbed,
    createJoinEventEmbed,
    createErrorEmbed,
    createInfoEmbed
};