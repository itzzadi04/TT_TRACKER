const mongoose = require('mongoose');

const TimetableSlotSchema = new mongoose.Schema({

    faculty: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Faculty',
        required: true
    },

    classSection: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClassSection',
        required: true
    },

    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },

    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },

    time: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Time',
        required: true
    },

    // Identifies the complete class/session.
    // For a 2-hour lab, both 1-hour blocks
    // will have the same sessionId.
    sessionId: {
        type: String,
        required: true,
        index: true
    },

    // True when this timetable session is a lab.
    isLab: {
        type: Boolean,
        default: false
    },

    // Duration of the original logical session in hours.
    // Example:
    // Normal class: 1
    // Two-hour lab: 2
    duration: {
        type: Number,
        required: true,
        min: 1
    },

    group: {
        type: String,
        default: null,
        trim: true
    },

    isFixed: {
        type: Boolean,
        default: false
    },

    isOccupied: {
        type: Boolean,
        default: true
    },

    // Week type: 'base' = recurring base timetable,
    // 'current' or 'next' = week-specific override
    week: {
        type: String,
        enum: ['base', 'current', 'next'],
        default: 'base'
    },

    // Soft-delete: marks a slot as cancelled for a specific week
    isCancelled: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });

// Compound index for efficient lookups and preventing exact duplicates
TimetableSlotSchema.index(
    { faculty: 1, classSection: 1, subject: 1, time: 1, group: 1, week: 1 },
    { unique: true }
);

module.exports = mongoose.model('TimetableSlot', TimetableSlotSchema);
