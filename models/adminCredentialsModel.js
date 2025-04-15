// models/adminCredentialsModel.js
const mongoose = require('mongoose');

const adminCredentialsSchema = new mongoose.Schema({
  adminId: {
    type: String,
    required: true,
    unique: true, // Links to AdminInfo schoolId
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    select: false, // Prevent default selection
  },
  schoolName: {
    type: String,
    required: true,
  },
  createdBy: {
    type: String,
    required: true, // SuperAdminId who created this
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const AdminCredentials = mongoose.model('AdminCredentials', adminCredentialsSchema);
module.exports = AdminCredentials;