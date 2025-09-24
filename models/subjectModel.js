const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const SubjectSchema = new mongoose.Schema({
  subjectId: {
    type: String,
    default: uuidv4,
    unique: true,
    required: true
  },
  schoolId: {
    type: String,
    required: true
  },
  subject: [{
    type: String,
    required: true
  }],
  className: {
    type: String,
    required: true
  },
  classTeacher: {
    type: String,
    required: false
  },
  session: {
    type: String,
    required: false
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

// Update the updatedAt field before saving
SubjectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Subject', SubjectSchema);
