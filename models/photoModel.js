const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Updated Photo Schema
const photoSchema = new mongoose.Schema({
  photoId: {
    type: String,
    required: true,
    unique: true,
    default: uuidv4,
  },
  photoNo: {
    type: String,
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
  studentName: {
    type: String,
    required: false,
  },
  class: {
    type: String,
    required: false,
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
      null
    ],
  },
  section: {
    type: String,
    required: false,
  },
  studentImage: {
    public_id: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  assignedThirdParty: {
    type: String,
    required: true,
  },
});

photoSchema.index({ photoId: 1 }, { unique: true });
photoSchema.index({ photoNo: 1 }, { unique: true });
photoSchema.index({ schoolId: 1, session: 1, studentName: 1 });
photoSchema.index({ schoolId: 1, session: 1, class: 1, section: 1 });

const PhotoModel = mongoose.model("PhotoModel", photoSchema);