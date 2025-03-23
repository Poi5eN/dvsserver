const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ExamSchema = new mongoose.Schema({
  examId: { type: String, default: uuidv4, required: true, unique: true },
  schoolId: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  examType: { type: String, required: true },
  classNames: [{ type: String, required: true }],
  sections: [{ type: String, required: true }],
  term: { type: String, required: true },
  subjects: [{
    name: { type: String, required: true },
    assessments: [{
      name: { type: String, required: true },
      totalMarks: { type: Number, required: true },
      passingMarks: { type: Number, default: 0 },
      startTime: { type: Date }, // New field
      endTime: { type: Date }   // New field
    }],
    totalMarks: { type: Number, required: true }
  }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  resultPublishDate: { type: Date, required: true },
  gradeSystem: { type: String, default: "Standard" },
  session: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

const Exam = mongoose.model('Exam', ExamSchema);
module.exports = Exam;