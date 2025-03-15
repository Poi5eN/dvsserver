// models/passwordVaultModel.js
const mongoose = require('mongoose');

const passwordVaultSchema = new mongoose.Schema({
  superAdminId: {
    type: String,
    required: true,
    ref: 'SuperAdmin',
  },
  userType: {
    type: String,
    enum: ['SuperAdmin', 'Admin', 'ThirdPartyUser', 'Receptionist'],
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  encryptedPassword: {
    type: String,
    required: true,
  },
  session: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('PasswordVault', passwordVaultSchema);