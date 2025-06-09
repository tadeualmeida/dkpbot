// schema/Category.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CategorySchema = new Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  gameKey: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  // mínimo de DKP para participar de um leilão nesta categoria
  minimumDkp: {
    type: Number,
    required: true,
    min: 0
  },
  // mínimo de “moeda do jogo” para participar (apenas referência, não guardamos saldo real)
  minimumCurrency: {
    type: Number,
    required: true,
    min: 0
  },
  // incremento mínimo para cada novo lance nesta categoria (ex: 10, 100, etc)
  bidIncrement: {
    type: Number,
    required: true,
    min: 1
  }
}, { timestamps: true });

// Garante que não haverá duas categorias com mesmo nome no mesmo guild+game
CategorySchema.index(
  { guildId: 1, gameKey: 1, name: 1 },
  { unique: true }
);

module.exports = mongoose.model('Category', CategorySchema);
