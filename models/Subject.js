const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  subjectCode: { type: String, required: true, unique: true },
  name: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Subject', SubjectSchema);
