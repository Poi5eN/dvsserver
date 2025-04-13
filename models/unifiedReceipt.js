const mongoose = require("mongoose");

const unifiedReceiptSchema = new mongoose.Schema({
  schoolId: { type: String, required: true },
  feeReceiptNumber: { type: String, required: true, unique: true },
  studentIds: [{ type: String, required: true }],
  totalAmountPaid: { type: Number, required: true },
  totalDues: { type: Number, required: true },
  paymentMode: { type: String, required: true },
  transactionId: { type: String },
  date: { type: Date, required: true },
  remark: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UnifiedReceipt", unifiedReceiptSchema);
