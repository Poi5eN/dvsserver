const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const feeStructureSchema = new mongoose.Schema({
  feeStructureId: {
    type: String,
    default: uuidv4,
    required: true,
    unique: true,
  },
  schoolId: {
    type: String,
    required: true,
  },
  session: {
    type: String,
    required: true,
  },
  className: {
    type: String,
  },
  name: {
    type: String,
  },
  feeType: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  additional: {
    type: Boolean,
    required: true,
    default: false,
  },
  studentId: { // Changed from admissionNumber to studentId
    type: String,
    required: false, // Optional, for student-specific fees
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
  updatedBy: {
    type: String,
  },
});

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);

module.exports = FeeStructure;