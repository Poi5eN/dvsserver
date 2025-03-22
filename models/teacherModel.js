const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const teacherSchema = new mongoose.Schema({
  teacherId: {
    type: String,
    required: true,
    unique: true,
    default: uuidv4,
  },
  schoolId: {
    type: String,
    required: true,
  },
  session: {
    type: String,
    required: true,
  },
  teacherName: {
    type: String,
    required: [true, "Please Enter Full Name"],
  },
  employeeId: {
    type: String,
    required: [true, "Please Enter EmployeeId of Teacher"],
  },
  email: {
    type: String,
    required: [true, "Please Enter Email Address"],
  },
  password: {
    type: String,
    required: [true, "Please Enter Password"],
    minLength: [8, "Minimum 8 characters Required in Password"],
    select: false,
  },
  dateOfBirth: {
    type: Date,
    required: true,
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
    required: true,
  },
  salary: {
    type: Number,
    required: true,
  },
  subject: [String],
  gender: {
    type: String,
    required: true,
  },
  joiningDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  address: {
    type: String,
    required: true,
  },
  contact: {
    type: Number,
    required: true,
  },
  experience: {
    type: String,
    required: true,
  },
  section: String,
  classTeacher: String,
  image: {
    public_id: {
      type: String,
      required: true,
      default: "",
    },
    url: {
      type: String,
      required: true,
      default: "",
    },
  },
  role: {
    type: String,
    required: true,
    default: "teacher",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Teacher", teacherSchema);