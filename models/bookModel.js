const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const bookSchema = new mongoose.Schema({
  bookId: {
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
  bookName: {
    type: String,
    required: [true, "Please Enter Book Name"],
  },
  authorName: {
    type: String,
    required: [true, "Please Enter Author Name"],
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  category: {
    type: String,
    required: true,
  },
  className: {
    type: String,
  },
  subject: {
    type: String,
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

const BookModel = mongoose.model("BookModel", bookSchema);
module.exports = BookModel;