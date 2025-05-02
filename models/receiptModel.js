const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const receiptSchema = new mongoose.Schema({
  receiptId: { type: String, default: uuidv4, unique: true },
  saleNumber: { type: Number, required: true }, // Reference saleNumber instead of saleId
  studentId: { type: String, required: true },
  itemsSold: [
    {
      itemName: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      total: { type: Number, required: true },
    },
  ],
  totalAmount: { type: Number, required: true },
  dueAmount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ["paid", "pending"], required: true },
  paymentHistory: [
    {
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      updatedBy: { type: String },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

const ReceiptModel = mongoose.model("ReceiptModel", receiptSchema);
module.exports = ReceiptModel;