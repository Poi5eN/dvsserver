const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true
    },
    itemName: {
        type: String,
        required: [true, "Please Enter Book Name"]
    },
    category: {
        type: String,
        required: [true, "Please Enter Category Name"]
    },
    quantity: {
        type: Number,
        required: true,
        default: 1
    },
    price: {
        type: Number,
        required: true
    },
    sellQuantity: {
        type: Number,
        required: true,
        default: 0
    },
    sellAmount: {
        type: Number,
        required: true,
        default: 0
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
})



const ItemModel = mongoose.model('ItemModel', itemSchema);

module.exports = ItemModel