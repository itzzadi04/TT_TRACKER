const mongoose = require('mongoose');

const ScheduleOverrideSchema = new mongoose.Schema({
    // Calendar week identifier, e.g. "2026-W35" or "2026-08-24" (Monday of that week)
    weekKey: {
        type: String,
        required: true,
        index: true
    },

    // Reference to original base TimetableSlot (null if this is an added extra class)
    originalSlot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TimetableSlot',
        default: null
    },

    // Action type:
    // 'CANCEL' -> class cancelled for this week only
    // 'RESCHEDULE' -> class moved to a new time/room for this week only
    // 'ADD_EXTRA' -> extra class added for this week only
    action: {
        type: String,
        enum: ['CANCEL', 'RESCHEDULE', 'ADD_EXTRA'],
        required: true
    },

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

    sessionId: {
        type: String,
        default: function() {
            return `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        }
    },

    isLab: {
        type: Boolean,
        default: false
    },

    duration: {
        type: Number,
        required: true,
        default: 1
    },

    group: {
        type: String,
        default: null,
        trim: true
    },

    scope: {
        type: String,
        enum: ['CURRENT_WEEK', 'NEXT_WEEK', 'PERMANENT', 'CURRENT_WEEK_ONLY', 'WEEK'],
        default: 'CURRENT_WEEK'
    },

    status: {
        type: String,
        enum: ['ACTIVE', 'DISCARDED'],
        default: 'ACTIVE'
    }
}, { timestamps: true });

// Compound index for fast queries by week and original slot
ScheduleOverrideSchema.index({ weekKey: 1, originalSlot: 1, status: 1 });
ScheduleOverrideSchema.index({ weekKey: 1, sessionId: 1, status: 1 });

module.exports = mongoose.model('ScheduleOverride', ScheduleOverrideSchema);
