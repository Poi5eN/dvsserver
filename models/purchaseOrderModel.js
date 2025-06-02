const mongoose = require("mongoose");

const purchaseOrderSchema = new mongoose.Schema({
  schoolId: { type: String, required: true },
  session: { type: String, required: true },
  items: [
    {
      itemId: { type: String, required: true },
      itemName: { type: String, required: true },
      category: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      totalCost: { type: Number, required: true },
    },
  ],
  supplierId: { type: String, required: true }, // Updated to reference SupplierModel
  totalCost: { type: Number, required: true },
  expectedDeliveryDate: { type: Date },
  status: { type: String, enum: ["ordered", "received"], default: "ordered" },
  receivedDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
});

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);
module.exports = PurchaseOrder;