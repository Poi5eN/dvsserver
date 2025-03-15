const mongoose = require("mongoose");
const { v4: uuidv4 } = require('uuid');

const classSchema = new mongoose.Schema(
  {
    schoolId: {
      type: String,
      required: true,
    },
    classId: {
      type: String,
      required: true,
      default: uuidv4, // Auto-generate a UUID for each class
      unique: true,
    },
    className: {
      type: String,
      required: true,
    },
    sections: [
      {
        type: String,
      },
    ],
    session: { type: String, required: true },
    subjects: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

classSchema.index({ schoolId: 1, className: 1 }, { unique: true });

module.exports = mongoose.model("Class", classSchema);
