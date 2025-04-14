// models/UnifiedReceipt.js
const mongoose = require("mongoose");

const unifiedReceiptSchema = new mongoose.Schema({
  schoolId: { type: String, required: true },
  unifiedReceiptNumber: { type: String, required: true, unique: true },
  feeReceiptNumber: { type: String }, // Optional, kept for compatibility
  studentIds: [{ type: String, required: true }],
  totalAmountPaid: { type: Number, required: true },
  totalDues: { type: Number, required: true },
  paymentMode: { type: String, required: true },
  transactionId: { type: String },
  date: { type: Date, required: true },
  remark: { type: String },
  createdAt: { type: Date, default: Date.now },
  session: { type: String, required: true }, // Added for session filtering
  regularFees: [
    {
      month: { type: String, required: true },
      paidAmount: { type: Number, default: 0 },
      dueAmount: { type: Number, default: 0 },
      status: { type: String, default: "Paid" },
    },
  ],
  additionalFees: [
    {
      name: { type: String, required: true },
      month: { type: String },
      paidAmount: { type: Number, default: 0 },
      dueAmount: { type: Number, default: 0 },
      status: { type: String, default: "Paid" },
    },
  ],
  status: { type: String, default: "active" }, // Added for cancel status
});

// Composite unique index
unifiedReceiptSchema.index({ schoolId: 1, unifiedReceiptNumber: 1 }, { unique: true });

module.exports = mongoose.model("UnifiedReceipt", unifiedReceiptSchema);