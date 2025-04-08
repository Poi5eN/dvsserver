const mongoose = require("mongoose");

const sellInventorySchema = new mongoose.Schema({
  schoolId: { type: String, required: true },
  studentId: { type: String, required: true }, // Links to student
  receiptId: { type: String, required: true }, // Links to receipt
  items: [
    {
      itemId: { type: String, required: true },
      itemName: { type: String, required: true },
      category: { type: String, required: true },
      price: { type: Number, required: true },
      sellQuantity: { type: Number, required: true },
      sellAmount: { type: Number, required: true },
    },
  ],
  totalAmount: { type: Number, required: true },
  dueAmount: { type: Number, default: 0 }, // Tracks unpaid amounts
  saleDate: { type: Date, default: Date.now },
  session: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const SellInventory = mongoose.model("SellInventory", sellInventorySchema);
module.exports = SellInventory;