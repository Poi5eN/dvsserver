const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const designFormatSchema = mongoose.Schema({
  formatId: {
    type: String,
    default: () => uuidv4(),
    required: true,
    unique: true
  },
  schoolId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['idCard', 'feeReceipt', 'reportCard', 'admissionForm', 'registrationForm'],
    index: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false // Controls if other schools can view this design
  },
  content: {
    type: String, // Stores base64 encoded HTML content
    required: true
  },
  description: {
    type: String,
    trim: true,
    default: ""
  },
  backgroundImage: {
    public_id: {
      type: String,
      default: ""
    },
    url: {
      type: String,
      default: ""
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound index to ensure uniqueness of default format per type per school
designFormatSchema.index({ schoolId: 1, type: 1, isDefault: 1 }, { 
  unique: true, 
  partialFilterExpression: { isDefault: true } 
});

const DesignFormat = mongoose.model("DesignFormat", designFormatSchema);
module.exports = DesignFormat;