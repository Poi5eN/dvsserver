// models/rootAdminModel.js
const mongoose = require('mongoose');

const rootAdminSchema = new mongoose.Schema({
  rootAdminId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  name: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  role: {
    type: String,
    required: true,
    default: "rootadmin",
},
// session: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('RootAdmin', rootAdminSchema);