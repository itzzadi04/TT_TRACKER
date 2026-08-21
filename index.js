const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomNo: { type: String, required: true, unique: true },
  labOrClass: { type: String, enum: ['Lab', 'Class'], required: true },
  building: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
