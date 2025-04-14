const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

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
      enum: [
        "PRE NUR",
        "NUR",
        "LKG",
        "UKG",
        "I",
        "II",
        "III",
        "IV",
        "V",
        "VI",
        "VII",
        "VIII",
        "IX",
        "X",
        "XI",
        "XII",
        "PASS OUT",
      ],
    },
    sections: [
      {
        type: String,
        trim: true,
      },
    ],
    session: {
      type: String,
      required: false,
    },
    subjects: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Ensure uniqueness on schoolId and className
classSchema.index({ schoolId: 1, className: 1 }, { unique: true });

module.exports = mongoose.model("Class", classSchema);