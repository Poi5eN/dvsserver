const mongoose = require("mongoose");

const marksSchema = new mongoose.Schema({
  subjectName: {
    type: String,
    required: true
  },
  marksObtained: {
    type: Number,
    required: true
  },
  totalMarks: {
    type: Number,
    required: true
  },
  grade: String,
  remarks: String
});

const examResultSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  studentId: {
    type: String,
    required: true
  },
  rollNumber: {
    type: String,
    required: true
  },
  className: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  marks: [marksSchema],
  totalMarks: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    required: true
  },
  grade: String,
  rank: Number,
  attendance: {
    type: Number,
    default: 100
  },
  status: {
    type: String,
    enum: ['PASS', 'FAIL', 'ABSENT'],
    required: true
  },
  remarks: String,
  session: { type: String, required: true },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("ExamResult", examResultSchema);