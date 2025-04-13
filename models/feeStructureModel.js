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
    enum: ['monthly', 'one-time', 'annual'],
    default: 'monthly',
    // required: true, // Ensure frequency is always specified
  },
  amount: {
    type: Number,
    required: true,
  },
  additional: {
    type: Boolean,
    default: false,
  },
  studentId: {
    type: String,
  },
  lateFineConfig: { // New field for late fine configuration
    isActive: { type: Boolean, default: false },
    amount: { type: Number, min: 0 },
    applyAfterDays: { type: Number, min: 1, default: 1 }, // Apply after 1 day by default
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