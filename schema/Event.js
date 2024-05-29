const mongoose = require('mongoose');
const { Schema } = mongoose;

const eventSchema = new Schema({
    guildId: { type: String, required: true, index: true }, // Adicionado guildId
    parameterName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    code: { type: String, required: true, unique: true }, // Garante que cada evento tenha um código único
    participants: [{  // Armazena IDs de usuário como strings
        userId: { type: String }, // Alterado para String
        username: { type: String },
        discordUsername: { type: String },
        joinedAt: { type: Date, default: Date.now }
    }],
}, {
    timestamps: true  // Adiciona createdAt e updatedAt automaticamente
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
