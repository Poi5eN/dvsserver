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
    default: false
  },
  content: [
    {
      id: {
        type: String,
        required: true,
        default: () => uuidv4()
      },
      data: {
        type: String, // Base64-encoded HTML content
        required: true
      },
      name: {
        type: String,
        trim: true,
        default: ""
      }
    }
  ],
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

designFormatSchema.index({ schoolId: 1, type: 1, isDefault: 1 }, { 
  unique: true, 
  partialFilterExpression: { isDefault: true } 
});

const DesignFormat = mongoose.model("DesignFormat", designFormatSchema);
module.exports = DesignFormat;