const mongoose = require('mongoose');
const sellInventory = require('../models/sellInventory'); 
const ItemModel = require('../models/inventoryItemModel'); 


exports.createsellItem = async (req, res) => {
    const { itemId, itemName, category, price, sellQuantity, totalAmount } = req.body;

    try {

        const existingSale = await sellInventory.findOne({
            schoolId: req.user.schoolId,
            itemId: itemId
        });

        let data;
        
        console.log("P2 existingSale", existingSale);
       
        if (existingSale) {
            existingSale.sellQuantity += sellQuantity;
            existingSale.totalAmount += totalAmount;
           data = await existingSale.save();
        } else {
         
          data =  await sellInventory.create({
                schoolId: req.user.schoolId,
                itemId,
                itemName,
                category,
                price,
                sellQuantity,
                totalAmount
            });
        }
       let updatedData = await ItemModel.findOneAndUpdate(
            { _id: itemId }, 
            {
                $inc: {
                    quantity: -sellQuantity,
                    sellAmount : totalAmount,
                    sellQuantity: sellQuantity
                }
            },
            { new: true } 
        );

        return res.status(200).json({
            success: true,
            message: "Sale recorded successfully",
            sellRecord: data,
            itemRecord: updatedData
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error recording sale",
            error: error.message,
        });
    }
};

exports.returnsellItem = async (req, res) => {
    const { itemId, itemName, category, price, returnQuantity, returnAmount } = req.body;

    try {

        const existingSale = await sellInventory.findOne({
            schoolId: req.user.schoolId,
            itemId: itemId
        });

        
        
        console.log("P2 existingSale", existingSale);

        if (!existingSale) {
            return res.status(400).json({
                success: false,
                message: "This item is not sell yet how you return"
            })
        }
       
        existingSale.sellQuantity -= returnQuantity;
        existingSale.totalAmount -= returnAmount;
        let data = await existingSale.save();
    




       let updatedData = await ItemModel.findOneAndUpdate(
            { _id: itemId }, 
            {
                $inc: {
                    quantity: returnQuantity,
                    sellAmount : -returnAmount,
                    sellQuantity: -returnQuantity
                }

            },
            { new: true } 
        );

        return res.status(200).json({
            success: true,
            message: "Return recorded successfully",
            sellRecord: data,
            itemRecord: updatedData
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error in return sale",
            error: error.message,
        });
    }
};


exports.multiItemSell = async (req, res) => {
    const { items, name, totalAmount, date } = req.body;

    try {
        const sellData = {
            schoolId: req.user.schoolId,
            items: [],
            name,
            totalAmount,
            date: date || new Date(),
        };

        for (let item of items) {
            const { itemId, itemName, category, price, sellQuantity, sellAmount } = item;

            const inventoryItem = await ItemModel.findOne({
                schoolId: req.user.schoolId,
                _id: itemId
            });

            if (!inventoryItem) {
                return res.status(404).json({
                    success: false,
                    message: `Item with ID ${itemId} not found`,
                });
            }

            if (inventoryItem.quantity < sellQuantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient quantity for item ${inventoryItem.itemName}`,
                });
            }

            // Update the inventory item quantity
            await ItemModel.findOneAndUpdate(
                { _id: itemId },
                {
                    $inc: {
                        quantity: -sellQuantity
                    }
                },
                { new: true }
            );

            // Add the item to the sell data
            sellData.items.push({
                itemId,
                itemName,
                category,
                price,
                sellQuantity,
                sellAmount
            });
        }

        // Save all items in a single document
        const sellRecord = await sellInventory.create(sellData);

        return res.status(200).json({
            success: true,
            message: "Items sold successfully",
            totalAmount,
            name,
            date: date || new Date(),
            sellRecord
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error selling items",
            error: error.message,
        });
    }
};


exports.getSalesRecords = async (req, res) => {
    try {
        const salesRecords = await sellInventory.find({
            schoolId: req.user.schoolId
        });

        if (!salesRecords || salesRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No sales records found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Sales records retrieved successfully",
            data: salesRecords
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error retrieving sales records",
            error: error.message
        });
    }
};