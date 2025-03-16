const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const employeeSchema = new mongoose.Schema({
  staffId: {
    type: String,
    default: uuidv4, // Auto-generate UUID
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
  staffName: {
    type: String,
    required: [true, "Please Enter Full Name"],
  },
  email: {
    type: String,
    required: [true, "Please Enter Email Address"],
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Please Enter Password"],
    minLength: [8, "Minimum 8 characters Required in Password"],
    select: false,
  },
  dateOfBirth: {
    type: Date,
    // required: true,
    validate: {
      validator: function (value) {
        return value <= new Date();
      },
      message: "Date of birth cannot be in the future",
    },
  },
  status: {
    type: String,
    required: true,
    default: "active",
  },
  qualification: {
    type: String,
    // required: true,
  },
  salary: {
    type: Number,
    // required: true,
  },
  gender: {
    type: String,
    // required: true,
  },
  joiningDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  address: {
    type: String,
    // required: true,
  },
  contact: {
    type: Number,
    // required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
  updatedBy: {
    type: String, // UUID of the admin who updated
  },
  image: {
    public_id: {
      type: String,
    //   required: true,
    },
    url: {
      type: String,
    //   required: true,
    },
  },
});

const EmployeeModel = mongoose.model("EmployeeModel", employeeSchema);
module.exports = EmployeeModel;