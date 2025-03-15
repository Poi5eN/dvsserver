// const mongoose = require("mongoose");

// const examDetailsSchema = new mongoose.Schema({
//   subjectName: {
//     type: String,
//     required: true
//   },
//   examDate: {
//     type: Date,
//     required: true
//   },
//   startTime: {
//     type: String,
//     required: true
//   },
//   endTime: {
//     type: String, 
//     required: true
//   },
//   subjectTotalMarks: {
//     type: Number,
//     required: true
//   },
//   passingMarks: {
//     type: Number,
//     required: true
//   },
//   examType: {
//     type: String,
//     enum: ['UNIT_TEST', 'MIDTERM', 'FINAL', 'PRACTICAL', 'ASSIGNMENT'],
//     required: true
//   },
//   weightage: {
//     type: Number,
//     required: true
//   },
//   instructions: {
//     type: String
//   },
//   syllabus: [{
//     topic: String,
//     subtopics: [String]
//   }]
// });

// const examSchema = new mongoose.Schema({
//   schoolId: {
//     type: String,
//     required: true
//   },
//   examName: {
//     type: String,
//     required: true
//   },
//   className: {
//     type: String, 
//     required: true
//   },
//   section: {
//     type: String,
//     required: true
//   },
//   academicYear: {
//     type: String,
//     required: true
//   },
//   term: {
//     type: String,
//     required: true
//   },
//   examInfo: [examDetailsSchema],
//   createdBy: {
//     type: String,
//     required: true
//   },
// session: { type: String, required: true },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// module.exports = mongoose.model("Exam", examSchema);