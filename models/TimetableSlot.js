const mongoose = require('mongoose');

const TimetableSlotSchema = new mongoose.Schema({
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  classSection: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassSection', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  time: { type: mongoose.Schema.Types.ObjectId, ref: 'Time', required: true },
  isFixed: { type: Boolean, default: false },
  isOccupied: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('TimetableSlot', TimetableSlotSchema);

