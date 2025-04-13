const mongoose = require("mongoose");

const unifiedReceiptSchema = new mongoose.Schema({
  unifiedReceiptNumber: {
    type: String,
    required: true,
    unique: true,
  },
  parentId: {
    type: String,
    required: true,
  },
  parentName: {
    type: String,
    required: true,
  },
  parentContact: {
    type: String,
  },
  students: [
    {
      studentId: { type: String, required: true },
      studentName: { type: String, required: true },
      class: { type: String, required: true },
      admissionNumber: { type: String, required: true },
      regularFees: [
        {
          month: { type: String, required: true },
          paidAmount: { type: Number, required: true },
          dueAmount: { type: Number, required: true },
          status: { type: String, required: true },
          frequency: { type: String, required: true },
        },
      ],
      additionalFees: [
        {
          name: { type: String, required: true },
          month: { type: String },
          paidAmount: { type: Number, required: true },
          dueAmount: { type: Number, required: true },
          status: { type: String, required: true },
          frequency: { type: String, required: true },
        },
      ],
      lateFines: [
        {
          paidAmount: { type: Number, required: true },
          dueAmount: { type: Number, required: true },
        },
      ],
      totalAmount: { type: Number, required: true },
      concession: { type: Number, default: 0 },
      pastDuesPaid: { type: Number, default: 0 },
    },
  ],
  totalAmountPaid: {
    type: Number,
    required: true,
  },
  totalConcession: {
    type: Number,
    default: 0,
  },
  totalPastDuesPaid: {
    type: Number,
    default: 0,
  },
  totalLateFinesPaid: {
    type: Number,
    default: 0,
  },
  totalDuesBefore: {
    type: Number,
    default: 0,
  },
  totalDuesAfter: {
    type: Number,
    default: 0,
  },
  paymentMode: {
    type: String,
    required: true,
  },
  transactionId: {
    type: String,
  },
  date: {
    type: Date,
    required: true,
  },
  session: {
    type: String,
    required: true,
  },
  schoolId: {
    type: String,
    required: true,
  },
  remark: {
    type: String,
  },
  status: {
    type: String,
    enum: ["active", "canceled"],
    default: "active",
  },
});

module.exports = mongoose.model("UnifiedReceipt", unifiedReceiptSchema);