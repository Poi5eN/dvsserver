const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const bundleSchema = new mongoose.Schema({
  bundleId: { type: String, default: uuidv4, unique: true },
  schoolId: { type: String, required: true },
  session: { type: String, required: true },
  bundleName: { type: String, required: true },
  items: [
    {
      itemId: { type: String, required: true },
      quantity: { type: Number, required: true },
    },
  ],
  price: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
});

const BundleModel = mongoose.model("BundleModel", bundleSchema);
module.exports = BundleModel;