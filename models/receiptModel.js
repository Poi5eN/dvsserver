// models/receiptModel.js
const mongoose = require("mongoose");

const receiptSchema = new mongoose.Schema({
  receiptId: { type: String, required: true, unique: true },
  saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
  studentId: { type: String, required: true },
  itemsSold: [
    {
      itemName: { type: String, required: true },
      quantity: { type: Number, required: true }, // Renamed from sellQuantity to match sale.items
      price: { type: Number, required: true },
      total: { type: Number, required: true }, // Renamed from sellAmount to match sale.items
    },
  ],
  totalAmount: { type: Number, required: true },
  dueAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ["paid", "pending"], default: "pending" }, // Updated enum to match sale.paymentStatus
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
});

const ReceiptModel = mongoose.model("Receipt", receiptSchema);
module.exports = ReceiptModel;