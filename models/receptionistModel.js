// models/receptionistModel.js
const mongoose = require('mongoose');

const receptionistSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  assignedSchools: [{
    schoolId: { type: String, required: true },
    schoolName: { type: String, required: true },
  }],
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  role: {
    type: String,
    required: true,
    default: "receptionist",
},
  image: {
    public_id: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  // session: { type: String, required: true },
  createdBy: { type: String, required: true }, // References superAdminId
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Receptionist', receptionistSchema);