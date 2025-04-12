// models/salesModel.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const saleSchema = new mongoose.Schema({
  saleId: { type: String, default: uuidv4, unique: true }, // Added saleId
  schoolId: { type: String, required: true },
  session: { type: String, required: true },
  studentId: { type: String, required: true },
  items: [
    {
      itemId: { type: String, required: true },
      itemName: { type: String, required: true },
      category: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      total: { type: Number, required: true },
      icon: { type: String },
      color: { type: String },
    },
  ],
  totalAmount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ["paid", "pending"], default: "pending" },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
  receiptId: { type: String, unique: true, default: uuidv4 },
});

const Sale = mongoose.model("Sale", saleSchema);
module.exports = Sale;