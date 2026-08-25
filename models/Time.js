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

module.exports = mongoose.model('Time', TimeSchema);
