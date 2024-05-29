const mongoose = require('mongoose');
const db = mongoose.connection;

db.on('connected', () => {
    console.log('Mongoose connection is open.');
});

db.on('error', (err) => {
    console.error(`Mongoose connection error: ${err}`);
});

db.on('disconnected', () => {
    console.log('Mongoose connection is disconnected.');
});

function connectDB() {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
        console.log('MongoDB connected!')
        })
        .catch(err => {
            console.error('Failed to connect to MongoDB:', err);
            process.exit(1);
        });
}

module.exports = { connectDB };