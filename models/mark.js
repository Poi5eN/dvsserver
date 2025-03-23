const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const GradingScheme = require('./gradingScheme');

const MarkSchema = new mongoose.Schema({
  marksId: { type: String, default: uuidv4, required: true, unique: true },
  schoolId: { type: String, required: true },
  examId: { type: String, required: true },
  studentId: { type: String, required: true },
  className: { type: String, required: true },
  section: { type: String, required: true },
  marks: [{
    subjectName: { type: String, required: true },
    assessments: [{
      assessmentName: { type: String, required: true },
      marksObtained: { type: Number, required: true },
      totalMarks: { type: Number, required: true },
      startTime: { type: Date }, // New field
      endTime: { type: Date }   // New field
    }],
    total: { type: Number },
    grade: { type: String }
  }],
  coScholasticMarks: [{
    areaName: { type: String, required: true },
    grade: { type: String, required: true }
  }],
  remarks: { type: String, default: '' },
  session: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

MarkSchema.pre('save', async function(next) {
  const exam = await mongoose.model('Exam').findOne({ examId: this.examId });
  const gradingScheme = await GradingScheme.findOne({ schoolId: this.schoolId });

  this.marks.forEach(subject => {
    const examSubject = exam.subjects.find(s => s.name === subject.subjectName);
    subject.total = subject.assessments.reduce((sum, a) => sum + a.marksObtained, 0);
    const totalPossible = examSubject.totalMarks;
    const percentage = totalPossible ? (subject.total / totalPossible) * 100 : 0;
    subject.grade = gradingScheme ? getGrade(percentage, gradingScheme) : defaultGrade(percentage);
  });

  this.updatedAt = new Date();
  next();
});

function getGrade(percentage, gradingScheme) {
  for (const range of gradingScheme.grades) {
    if (percentage >= range.minPercentage && percentage <= range.maxPercentage) {
      return range.grade;
    }
  }
  return 'N/A';
}

function defaultGrade(percentage) {
  if (percentage >= 91) return 'A1';
  if (percentage >= 81) return 'A2';
  if (percentage >= 71) return 'B1';
  if (percentage >= 61) return 'B2';
  if (percentage >= 51) return 'C1';
  if (percentage >= 41) return 'C2';
  if (percentage >= 33) return 'D';
  return 'E';
}

const Mark = mongoose.model('Mark', MarkSchema);
module.exports = Mark;