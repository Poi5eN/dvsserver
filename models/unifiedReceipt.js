const mongoose = require("mongoose");

const unifiedReceiptSchema = new mongoose.Schema({
    schoolId: { type: String, required: true },
    unifiedReceiptNumber: { type: String, required: true, unique: true },
    feeReceiptNumber: { type: String, required: false }, // add if necessary
    studentIds: [{ type: String, required: true }],
    totalAmountPaid: { type: Number, required: true },
    totalDues: { type: Number, required: true },
    paymentMode: { type: String, required: true },
    transactionId: { type: String },
    date: { type: Date, required: true },
    remark: { type: String },
    createdAt: { type: Date, default: Date.now },
  });
  
  // Remove the unique index on feeReceiptNumber if it’s no longer used:
  unifiedReceiptSchema.index({ schoolId: 1, unifiedReceiptNumber: 1 }, { unique: true });
  
  module.exports = mongoose.model("UnifiedReceipt", unifiedReceiptSchema);