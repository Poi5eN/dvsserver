const mongoose = require('mongoose');

const GradingSchemeSchema = new mongoose.Schema({
  schoolId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  grades: [{
    minPercentage: { type: Number, required: true },
    maxPercentage: { type: Number, required: true },
    grade: { type: String, required: true }
  }],
  coScholasticGrades: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

const GradingScheme = mongoose.model('GradingScheme', GradingSchemeSchema);
module.exports = GradingScheme;