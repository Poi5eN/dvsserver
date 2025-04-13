// models/feeStructure.js
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
  frequency: {
    type: String,
    enum: ["monthly", "one-time", "annual"],
    default: "monthly"
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
  studentId: {
    type: String,
    required: false,
  },
  lateFineDueDay: { // New field for late fine due date (e.g., 10 for 10th of the month)
    type: Number,
    min: 1,
    max: 31,
    required: false,
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