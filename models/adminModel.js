// models/adminModel.js
const mongoose = require("mongoose");

const adminSchema = mongoose.Schema({
  schoolId: {
    type: String,
    required: true,
  },
  schoolName: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  email: {
    type: String,
    required: [true, "Please Enter your email Address"],
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Please Enter the password"],
    minLength: [8, "Minimum 8 character required in password"],
    select: false,
  },
  plainPassword: {
    // New field for plain-text password
    type: String,
    select: false,
  },
  fullName: {
    type: String,
    default: "",
  },
  role: {
    type: String,
    required: true,
    default: "admin",
  },
  contact: {
    type: Number,
  },
  address: {
    type: String,
    default: "",
  },
  image: {
    public_id: {
      type: String,
      default: "",
    },
    url: {
      type: String,
      default: "",
    },
  },
  feeMessage: {
    type: String,
    default: "",
  },
  schoolState: {
    type: String,
    default: "",
  },
  schoolCity: {
    type: String,
    default: "",
  },
  logoImage: {
    public_id: {
      type: String,
      default: "",
    },
    url: {
      type: String,
      default: "",
    },
  },
  admissionMessage: {
    type: String,
    default: "",
  },
  registrationMessage: {
    type: String,
    default: "",
  },
  pincode: {
    type: String,
    default: "",
  },
  createdBy: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

const AdminInfo = mongoose.model("AdminInfo", adminSchema);
module.exports = AdminInfo;