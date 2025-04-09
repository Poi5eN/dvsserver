const mongoose = require('mongoose');
const sellInventory = require('../models/sellInventory'); 
const ItemModel = require('../models/inventoryItemModel'); 
const ReceiptModel = require('../models/receiptModel'); 


// exports.createsellItem = async (req, res) => {
//     const { itemId, itemName, category, price, sellQuantity, totalAmount } = req.body;

//     try {

//         const existingSale = await sellInventory.findOne({
//             schoolId: req.user.schoolId,
//             itemId: itemId
//         });

//         let data;
        
//         console.log("P2 existingSale", existingSale);
       
//         if (existingSale) {
//             existingSale.sellQuantity += sellQuantity;
//             existingSale.totalAmount += totalAmount;
//            data = await existingSale.save();
//         } else {
         
//           data =  await sellInventory.create({
//                 schoolId: req.user.schoolId,
//                 itemId,
//                 itemName,
//                 category,
//                 price,
//                 sellQuantity,
//                 totalAmount
//             });
//         }
//        let updatedData = await ItemModel.findOneAndUpdate(
//             { _id: itemId }, 
//             {
//                 $inc: {
//                     quantity: -sellQuantity,
//                     sellAmount : totalAmount,
//                     sellQuantity: sellQuantity
//                 }
//             },
//             { new: true } 
//         );

//         return res.status(200).json({
//             success: true,
//             message: "Sale recorded successfully",
//             sellRecord: data,
//             itemRecord: updatedData
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: "Error recording sale",
//             error: error.message,
//         });
//     }
// };

// exports.returnsellItem = async (req, res) => {
//     const { itemId, itemName, category, price, returnQuantity, returnAmount } = req.body;

//     try {

//         const existingSale = await sellInventory.findOne({
//             schoolId: req.user.schoolId,
//             itemId: itemId
//         });

        
        
//         console.log("P2 existingSale", existingSale);

//         if (!existingSale) {
//             return res.status(400).json({
//                 success: false,
//                 message: "This item is not sell yet how you return"
//             })
//         }
       
//         existingSale.sellQuantity -= returnQuantity;
//         existingSale.totalAmount -= returnAmount;
//         let data = await existingSale.save();
    




//        let updatedData = await ItemModel.findOneAndUpdate(
//             { _id: itemId }, 
//             {
//                 $inc: {
//                     quantity: returnQuantity,
//                     sellAmount : -returnAmount,
//                     sellQuantity: -returnQuantity
//                 }

//             },
//             { new: true } 
//         );

//         return res.status(200).json({
//             success: true,
//             message: "Return recorded successfully",
//             sellRecord: data,
//             itemRecord: updatedData
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: "Error in return sale",
//             error: error.message,
//         });
//     }
// };


// exports.multiItemSell = async (req, res) => {
//     const { items, name, totalAmount, date } = req.body;

//     try {
//         const sellData = {
//             schoolId: req.user.schoolId,
//             items: [],
//             name,
//             totalAmount,
//             date: date || new Date(),
//         };

//         for (let item of items) {
//             const { itemId, itemName, category, price, sellQuantity, sellAmount } = item;

//             const inventoryItem = await ItemModel.findOne({
//                 schoolId: req.user.schoolId,
//                 _id: itemId
//             });

//             if (!inventoryItem) {
//                 return res.status(404).json({
//                     success: false,
//                     message: `Item with ID ${itemId} not found`,
//                 });
//             }

//             if (inventoryItem.quantity < sellQuantity) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Insufficient quantity for item ${inventoryItem.itemName}`,
//                 });
//             }

//             // Update the inventory item quantity
//             await ItemModel.findOneAndUpdate(
//                 { _id: itemId },
//                 {
//                     $inc: {
//                         quantity: -sellQuantity
//                     }
//                 },
//                 { new: true }
//             );

//             // Add the item to the sell data
//             sellData.items.push({
//                 itemId,
//                 itemName,
//                 category,
//                 price,
//                 sellQuantity,
//                 sellAmount
//             });
//         }

//         // Save all items in a single document
//         const sellRecord = await sellInventory.create(sellData);

//         return res.status(200).json({
//             success: true,
//             message: "Items sold successfully",
//             totalAmount,
//             name,
//             date: date || new Date(),
//             sellRecord
//         });

//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: "Error selling items",
//             error: error.message,
//         });
//     }
// };


// exports.getSalesRecords = async (req, res) => {
//     try {
//         const salesRecords = await sellInventory.find({
//             schoolId: req.user.schoolId
//         });

//         if (!salesRecords || salesRecords.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: "No sales records found"
//             });
//         }

//         return res.status(200).json({
//             success: true,
//             message: "Sales records retrieved successfully",
//             data: salesRecords
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: "Error retrieving sales records",
//             error: error.message
//         });
//     }
// };


exports.createsellItem = async (req, res) => {
    const { itemId, sellQuantity, studentId, totalAmount, dueAmount = 0 } = req.body;
  
    try {
      const item = await ItemModel.findById(itemId);
      if (!item || item.quantity < sellQuantity) {
        return res.status(400).json({ success: false, message: "Insufficient stock" });
      }
  
      const receiptId = `REC-${Date.now()}`;
      const sale = await SellInventory.create({
        schoolId: req.user.schoolId,
        studentId,
        receiptId,
        items: [{
          itemId,
          itemName: item.itemName,
          category: item.category,
          price: item.price,
          sellQuantity,
          sellAmount: totalAmount,
        }],
        totalAmount,
        dueAmount,
        session: req.user.session,
      });
  
      await ReceiptModel.create({
        receiptId,
        saleId: sale._id,
        studentId,
        itemsSold: [{ itemName: item.itemName, sellQuantity, sellAmount: totalAmount }],
        totalAmount,
        dueAmount,
        paymentStatus: dueAmount > 0 ? "Pending" : "Paid",
      });
  
      await ItemModel.findByIdAndUpdate(itemId, {
        $inc: { quantity: -sellQuantity, sellQuantity, sellAmount: totalAmount },
      });
  
      return res.status(200).json({
        success: true,
        message: "Sale recorded successfully",
        sale,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };



  exports.returnsellItem = async (req, res) => {
    const { saleId, returnQuantity } = req.body;
  
    try {
      const sale = await SellInventory.findById(saleId);
      if (!sale || sale.items[0].sellQuantity < returnQuantity) {
        return res.status(400).json({ success: false, message: "Invalid return request" });
      }
  
      const item = sale.items[0];
      const returnAmount = item.price * returnQuantity;
      sale.items[0].sellQuantity -= returnQuantity;
      sale.totalAmount -= returnAmount;
      sale.dueAmount = Math.max(0, sale.dueAmount - returnAmount);
      await sale.save();
  
      await ReceiptModel.findOneAndUpdate(
        { saleId },
        { $inc: { totalAmount: -returnAmount, dueAmount: -returnAmount }, paymentStatus: sale.dueAmount > 0 ? "Pending" : "Paid" }
      );
  
      await ItemModel.findByIdAndUpdate(item.itemId, {
        $inc: { quantity: returnQuantity, sellQuantity: -returnQuantity, sellAmount: -returnAmount },
      });
  
      return res.status(200).json({ success: true, message: "Return processed", sale });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };



  exports.multiItemSell = async (req, res) => {
    const { items, studentId, totalAmount, dueAmount = 0 } = req.body;
  
    try {
      for (const { itemId, sellQuantity } of items) {
        const item = await ItemModel.findById(itemId);
        if (!item || item.quantity < sellQuantity) {
          return res.status(400).json({ success: false, message: `Insufficient stock for ${item.itemName}` });
        }
      }
  
      const receiptId = `REC-${Date.now()}`;
      const sale = await SellInventory.create({
        schoolId: req.user.schoolId,
        studentId,
        receiptId,
        items: items.map(item => ({
          itemId: item.itemId,
          itemName: item.itemName,
          category: item.category,
          price: item.price,
          sellQuantity: item.sellQuantity,
          sellAmount: item.price * item.sellQuantity,
        })),
        totalAmount,
        dueAmount,
        session: req.user.session,
      });
  
      await ReceiptModel.create({
        receiptId,
        saleId: sale._id,
        studentId,
        itemsSold: items.map(item => ({
          itemName: item.itemName,
          sellQuantity: item.sellQuantity,
          sellAmount: item.price * item.sellQuantity,
        })),
        totalAmount,
        dueAmount,
        paymentStatus: dueAmount > 0 ? "Pending" : "Paid",
      });
  
      for (const { itemId, sellQuantity } of items) {
        await ItemModel.findByIdAndUpdate(itemId, {
          $inc: { quantity: -sellQuantity, sellQuantity, sellAmount: items.find(i => i.itemId === itemId).price * sellQuantity },
        });
      }
  
      return res.status(200).json({ success: true, message: "Multi-item sale recorded", sale });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };




  exports.getSalesRecords = async (req, res) => {
    const { day, month, year } = req.query;
  
    try {
      let query = { schoolId: req.user.schoolId };
      if (day) query.saleDate = { $gte: new Date(year, month - 1, day), $lte: new Date(year, month - 1, day, 23, 59, 59) };
      else if (month) query.saleDate = { $gte: new Date(year, month - 1, 1), $lte: new Date(year, month, 0) };
      else if (year) query.saleDate = { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) };
  
      const sales = await SellInventory.find(query);
      return res.status(200).json({ success: true, message: "Sales records retrieved", data: sales });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };




  exports.getTopSellingItems = async (req, res) => {
    const { day, month, year } = req.query;
  
    try {
      let query = { schoolId: req.user.schoolId };
      if (day) query.saleDate = { $gte: new Date(year, month - 1, day), $lte: new Date(year, month - 1, day, 23, 59, 59) };
      else if (month) query.saleDate = { $gte: new Date(year, month - 1, 1), $lte: new Date(year, month, 0) };
      else if (year) query.saleDate = { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) };
  
      const sales = await SellInventory.aggregate([
        { $match: query },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.itemId",
            itemName: { $first: "$items.itemName" },
            totalSold: { $sum: "$items.sellQuantity" },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 3 },
      ]);
  
      return res.status(200).json({ success: true, data: sales });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };
  