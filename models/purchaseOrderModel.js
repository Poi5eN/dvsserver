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
      status: { type: String, enum: ["ordered", "received"], default: "ordered" },
    },
  ],
  totalCost: { type: Number, required: true },
  supplier: { type: String, required: true },
  orderDate: { type: Date, default: Date.now },
  expectedDeliveryDate: { type: Date },
  receivedDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
  updatedBy: { type: String },
});

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);
module.exports = PurchaseOrder;