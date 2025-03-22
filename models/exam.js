const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ExamSchema = new mongoose.Schema({
  examId: { type: String, default: uuidv4, required: true, unique: true },
  schoolId: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true }, // e.g., "Term 1 Exam"
  examType: { type: String, required: true }, // e.g., "Term Exam"
  className: { type: String, required: true }, // e.g., "7"
  section: { type: String, required: true }, // e.g., "A"
  term: { type: String, required: true }, // e.g., "Term 1", "Term 2"
  subjects: [{
    name: { type: String, required: true }, // e.g., "Hindi"
    assessments: [{
      name: { type: String, required: true }, // e.g., "pt", "pf", "hye"
      totalMarks: { type: Number, required: true }, // e.g., 10, 60
      passingMarks: { type: Number, default: 0 }
    }],
    totalMarks: { type: Number, required: true } // Sum of assessment totalMarks
  }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  resultPublishDate: { type: Date, required: true },
  gradeSystem: { type: String, default: "Standard" },
  session: { type: String, required: true }, // e.g., "2023-2024"
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

const Exam = mongoose.model('Exam', ExamSchema);
module.exports = Exam;