const mongoose = require('mongoose');

const FacultySchema = new mongoose.Schema({
  facultyId: { type: String, required: true, unique: true },
  name: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Faculty', FacultySchema);
