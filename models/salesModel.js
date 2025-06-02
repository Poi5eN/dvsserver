const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const counterSchema = new mongoose.Schema({
  schoolId: { type: String, required: true },
  session: { type: String, required: true },
  sequence: { type: Number, default: 1000 },
});

const Counter = mongoose.model("Counter", counterSchema);

const saleSchema = new mongoose.Schema({
  saleNumber: { type: Number, unique: true, required: true },
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
      bundleId: { type: String }, // Optional, links to BundleModel
    },
  ],
  totalAmount: { type: Number, required: true },
  paymentStatus: { type: String, enum: ["paid", "pending"], default: "pending" },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  paymentMode: {
    type: String,
    enum: ["Cash", "Card", "Online", "Cheque", ""],
    default: "",
  },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
  receiptId: { type: String, unique: true, default: uuidv4 },
  paymentHistory: [
    {
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      updatedBy: { type: String },
      paymentMode: { type: String, enum: ["Cash", "Card", "Online", "Cheque", ""] },
    },
  ],
});

const Sale = mongoose.model("Sale", saleSchema);
module.exports = { Sale, Counter };