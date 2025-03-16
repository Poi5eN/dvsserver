const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const syllabusSchema = new mongoose.Schema({
  syllabusId: {
    type: String,
    default: uuidv4,
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
  className: {
    type: String,
    required: [true, "Please Enter Class Name"],
  },
  academicYear: {
    type: String,
    required: [true, "Please Enter Academic Year"],
  },
  file: {
    public_id: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
  updatedBy: {
    type: String,
  },
});

const SyllabusModel = mongoose.model("Curriculum", syllabusSchema);
module.exports = SyllabusModel;