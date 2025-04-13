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
    required: true,
  },
  students: [
    {
      studentId: {
        type: String,
        required: true,
      },
      studentName: {
        type: String,
        required: true,
      },
      class: {
        type: String,
        required: true,
      },
      admissionNumber: {
        type: String,
        required: true,
      },
      regularFees: [
        {
          month: String,
          paidAmount: Number,
          dueAmount: Number,
          status: String,
          concessionApplied: Number,
        },
      ],
      additionalFees: [
        {
          name: String,
          month: String,
          paidAmount: Number,
          dueAmount: Number,
          status: String,
          concessionApplied: Number,
        },
      ],
      pastDuesPaid: {
        type: Number,
        default: 0,
      },
      concession: {
        type: Number,
        default: 0,
      },
      totalAmount: {
        type: Number,
        required: true,
      },
      feeReceiptNumber: {
        type: String,
        required: true,
      },
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
  totalDuesBefore: {
    type: Number,
    required: true,
  },
  totalDuesAfter: {
    type: Number,
    required: true,
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
    default: Date.now,
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
});

module.exports = mongoose.model("UnifiedReceipt", unifiedReceiptSchema);