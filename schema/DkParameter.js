const mongoose = require('mongoose');

const dkpParameterSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    points: { type: Number, required: true, min: 0 }
}, { timestamps: true });

// Assegura que o nome do parâmetro é único por guilda
dkpParameterSchema.index({ guildId: 1, name: 1 });

dkpParameterSchema.pre('save', function(next) {
    this.name = this.name.toLowerCase();
    next();
});

const DkpParameter = mongoose.model('DkpParameter', dkpParameterSchema);

module.exports = DkpParameter;
