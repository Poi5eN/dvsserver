const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const supplierPaymentSchema = new mongoose.Schema({
  paymentId: { type: String, default: uuidv4, unique: true },
  schoolId: { type: String, required: true },
  session: { type: String, required: true },
  supplierId: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  paymentMode: { type: String, enum: ["Cash", "Card", "Online", "Cheque"] },
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
});

const SupplierPayment = mongoose.model("SupplierPayment", supplierPaymentSchema);
module.exports = SupplierPayment;