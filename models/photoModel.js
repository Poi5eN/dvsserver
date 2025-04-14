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
    required: [true, "Please enter the name of the student"],
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
    required: [true, "Please enter the section"],
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

const PhotoModel = mongoose.model("PhotoModel", photoSchema);
module.exports = PhotoModel;