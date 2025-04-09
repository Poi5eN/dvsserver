const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const itemSchema = new mongoose.Schema({
  itemId: {
    type: String,
    default: uuidv4,
    required: true,
    unique: true,
  },
  schoolId: { type: String, required: true },
  session: { type: String, required: true },
  itemName: { type: String, required: [true, "Please Enter Item Name"] },
  category: { type: String, required: [true, "Please Enter Category Name"] },
  quantity: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true },
  sellQuantity: { type: Number, required: true, default: 0 },
  sellAmount: { type: Number, required: true, default: 0 },
  icon: { type: String, default: "🛒" }, // Default icon for custom items
  color: { type: String, default: "#000000" }, // Default color for custom items
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
});

const ItemModel = mongoose.model("ItemModel", itemSchema);
module.exports = ItemModel;