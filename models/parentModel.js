const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const parentSchema = new mongoose.Schema({
  parentId: {
    type: String,
    required: true,
    unique: true,
    default: uuidv4,
  },
  schoolId: { type: String, required: true },
  session: { type: String, required: true },
  studentIds: [
    { type: String, ref: "NewStudentModel", required: true },
  ],
  studentNames: [String],
  fatherName: { type: String, required: [true, "Please Enter Father Name"] },
  motherName: { type: String },
  email: { 
    type: String, 
    required: [true, "Please Enter Email Address"],
    unique: true, 
  },
  password: {
    type: String,
    required: [true, "Please Enter Password"],
    select: false,
    minLength: [8, "Minimum 8 characters Required in Password"],
  },
  status: { type: String, required: true, default: "active" },
  contact: { type: String, required: true },
  role: { type: String, required: true, default: "parent" },
  parentImage: { public_id: { type: String, default: "" }, url: { type: String, default: "" } },
  fatherImage: { public_id: { type: String, default: "" }, url: { type: String, default: "" } },
  motherImage: { public_id: { type: String, default: "" }, url: { type: String, default: "" } },
  guardianImage: { public_id: { type: String, default: "" }, url: { type: String, default: "" } },
  admissionNumber: {
    type: String,
    unique: true,
    required: true,
    match: /^[A-Z]{2}\d{4}$/,
    message: "Admission number must follow the pattern: 2 uppercase letters followed by 4 digits (e.g., DI1000)",
  },
  base64: { type: String },
  income: { type: Number },
  qualification: { type: String },
  guardianName: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

parentSchema.index({ email: 1, schoolId: 1 }, { unique: true });

// Removed unique index on email since uniqueness is now per schoolId and session, handled in code
const ParentModel = mongoose.model("ParentModel", parentSchema);
module.exports = ParentModel;