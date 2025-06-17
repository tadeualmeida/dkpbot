// schema/Item.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ItemSchema = new Schema({
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
  // referência à categoria deste item
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  // Nome do arquivo da imagem (ex: "sword.png"), deverá estar em /img/items/
  image: {
    type: String,
    default: null,
    trim: true
  }
}, { timestamps: true });

// Garante nomes únicos de item dentro de um mesmo guild+game
ItemSchema.index(
  { guildId: 1, gameKey: 1, name: 1 },
  { unique: true }
);

module.exports = mongoose.model('Item', ItemSchema);
