const mongoose = require("mongoose");

const returnSchema = new mongoose.Schema({
  schoolId: { type: String, required: true },
  session: { type: String, required: true },
  saleId: { type: String, required: true },
  studentId: { type: String, required: true },
  items: [
    {
      itemId: { type: String, required: true },
      itemName: { type: String, required: true },
      category: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      total: { type: Number, required: true },
    },
  ],
  totalAmount: { type: Number, required: true },
  returnDate: { type: Date, default: Date.now },
  reason: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
});

const Return = mongoose.model("Return", returnSchema);
module.exports = Return;