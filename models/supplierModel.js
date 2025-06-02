const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const supplierSchema = new mongoose.Schema({
  supplierId: { type: String, default: uuidv4, unique: true },
  schoolId: { type: String, required: true },
  session: { type: String, required: true },
  name: { type: String, required: true },
  contact: { type: String },
  address: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
});

const SupplierModel = mongoose.model("SupplierModel", supplierSchema);
module.exports = SupplierModel;