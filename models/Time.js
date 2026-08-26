const mongoose = require('mongoose');

const TimeSchema = new mongoose.Schema({

    day: {
        type: String,
        required: true,
        trim: true
    },

    starting: {
        type: String,
        required: true,
        trim: true
    },

    ending: {
        type: String,
        required: true,
        trim: true
    }

}, { timestamps: true });

// Unique compound index: one Time document per day+start+end combination
TimeSchema.index({ day: 1, starting: 1, ending: 1 }, { unique: true });

module.exports = mongoose.model('Time', TimeSchema);
