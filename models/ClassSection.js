const mongoose = require('mongoose');

const ClassSectionSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  section: { type: String, required: true },
  semester: { type: Number, required: true },
  // Human-readable identifier e.g. "Y3_S5_CS"
  sectionId: { type: String, required: true, unique: true }
}, { timestamps: true });

// Ensures unique combination of year, section, and semester
ClassSectionSchema.index({ year: 1, section: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('ClassSection', ClassSectionSchema);
