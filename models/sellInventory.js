const mongoose = require("mongoose");

const sellInventorySchema = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true
    },
    items: [
        {
            itemId: {
                type: String,
                required: true
            },
            itemName: {
                type: String,
                required: true
            },
            category: {
                type: String,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            sellQuantity: {
                type: Number,
                required: true
            },
            sellAmount: {
                type: Number,
                required: true
            }
        }
    ],
    name: {
        type: String,
        // required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        // required: true
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
});

const sellInventory = mongoose.model("sellInventory", sellInventorySchema);

module.exports = sellInventory;
