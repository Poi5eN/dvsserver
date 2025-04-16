const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const photoSchema = new mongoose.Schema({
  photoId: {
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
  studentName: {
    type: String,
    required: false, // Changed to optional
  },
  class: {
    type: String,
    required: [true, "Please enter the class"],
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
  section: {
    type: String,
    required: [false, "Please enter the section"],
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
photoSchema.index({ schoolId: 1, session: 1, studentName: 1 }); // For efficient searching
photoSchema.index({ schoolId: 1, session: 1, class: 1, section: 1 }); // For class/section queries

const PhotoModel = mongoose.model("PhotoModel", photoSchema);
module.exports = PhotoModel;