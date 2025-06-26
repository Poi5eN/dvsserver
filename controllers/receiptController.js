// controllers/receiptController.js
const jsPDF = require("jspdf");
const Sale = require("../models/salesModel");
const NewStudentModel = require("../models/newStudentModel");

// controllers/inventoryItemController.js (append to existing file)
exports.generateReceipt = async (req, res) => {
  try {
    const { saleId } = req.params;
    const { schoolId, session } = req.user;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!saleId) {
      return res.status(400).json({
        success: false,
        message: "Sale ID is required in the URL parameter.",
      });
    }

    const sale = await Sale.findOne({ saleId, schoolId, session });
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found or does not belong to this school and session.",
      });
    }

    const student = await axios.get(
      `https://api.digitalvidyasaarthi.in/api/v1/adminRoute/studentparent?studentId=${sale.studentId}`,
      {
        headers: {
          Authorization: `Bearer ${req.headers.authorization.split(" ")[1]}`,
        },
      }
    );
    if (!student.data.success) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const receiptData = {
      receiptId: sale.receiptId || `REC-${Date.now()}`,
      saleId: sale.saleId,
      studentName: student.data.students.data[0]?.studentName || "Unknown",
      date: sale.date,
      items: sale.items.map((item) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
      totalAmount: sale.totalAmount,
      paidAmount: sale.paidAmount,
      dueAmount: sale.dueAmount,
      paymentStatus: sale.paymentStatus,
    };

    // Save receipt to ReceiptModel if not already saved (optional, based on your flow)
    const existingReceipt = await ReceiptModel.findOne({ saleId: sale._id });
    if (!existingReceipt) {
      await ReceiptModel.create({
        receiptId: receiptData.receiptId,
        saleId: sale._id,
        studentId: sale.studentId,
        itemsSold: receiptData.items,
        totalAmount: receiptData.totalAmount,
        dueAmount: receiptData.dueAmount,
        paymentStatus: receiptData.paymentStatus,
      });
    }

    res.status(200).json({
      success: true,
      message: "Receipt generated successfully",
      receipt: receiptData,
    });
  } catch (error) {
    console.error("Error in generateReceipt:", error);
    res.status(500).json({
      success: false,
      message: "Receipt generation failed due to error",
      error: error.message,
    });
  }
};