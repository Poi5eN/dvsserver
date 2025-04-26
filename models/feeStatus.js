const mongoose = require("mongoose");

const regularFeeHistorySchema = new mongoose.Schema({
  month: { type: String },
  paidAmount: { type: Number, required: true },
  dueAmount: { type: Number, required: true },
  status: { type: String, required: true },
  concessionApplied: { type: Number, default: 0 }, // Add this
  exemptionApplied: { type: Number, default: 0 }, // New field
  frequency: {
    type: String,
    enum: ["monthly", "one-time", "annual"],
    // required: true,
  },
});

const additionalFeeHistorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  month: { type: String },
  paidAmount: { type: Number, required: true },
  dueAmount: { type: Number, required: true },
  concessionApplied: { type: Number, default: 0 }, // Add this
  exemptionApplied: { type: Number, default: 0 }, // New field
  status: { type: String, required: true },
  frequency: {
    type: String,
    enum: ["monthly", "one-time", "annual"],
    // required: true,
  },
});

const lateFineSchema = new mongoose.Schema({
  month: { type: String },
  year: { type: String, required: true },
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, required: true },
  appliedOn: { type: Date, default: Date.now },
});

const feeHistorySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      default: Date.now,
      get: (date) =>
        new Date(date).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    },
    status: {
      type: String,
      enum: ["active", "canceled"],
      default: "active",
      required: true,
    },
    regularFees: [regularFeeHistorySchema],
    additionalFees: [additionalFeeHistorySchema],
    lateFines: [lateFineSchema],
    feeReceiptNumber: { type: String, required: true },
    paymentMode: { type: String, required: true },
    transactionId: { type: String },
    totalFeeAmount: { type: Number, required: true },
    pastDuesPaid: { type: Number, default: 0 },
    concessionApplied: { type: Number, default: 0 },
    paymentMessage: { type: String },
    unifiedReceiptNumber: String,
    totalAmountPaid: { type: Number, default: 0 },
    totalDues: { type: Number, default: 0 },
    remark: { type: String },
  },
  { toJSON: { getters: true } }
);

const monthlyRegularDuesSchema = new mongoose.Schema({
  month: { type: String },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, required: true },
  status: { type: String, required: true },
  exemptionApplied: { type: Number, default: 0 }, // New field
  frequency: {
    type: String,
    enum: ["monthly", "one-time", "annual"],
    // required: true,
  },
});

const monthlyAdditionalDuesSchema = new mongoose.Schema({
  name: { type: String, required: true },
  month: { type: String },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, required: true },
  status: { type: String, required: true },
  exemptionApplied: { type: Number, default: 0 }, // New field
  frequency: {
    type: String,
    enum: ["monthly", "one-time", "annual"],
    // required: true,
  },
});

const monthlyDuesSchema = new mongoose.Schema({
  regularDues: [monthlyRegularDuesSchema],
  additionalDues: [monthlyAdditionalDuesSchema],
  lateFines: [lateFineSchema],
});

const feeStatusSchema = new mongoose.Schema({
  schoolId: { type: String, required: true },
  studentId: { type: String, required: true },
  year: { type: String, required: true },
  session: { type: String, required: true },
  dues: { type: Number, default: 0 },
  pastDues: { type: Number, default: 0 },
  overallAmountPaid: { type: Number, default: 0 },
  unifiedReceiptNumber: String,
  overallConcessionApplied: { type: Number, default: 0 },
  overallExemptionApplied: { type: Number, default: 0 }, // New field
  createdAt: { type: Date, default: Date.now },
  feeHistory: [feeHistorySchema],
  monthlyDues: monthlyDuesSchema,
});

module.exports = mongoose.model("FeeStatus", feeStatusSchema);
