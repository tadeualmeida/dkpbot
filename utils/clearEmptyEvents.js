const Event = require('../schema/Event');

async function clearEmptyEvents() {
    try {
        const result = await Event.deleteMany({ participants: { $size: 0 } });
        console.log(`Cleared ${result.deletedCount} empty events from the database.`);
    } catch (error) {
        console.error('Error clearing empty events:', error);
    }
}

module.exports = { clearEmptyEvents };