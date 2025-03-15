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


  

//   exports.getItemSellHistory = async (req, res) => {
//     const { itemId, startDate, endDate } = req.query;
    
//     try {
//       const query = { schoolId: req.user.schoolId };
  
//       // Filter by itemId if provided
//       if (itemId) {
//         query.itemId = itemId;
//       }
  
//       // Filter by date range if provided
//       if (startDate && endDate) {
//         query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
//       } else if (startDate) {
//         query.date = { $gte: new Date(startDate) };
//       } else if (endDate) {
//         query.date = { $lte: new Date(endDate) };
//       }
  
//       // Fetch the sell history based on the query
//       const sellHistory = await sellInventory.find(query).sort({ date: -1 });
  
//       return res.status(200).json({
//         success: true,
//         message: "Item sell history fetched successfully",
//         sellHistory
//       });
//     } catch (error) {
//       return res.status(500).json({
//         success: false,
//         message: "Error fetching item sell history",
//         error: error.message
//       });
//     }
//   };
  



// exports.deleteExam = async (req, res) => {
//     try {

//         const { examId } = req.params;

//         const existExam = await ExamModel.findById(examId);

//         if (!existExam) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Exam Data not found"
//             })
//         }

//         const deletedExam = await existExam.deleteOne();

//         res.status(200).json({
//             success: true,
//             message: "Deleted Exam Info is Successfully",
//             deletedExam
//         })

//     }
//     catch (error) {

//         res.status(500).json({
//             success: false,
//             message: "Delete info of Exam not done successfully due to error",
//             error: error.message
//         })

//     }
// }

// exports.updateExam = async (req, res) => {
//     try {

//         const { ...examFields } = req.body;

//         const existExamData = await ExamModel.findOne({
//             schoolId: req.user.schoolId,
//             className: examFields.className,
//             section: examFields.section
//         })

//         if (!existExamData) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Exam Details is not found"
//             })
//         }

//         for (const key in examFields) {

//             if (key === "examName" || key === "examInfo")
//                 existExamData[key] = examFields[key]
//         }

//         const updatedExamData = await existExamData.save();

//         res.status(200).json({
//             success: true,
//             message: "Exam Details is successfully updated",
//             updatedExamData
//         })

//     }
//     catch (error) {

//         res.status(500).json({
//             success: false,
//             message: "Update Details of Exam is not successfully",
//             error: error.message
//         })

//     }
// }

// exports.getAllExams = async (req, res) => {
//     try {

//         const { className, section } = req.query;

//         const filter = {
//             ...(className ? { className: className } : {}),
//             ...(section ? { section: section } : {})
//         }

//         const examData = await ExamModel.find({ schoolId: req.user.schoolId, ...filter });

//         res.status(200).json({
//             success: true,
//             message: "Exam Data Successfully Get",
//             examData
//         })

//     }
//     catch (error) {

//         res.status(500).json({
//             success: false,
//             message: "Exam Details is not get Successfully",
//             error: error.message
//         })

//     }
// }