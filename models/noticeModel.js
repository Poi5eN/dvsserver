const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const noticeSchema = new mongoose.Schema({
  noticeId: {
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
  title: {
    type: String,
    required: [true, "Please Enter Title of Notice"],
  },
  content: {
    type: String,
    required: [true, "Please Enter Content of Notice"],
  },
  class: {
    type: String,
  },
  section: {
    type: String,
  },
  role: {
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
    type: String,
  },
  file: {
    public_id: {
      type: String,
    },
    url: {
      type: String,
    },
  },
});

const NoticeModel = mongoose.model("Notice", noticeSchema);
module.exports = NoticeModel;