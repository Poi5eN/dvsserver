const mongoose = require("mongoose");

const sellInventorySchema = new mongoose.Schema({
  schoolId: { type: String, required: true },
  studentId: { type: String, required: true },
  receiptId: { type: String, required: true },
  items: [{
    itemId: String,
    itemName: String,
    category: String,
    price: Number,
    sellQuantity: Number,
    sellAmount: Number,
  }],
  totalAmount: { type: Number, required: true },
  dueAmount: { type: Number, default: 0 },
  saleDate: { type: Date, default: Date.now },
  session: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Only define the model if it hasn't been defined yet
module.exports = mongoose.models.SellInventory || mongoose.model("SellInventory", sellInventorySchema);