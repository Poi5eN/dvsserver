// CLASS SCHEMA (Updated)
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
      default: uuidv4,
      unique: true,
    },
    className: {
      type: String,
      required: true,
    },
    sections: [{
      type: String,
    }],
    session: { 
      type: String, 
      required: false // Make session optional
    },
    subjects: [{
      type: String,
    }],
  },
  {
    timestamps: true,
  }
);

// Update index to only enforce uniqueness on schoolId and className
classSchema.index({ schoolId: 1, className: 1 }, { unique: true });

module.exports = mongoose.model("Class", classSchema);