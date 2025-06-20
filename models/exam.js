const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const AssessmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  totalMarks: { type: Number, required: true },
  passingMarks: { type: Number, default: 0 },
  examDate: { type: Date, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true }
});

const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  assessments: { type: [AssessmentSchema], default: [] }
});

const ExamSchema = new mongoose.Schema({
  examId:     { type: String, default: uuidv4, required: true, unique: true },
  schoolId:   { type: String, required: true },
  session:    { type: String, required: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  name:               { type: String, required: true },
  examType:           { type: String, required: true },
  term:               { type: String, required: true },

  classNames: { type: [String], required: true },
  sections:   { type: [String], required: true },
  subjects:   { type: [SubjectSchema], required: true },

  startDate:          { type: Date, required: true },
  endDate:            { type: Date, required: true },
  resultPublishDate:  { type: Date, required: true },
  gradeSystem:        { type: String, default: 'Standard' },

  createdAt:          { type: Date, default: Date.now },
  updatedAt:          { type: Date }
});

module.exports = mongoose.model('Exam', ExamSchema);