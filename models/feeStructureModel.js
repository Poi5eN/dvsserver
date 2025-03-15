const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const feeStructureSchema = new mongoose.Schema({
  feeStructureId: {
    type: String,
    required: true,
    unique: true,
    default: uuidv4,
  },
  schoolId: {
    type: String,
    required: true
  },
  className: {
    type: String
  },
  name: {
    type: String
  },
  feeType: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true
  },
  additional: {
    type: Boolean,
    required: true,
    default: false
  },
  admissionNumber: { // For student-specific fees
    type: String,
    required: false,
  },
  session: { 
    type: String, 
    required: true 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);

module.exports = FeeStructure;
