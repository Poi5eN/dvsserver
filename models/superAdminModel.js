// // models/superAdminModel.js
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');

// const superAdminSchema = new mongoose.Schema({
//   username: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   password: {
//     type: String,
//     required: true,
//   },
//   role: {
//     type: String,
//     default: 'superadmin',
//   },
// });

// // Hash the password before saving
// superAdminSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) return next();
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

// // Method to compare entered password with stored hash
// superAdminSchema.methods.matchPassword = async function (enteredPassword) {
//   return await bcrypt.compare(enteredPassword, this.password);
// };

// const SuperAdmin = mongoose.model('SuperAdmin', superAdminSchema);
// module.exports = SuperAdmin;



// models/superAdminModel.js
const mongoose = require('mongoose');

const superAdminSchema = new mongoose.Schema({
  superAdminId: {
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
    default: "superadmin",
},
// session: { type: String, required: true },
  createdBy: {
    type: String, // References rootAdminId
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const SuperAdmin = mongoose.model('SuperAdmin', superAdminSchema);
module.exports = SuperAdmin;