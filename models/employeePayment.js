const mongoose = require("mongoose");

const employeePaymentSchema = new mongoose.Schema({
  schoolId: {
    type: String,
    required: true,
  },
  employeeId: {
    type: String,
    required: true,
  },
  year: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now()
},
session: { type: String, required: true },
  salaryHistory: [
    {
      date: {
        type: Date,
        required: true,
        default: new Date(),
      },
      status: {
        type: String,
        required: true,
      },
      month: {
        type: String,
        required: true,
      },
      paidAmount: {
        type: Number,
        required: true,
      },
    },
  ],
});

module.exports = mongoose.model("employeePayment", employeePaymentSchema);
