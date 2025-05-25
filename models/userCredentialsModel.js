const mongoose = require('mongoose');

const userCredentialsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true, // Links to AdminInfo schoolId or ThirdPartyUser userId
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
  userType: {
    type: String,
    required: true,
    enum: ['admin', 'thirdparty', 'teacher'], // To differentiate user types
  },
  schoolName: {
    type: String, // Optional for third-party users
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

const UserCredentials = mongoose.model('UserCredentials', userCredentialsSchema);
module.exports = UserCredentials;