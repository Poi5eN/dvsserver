const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const taskSchema = new mongoose.Schema({
  taskId: {
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
  section: {
    type: String,
    required: [true, "Please Enter Section Name"],
  },
  title: {
    type: String,
    required: [true, "Please Enter Title"],
  },
  description: {
    type: String,
    required: [true, "Please Enter Description"],
  },
  dueDate: {
    type: Date,
    required: [true, "Please Enter the Due Date"],
  },
  subject: {
    type: String,
    required: [true, "Please Enter Subject"],
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
});

const Assignment = mongoose.model("Assignment", taskSchema);
module.exports = Assignment;