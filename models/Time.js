const mongoose = require('mongoose');

const TimeSchema = new mongoose.Schema({
  day: { type: String, required: true }, // e.g., 'Monday'
  starting: { type: String, required: true }, // e.g., '09:00 AM' or '09:00'
  ending: { type: String, required: true }, // e.g., '10:00 AM' or '10:00'
  isOccupied: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Time', TimeSchema);
