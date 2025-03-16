const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const itemSchema = new mongoose.Schema({
  itemId: {
    type: String,
    default: uuidv4, // Auto-generate UUID
    required: true,
    unique: true,
  },
  schoolId: {
    type: String,
    required: true,
  },
  session: {
    type: String,
    required: true,
  },
  itemName: {
    type: String,
    required: [true, "Please Enter Item Name"],
  },
  category: {
    type: String,
    required: [true, "Please Enter Category Name"],
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  sellQuantity: {
    type: Number,
    required: true,
    default: 0,
  },
  sellAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
  updatedBy: {
    type: String, // UUID of the admin who updated
  },
});

const ItemModel = mongoose.model("ItemModel", itemSchema);
module.exports = ItemModel;