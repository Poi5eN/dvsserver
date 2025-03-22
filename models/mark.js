const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const MarkSchema = new mongoose.Schema({
  marksId: {
    type: String,
    default: uuidv4,
    required: true,
    unique: true,
  },
  schoolId: { type: String, required: true },
  examId: { type: String, required: true }, // References Exam.examId
  studentId: { type: String, required: true }, // Assuming UUID for studentId
  className: { type: String, required: true },
  section: { type: String, required: true },
  marks: [{
    subjectName: { type: String, required: true },
    marks: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    passingMarks: { type: Number, required: true },
    isPassed: { type: Boolean, required: true },
  }],
  coScholasticMarks: [{
    activityName: { type: String, required: true },
    grade: { type: String, required: true },
  }],
  totalMarks: { type: Number },
  percentage: { type: Number },
  grade: { type: String },
  isPassed: { type: Boolean },
  session: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

MarkSchema.pre('save', function (next) {
  let total = 0;
  let totalPossible = 0;
  let allPassed = true;

  this.marks.forEach(mark => {
    total += mark.marks;
    totalPossible += mark.totalMarks;
    if (!mark.isPassed) allPassed = false;
  });

  this.totalMarks = total;
  this.percentage = totalPossible ? ((total / totalPossible) * 100).toFixed(2) : 0;
  this.isPassed = allPassed;

  if (this.percentage >= 90) this.grade = 'A+';
  else if (this.percentage >= 80) this.grade = 'A';
  else if (this.percentage >= 70) this.grade = 'B';
  else if (this.percentage >= 60) this.grade = 'C';
  else if (this.percentage >= 50) this.grade = 'D';
  else this.grade = 'F';

  this.updatedAt = new Date();
  next();
});

const Mark = mongoose.model('Mark', MarkSchema);
module.exports = Mark;