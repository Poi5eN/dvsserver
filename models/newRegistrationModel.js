const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const newRegistrationSchema = new mongoose.Schema({
  registrationId: {
    type: String,
    required: true,
    unique: true,
    default: uuidv4, // Automatically generates a UUID
  },
  schoolId: {
    type: String,
    required: true,
  },
  session: {
    type: String,
    required: true,
  },
  studentFullName: {
    type: String,
    required: true,
    trim: true,
  },
  guardianName: {
    type: String,
    trim: true,
  },
  registerClass: {
    type: String,
    trim: true,
  },
  studentAddress: {
    type: String,
    trim: true,
  },
  mobileNumber: {
    type: Number,
    trim: true,
  },
  studentEmail: {
    type: String,
    trim: true, // Removed global unique constraint; handled per school/session in code
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
  },
  amount: {
    type: Number,
  },
  registrationNumber: {
    type: String,
    required: true, // Removed global unique constraint; handled per school in code
  },
  rollNo: {
    type: String,
    trim: true,
  },
  admissionNo: {
    type: String,
    trim: true,
  },
  fatherName: {
    type: String,
    trim: true,
  },
  parentEmail: {
    type: String,
    trim: true,
  },
  motherName: {
    type: String,
    trim: true,
  },
  remarks: {
    type: String,
    trim: true,
  },
  transport: {
    type: String,
    trim: true,
  },
  studentPhoto: {
    public_id: { type: String, default: '' },
    url: { type: String, default: '' },
  },
  fatherPhoto: {
    public_id: { type: String, default: '' },
    url: { type: String, default: '' },
  },
  motherPhoto: {
    public_id: { type: String, default: '' },
    url: { type: String, default: '' },
  },
  guardianPhoto: {
    public_id: { type: String, default: '' },
    url: { type: String, default: '' },
  },
  approvalStatus: {
    type: String,
    default: 'pending',
    enum: ['pending', 'approved', 'rejected'],
  },
  createdBy: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const NewRegistrationModel = mongoose.model('NewRegistration', newRegistrationSchema);
module.exports = NewRegistrationModel;