// schema/GuildConfig.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Schema para cada jogo
const GameConfigSchema = new Schema({
  key: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  // roles por grupo de comando (admin, mod, user)
  roles: {
    admin: [{ type: String, default: [] }],
    mod:   [{ type: String, default: [] }],
    user:  [{ type: String, default: [] }]
  },
  // canais específicos onde o bot envia mensagens de log e lembrete
  channels: {
    log:      { type: String, default: null },
    auction:  { type: String, default: null },
    reminder: { type: String, default: null }
  },
  // parâmetros de DKP
  dkpParameters: [{
    name:   { type: String, required: true, lowercase: true, trim: true },
    points: { type: Number, required: true, min: 0 }
  }],
  minimumPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  eventTimer: {
    type: Number,
    default: 10,
    min: 1
  },
  currency: {
    name:  { type: String, required: true, trim: true },
    total: { type: Number, default: 0, min: 0 }
  },
  // duração padrão (em minutos) para que uma nova auction fique aberta
  defaultAuctionDuration: {
    type: Number,
    default: 16 * 60,     // 16 horas = 960 minutos
    min: 1
  },
  totalDkp: {
    type: Number,
    default: 0,
    min: 0
  },
  // ← aqui começa a nova seção de reminders
  reminders: [{ type: String, trim: true }],

  // intervals de lembrete (globais para o jogo)
  reminderIntervals: [{ type: String, trim: true }],

}, { _id: false });

// Schema principal da guild
const GuildConfigSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  guildName: {
    type: String,
    trim: true
  },
  games: {
    type: [GameConfigSchema],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('GuildConfig', GuildConfigSchema);
