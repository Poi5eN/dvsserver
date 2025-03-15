const mongoose = require('mongoose');

// Schema for regular fee history within fee history
const regularFeeHistorySchema = new mongoose.Schema({
    month: {
        type: String,
        required: true
    },
    paidAmount: {
        type: Number,
        // required: true
    },
    dueAmount: {
        type: Number,
        // required: true
    },
    status: {
        type: String,
        // required: true
    }
});

// Schema for additional fee history within fee history
const additionalFeeHistorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    month: {
        type: String,
        // required: true
    },
    paidAmount: {
        type: Number,
        // required: true
    },
    dueAmount: {
        type: Number,
        // required: true
    },
    status: {
        type: String,
        // required: true
    }
});

// Schema for fee history
const feeHistorySchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        default: Date.now,
        get: (date) => new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    },
    status: {
        type: String,
        // required: true
    },
    regularFees: [regularFeeHistorySchema],
    additionalFees: [additionalFeeHistorySchema],
    feeReceiptNumber: {
        type: String,
        // required: true
    },
    paymentMode: {
        type: String,
        // required: true
    },
    transactionId: {
        type: String
    },
    totalFeeAmount: {
        type: Number,
        // required: true
    },
    previousDues: {
        type: Number,
        default: 0
    },
    remark: {
        type: String
    },
    totalAmountPaid: {
        type: Number,
        default: 0
    },
    totalDues: {
        type: Number,
        default: 0
    },
    concessionFee: {
        type: Number,
        default: 0
    },
    paidAfterConcession: {
        type: Number,
        default: 0
    },
    newPaidAmount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now()
    }
}, { toJSON: { getters: true } });

// Schema for monthly regular dues
const monthlyRegularDuesSchema = new mongoose.Schema({
    month: {
        type: String,
        // required: true
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    dueAmount: {
        type: Number,
        // required: true
    },
    status: {
        type: String,
        // required: true
    }
});

// Schema for monthly additional dues
const monthlyAdditionalDuesSchema = new mongoose.Schema({
    name: {
        type: String,
        // required: true
    },
    month: {
        type: String,
        // required: true
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    dueAmount: {
        type: Number,
        // required: true
    },
    status: {
        type: String,
        // required: true
    }
});

// Schema for monthly dues
const monthlyDuesSchema = new mongoose.Schema({
    regularDues: [monthlyRegularDuesSchema],
    additionalDues: [monthlyAdditionalDuesSchema]
});

// Main fee status schema
const feeManage = new mongoose.Schema({
    schoolId: {
        type: String,
        // required: true
    },
    admissionNumber: {
        type: String,
        // required: true
    },
    year: {
        type: String,
        // required: true
    },
    dues: {
        type: Number,
        default: 0
    },
    session: { type: String, required: true },
    feeHistory: [feeHistorySchema],
    monthlyDues: monthlyDuesSchema
});

module.exports = mongoose.model("feeManage", feeManage);
