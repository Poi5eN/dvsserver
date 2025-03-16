const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const issueBookSchema = new mongoose.Schema({
  issueId: {
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
  studentId: {
    type: String, // Assuming studentId is a UUID
    required: true,
  },
  bookId: {
    type: String, // UUID
    required: true,
  },
  bookName: {
    type: String,
    required: true,
  },
  issueDate: {
    type: Date,
    default: Date.now,
    required: true,
  },
  returnDate: {
    type: Date,
  },
  status: {
    type: String,
    required: true,
    default: "issued",
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
});

const IssueBook = mongoose.model("IssueBook", issueBookSchema);
module.exports = IssueBook;