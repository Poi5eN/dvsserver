const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const teacherSchema = new mongoose.Schema(
  {
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
      minLength: [4, "Minimum 8 characters Required in Password"],
      select: false,
    },
    dateOfBirth: {
      type: Date,
      required: false,
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
      required: false,
    },
    salary: {
      type: Number,
      required: false,
    },
    subject: [String],
    gender: {
      type: String,
      required: false,
    },
    joiningDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    address: {
      type: String,
      required: false,
    },
    contact: {
      type: Number,
      required: false,
    },
    experience: {
      type: String,
      required: false,
    },
    section: String,
    classTeacher: String,
    image: {
      public_id: {
        type: String,
        required: false,
        default: "",
      },
      url: {
        type: String,
        required: false,
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
    createdBy: {
      type: String,
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Teacher", teacherSchema);
