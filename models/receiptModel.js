// models/receiptModel.js (ensure it exists or create if missing)
const mongoose = require("mongoose");

const receiptSchema = new mongoose.Schema({
  receiptId: { type: String, required: true, unique: true },
  saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
  studentId: { type: String, required: true },
  itemsSold: [
    {
      itemName: { type: String, required: true },
      sellQuantity: { type: Number, required: true },
      sellAmount: { type: Number, required: true },
    },
  ],
  totalAmount: { type: Number, required: true },
  dueAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ["Paid", "Pending"], default: "Pending" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
});

const ReceiptModel = mongoose.model("Receipt", receiptSchema);
module.exports = ReceiptModel;