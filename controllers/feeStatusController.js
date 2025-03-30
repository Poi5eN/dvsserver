// ABOVE CODE WORKING WELL TO REVERT
const mongoose = require('mongoose');
const NewStudentModel = require("../models/newStudentModel");
const FeeStatus = require("../models/feeStatus");
const FeeStructure = require("../models/feeStructureModel");
const ParentModel = require('../models/parentModel');
const { generateStructuredNumber } = require('../utils/numberGenerator'); // Adjust path as needed

// Helper function to generate a structured fee receipt number
const generateFeeReceiptNumber = async (schoolId) => {
  console.log(`Generating fee receipt number for schoolId: ${schoolId}`);
  try {
    const receiptNumber = await generateStructuredNumber(schoolId, FeeStatus, 'feeHistory.feeReceiptNumber');
    console.log(`Generated receipt number: ${receiptNumber}`);
    return receiptNumber;
  } catch (error) {
    console.error('Error generating fee receipt number:', error.message);
    throw error;
  }
};

// Add past dues
exports.addPastDues = async (req, res) => {
  try {
    const { students } = req.body; // Expecting an array of { studentId, pastDuesAmount, session }
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: "School ID is required." });
    }
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: "A non-empty array of students is required." });
    }
    if (students.some(student => !student.studentId || student.pastDuesAmount === undefined || student.pastDuesAmount < 0 || !student.session)) {
      return res.status(400).json({
        success: false,
        message: "Each student must have a valid studentId, pastDuesAmount (>= 0), and session (e.g., '2025-2026').",
      });
    }

    const results = [];
    const errors = [];

    for (const { studentId, pastDuesAmount, session } of students) {
      try {
        const student = await NewStudentModel.findOne({ studentId, schoolId });
        if (!student) {
          errors.push({ studentId, message: "Student not found." });
          continue;
        }

        let feeStatus = await FeeStatus.findOne({ schoolId, studentId, session });
        if (!feeStatus) {
          feeStatus = new FeeStatus({
            schoolId,
            studentId,
            year: session.split("-")[0], // Extract year from session for backward compatibility
            session,
            pastDues: pastDuesAmount,
            dues: pastDuesAmount,
            monthlyDues: { regularDues: [], additionalDues: [] },
          });
        } else {
          const previousPastDues = feeStatus.pastDues || 0;
          feeStatus.pastDues = pastDuesAmount;
          feeStatus.dues = feeStatus.dues - previousPastDues + pastDuesAmount; // Adjust total dues
        }

        await feeStatus.save();
        results.push({
          studentId,
          success: true,
          message: "Past dues updated successfully.",
          data: feeStatus,
        });
      } catch (err) {
        errors.push({ studentId, message: err.message });
      }
    }

    if (errors.length > 0 && results.length === 0) {
      return res.status(400).json({ success: false, message: "Failed to process all past dues.", errors });
    }

    res.status(200).json({
      success: true,
      message: "Past dues processed successfully.",
      data: results,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to add past dues.",
      error: error.message,
    });
  }
};

// Fetch fees for a class
async function getFeesForClass(schoolId, className, studentId = null) {
  try {
    console.log(`Fetching fees for schoolId: ${schoolId}, className: ${className}, studentId: ${studentId}`);
    let fees;
    if (studentId) {
      fees = await FeeStructure.find({ schoolId, studentId });
      if (fees.length === 0) {
        fees = await FeeStructure.find({ schoolId, className, studentId: { $exists: false } });
      }
    } else {
      fees = await FeeStructure.find({ schoolId, className, studentId: { $exists: false } });
    }
    if (fees.length === 0) {
      const additionalMessage = studentId ? ` or student ${studentId}` : '';
      throw new Error(`No fee structure found for class ${className}${additionalMessage}`);
    }
    console.log(`Found fees: ${fees.length} entries`);
    return fees;
  } catch (error) {
    console.error('Error in getFeesForClass:', error.message);
    throw error;
  }
}


// Create or update fee payment
exports.createOrUpdateFeePayment = async (req, res) => {
  try {
    const { studentId, className, feeHistory, excludeLateFine = false, session } = req.body;
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: "School ID is required." });
    }
    if (!studentId || !session) {
      return res.status(400).json({ success: false, message: "Student ID and session (e.g., '2025-2026') are required." });
    }

    const student = await NewStudentModel.findOne({ schoolId, studentId }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const parent = student.parentId ? await ParentModel.findOne({ schoolId, parentId: student.parentId }).lean() : null;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const fees = await getFeesForClass(schoolId, className || student.class, studentId);

    const regularFeeMap = {};
    const additionalFeeMap = {};
    let lateFineFee = null;
    fees.forEach(fee => {
      if (fee.feeType === "LateFine" && fee.additional) {
        lateFineFee = fee;
      } else if (fee.additional) {
        additionalFeeMap[fee.name] = fee.amount || 0;
      } else {
        regularFeeMap[fee.feeType] = fee.amount || 0;
      }
    });

    let regularFees = feeHistory.regularFees || [];
    let additionalFees = feeHistory.additionalFees || [];
    const pastDuesPaid = feeHistory.pastDuesPaid || 0;

    let existingFeePayment = await FeeStatus.findOne({ schoolId, studentId, session });
    const pastDues = existingFeePayment ? existingFeePayment.pastDues || 0 : 0;
    const existingRegularFees = existingFeePayment ? existingFeePayment.monthlyDues.regularDues : [];
    const existingAdditionalFees = existingFeePayment ? existingFeePayment.monthlyDues.additionalDues : [];

    // Late fine logic
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    const currentMonth = months[currentDate.getMonth()];
    if (lateFineFee && !excludeLateFine && currentDay > lateFineFee.lateFineDueDay) {
      const unpaidRegularDues = existingRegularFees.some(fee => fee.month === currentMonth && fee.dueAmount > 0);
      if (!existingFeePayment || unpaidRegularDues) {
        const lateFineEntry = additionalFees.find(f => f.name === "Late Fine" && f.month === currentMonth) || {
          name: "Late Fine",
          month: currentMonth,
          paidAmount: 0,
          dueAmount: lateFineFee.amount,
          status: "Unpaid",
        };
        if (!additionalFees.some(f => f.name === "Late Fine" && f.month === currentMonth)) {
          additionalFees.push(lateFineEntry);
        }
        additionalFeeMap["Late Fine"] = lateFineFee.amount;
      }
    }

    const calculateFees = (entries, feeMap, isRegular) => {
      return entries.map(entry => {
        const feeAmount = feeMap[isRegular ? "Monthly" : entry.name] || 0;
        const previousPaidAmount = isRegular
          ? existingRegularFees.find(fee => fee.month === entry.month)?.paidAmount || 0
          : existingAdditionalFees.find(fee => fee.name === entry.name && fee.month === (entry.month || "N/A"))?.paidAmount || 0;
        const paidAmount = entry.paidAmount || 0;
        const totalAmountPaid = previousPaidAmount + paidAmount;

        if (totalAmountPaid > feeAmount) {
          throw new Error(`Payment for ${isRegular ? "regular" : "additional"} fee in ${entry.month || "N/A"} exceeds the fee amount (${feeAmount}).`);
        }

        const dueAmount = feeAmount - totalAmountPaid;
        const status = dueAmount <= 0 ? "Paid" : (totalAmountPaid > 0 ? "Partial Payment" : "Unpaid");

        return {
          ...(isRegular ? { month: entry.month } : { name: entry.name, month: entry.month || "N/A" }),
          dueAmount: dueAmount > 0 ? dueAmount : 0,
          paidAmount,
          status,
        };
      });
    };

    const updatedRegularFees = calculateFees(regularFees, regularFeeMap, true);
    const updatedAdditionalFees = calculateFees(additionalFees, additionalFeeMap, false);

    const totalPaidAmount = pastDuesPaid + updatedRegularFees.reduce((sum, fee) => sum + fee.paidAmount, 0) +
      updatedAdditionalFees.reduce((sum, fee) => sum + fee.paidAmount, 0);

    const totalRegularDues = updatedRegularFees.reduce((sum, fee) => sum + fee.dueAmount, 0);
    const totalAdditionalDues = updatedAdditionalFees.reduce((sum, fee) => sum + fee.dueAmount, 0);
    const remainingPastDues = Math.max(0, pastDues - pastDuesPaid);
    const totalDues = totalRegularDues + totalAdditionalDues + remainingPastDues;

    const feeReceiptNumber = await generateFeeReceiptNumber(schoolId);
    const newFeeHistory = {
      date: new Date(feeHistory.date || Date.now()),
      status: "active",
      regularFees: updatedRegularFees,
      additionalFees: updatedAdditionalFees,
      pastDuesPaid,
      feeReceiptNumber,
      paymentMode: feeHistory.paymentMode || "N/A",
      transactionId: feeHistory.transactionId || "N/A",
      totalFeeAmount: feeHistory.totalFeeAmount || (Object.values(regularFeeMap).reduce((a, b) => a + b, 0) + Object.values(additionalFeeMap).reduce((a, b) => a + b, 0)),
      previousDues: pastDues,
      remark: feeHistory.remark || "",
      concessionFee: feeHistory.concessionFee || 0,
      paidAfterConcession: feeHistory.paidAfterConcession || 0,
      newPaidAmount: feeHistory.newPaidAmount || 0,
      totalAmountPaid: totalPaidAmount,
      totalDues, // Fixed: Now calculated correctly
    };

    let responseData;
    if (existingFeePayment) {
      existingFeePayment.feeHistory.push(newFeeHistory);

      updatedRegularFees.forEach(entry => {
        let regularDue = existingFeePayment.monthlyDues.regularDues.find(due => due.month === entry.month);
        if (regularDue) {
          regularDue.dueAmount = entry.dueAmount;
          regularDue.paidAmount = (regularDue.paidAmount || 0) + entry.paidAmount;
          regularDue.status = entry.status;
        } else {
          existingFeePayment.monthlyDues.regularDues.push(entry);
        }
      });

      updatedAdditionalFees.forEach(entry => {
        let additionalDue = existingFeePayment.monthlyDues.additionalDues.find(due => due.name === entry.name && due.month === entry.month);
        if (additionalDue) {
          additionalDue.dueAmount = entry.dueAmount;
          additionalDue.paidAmount = (additionalDue.paidAmount || 0) + entry.paidAmount;
          additionalDue.status = entry.status;
        } else {
          existingFeePayment.monthlyDues.additionalDues.push(entry);
        }
      });

      const activeFeeHistory = existingFeePayment.feeHistory.filter(fee => fee.status === "active");
      existingFeePayment.pastDues = Math.max(0, pastDues - activeFeeHistory.reduce((sum, fee) => sum + (fee.pastDuesPaid || 0), 0));
      existingFeePayment.dues = existingFeePayment.monthlyDues.regularDues.reduce((sum, due) => sum + due.dueAmount, 0) +
        existingFeePayment.monthlyDues.additionalDues.reduce((sum, due) => sum + due.dueAmount, 0) + existingFeePayment.pastDues;

      const updatedFeePayment = await existingFeePayment.save();
      responseData = {
        feeReceiptNumber,
        feeStatus: updatedFeePayment.toObject(),
        studentDetails: { ...student, parentContact: parent?.contact || null },
        parentDetails: parent ? { fullName: `${parent.fatherName} & ${parent.motherName || ''}`, contact: parent.contact, email: parent.email } : null,
      };
    } else {
      const newFeePayment = new FeeStatus({
        schoolId,
        studentId,
        year: session.split("-")[0],
        session,
        dues: totalDues,
        pastDues: remainingPastDues,
        feeHistory: [newFeeHistory],
        monthlyDues: {
          regularDues: updatedRegularFees,
          additionalDues: updatedAdditionalFees,
        },
      });

      const savedFeePayment = await newFeePayment.save();
      responseData = {
        feeReceiptNumber,
        feeStatus: savedFeePayment.toObject(),
        studentDetails: { ...student, parentContact: parent?.contact || null },
        parentDetails: parent ? { fullName: `${parent.fatherName} & ${parent.motherName || ''}`, contact: parent.contact, email: parent.email } : null,
      };
    }

    res.status(201).json({
      success: true,
      message: "Fee Status is Saved Successfully",
      data: responseData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Fee Status is not created Successfully",
      error: error.message,
    });
  }
};

// Get fee status (updated to exclude canceled fees in calculations)
exports.getFeeStatus = async (req, res) => {
  try {
    const { studentId, session } = req.query;
    let filter = {
      ...(studentId ? { studentId } : {}),
      ...(session ? { session } : {}),
      schoolId: req.user.schoolId,
    };

    const feesData = await FeeStatus.find(filter).lean();
    if (feesData.length === 0) {
      return res.status(404).json({ success: false, message: "No fee status found for the provided filter", data: [] });
    }

    const detailedFeeStatus = await Promise.all(feesData.map(async feeStatus => {
      const student = await NewStudentModel.findOne({ schoolId: req.user.schoolId, studentId: feeStatus.studentId }).lean();
      const parent = student?.parentId ? await ParentModel.findOne({ schoolId: req.user.schoolId, parentId: student.parentId }).lean() : null;

      const activeFeeHistory = feeStatus.feeHistory.filter(fee => fee.status === "active");
      const totalPastDuesPaid = activeFeeHistory.reduce((sum, fee) => sum + (fee.pastDuesPaid || 0), 0);
      const calculatedDues = feeStatus.monthlyDues.regularDues.reduce((sum, due) => sum + due.dueAmount, 0) +
        feeStatus.monthlyDues.additionalDues.reduce((sum, due) => sum + due.dueAmount, 0) + Math.max(0, feeStatus.pastDues - totalPastDuesPaid);

      return {
        ...feeStatus,
        dues: calculatedDues,
        student: student ? { ...student, parentContact: parent?.contact || null } : null,
      };
    }));

    res.status(200).json({
      success: true,
      message: "Fee Status Data Retrieved Successfully",
      data: detailedFeeStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve fee status",
      error: error.message,
    });
  }
};


// New endpoint to cancel a fee payment
exports.cancelFeePayment = async (req, res) => {
  try {
    const { studentId, feeReceiptNumber } = req.body;
    const schoolId = req.user.schoolId;

    console.log('cancelFeePayment called with:', { studentId, feeReceiptNumber, schoolId });

    if (!schoolId) {
      return res.status(400).json({ success: false, message: "School ID is required." });
    }
    if (!studentId || !feeReceiptNumber) {
      return res.status(400).json({ success: false, message: "Student ID and Fee Receipt Number are required." });
    }

    const feeStatus = await FeeStatus.findOne({ schoolId, studentId });
    if (!feeStatus) {
      return res.status(404).json({ success: false, message: "Fee status not found for this student." });
    }

    const feeToCancel = feeStatus.feeHistory.find(fee => fee.feeReceiptNumber === feeReceiptNumber);
    if (!feeToCancel) {
      return res.status(404).json({ success: false, message: "Fee receipt number not found." });
    }
    if (feeToCancel.status === "canceled") {
      return res.status(400).json({ success: false, message: "Fee is already canceled." });
    }

    // Mark the fee as canceled
    feeToCancel.status = "canceled";

    // Reverse the effects of this fee on monthlyDues
    feeToCancel.regularFees.forEach(canceledFee => {
      const regularDue = feeStatus.monthlyDues.regularDues.find(due => due.month === canceledFee.month);
      if (regularDue) {
        regularDue.paidAmount = Math.max(0, (regularDue.paidAmount || 0) - canceledFee.paidAmount);
        regularDue.dueAmount += canceledFee.paidAmount; // Revert paid amount to dues
        regularDue.status = regularDue.dueAmount > 0 ? (regularDue.paidAmount > 0 ? "Partial Payment" : "Unpaid") : "Paid";
      }
    });

    feeToCancel.additionalFees.forEach(canceledFee => {
      const additionalDue = feeStatus.monthlyDues.additionalDues.find(due => due.name === canceledFee.name && due.month === (canceledFee.month || "N/A"));
      if (additionalDue) {
        additionalDue.paidAmount = Math.max(0, (additionalDue.paidAmount || 0) - canceledFee.paidAmount);
        additionalDue.dueAmount += canceledFee.paidAmount; // Revert paid amount to dues
        additionalDue.status = additionalDue.dueAmount > 0 ? (additionalDue.paidAmount > 0 ? "Partial Payment" : "Unpaid") : "Paid";
      }
    });

    // Recalculate pastDues and total dues based only on active fees
    const activeFeeHistory = feeStatus.feeHistory.filter(fee => fee.status === "active");
    const totalPastDuesPaid = activeFeeHistory.reduce((sum, fee) => sum + (fee.pastDuesPaid || 0), 0);
    feeStatus.pastDues = Math.max(0, feeStatus.pastDues - totalPastDuesPaid + feeToCancel.pastDuesPaid);

    const totalRegularDues = feeStatus.monthlyDues.regularDues.reduce((sum, due) => sum + due.dueAmount, 0);
    const totalAdditionalDues = feeStatus.monthlyDues.additionalDues.reduce((sum, due) => sum + due.dueAmount, 0);
    feeStatus.dues = totalRegularDues + totalAdditionalDues + feeStatus.pastDues;

    const updatedFeeStatus = await feeStatus.save();
    console.log(`Fee ${feeReceiptNumber} canceled successfully`);

    res.status(200).json({
      success: true,
      message: "Fee payment canceled successfully",
      data: updatedFeeStatus.toObject(),
    });
  } catch (error) {
    console.error('Error in cancelFeePayment:', error.message);
    res.status(500).json({
      success: false,
      message: "Failed to cancel fee payment",
      error: error.message,
    });
  }
};

// Get fee status by month
exports.getFeeStatusByMonth = async (req, res) => {
  try {
    const { studentId, month } = req.query;
    const schoolId = req.user.schoolId;

    let filter = { ...(studentId ? { studentId } : {}), schoolId };
    const feesData = await FeeStatus.find(filter).lean();

    if (feesData.length === 0) {
      return res.status(404).json({ success: false, message: "No fee status found.", data: [] });
    }

    const student = await NewStudentModel.findOne({ schoolId, studentId }).lean();
    const joiningMonthIndex = student ? new Date(student.joiningDate).getMonth() : 0;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = months.indexOf(month);

    const studentDetailsPromises = feesData.map(async feeStatus => {
      const parent = student?.parentId
        ? await ParentModel.findOne({ schoolId, parentId: student.parentId }).lean()
        : null;

      const monthlyRegularFees = feeStatus.monthlyDues.regularDues.filter(fee => fee.month === month);
      const monthlyAdditionalFees = feeStatus.monthlyDues.additionalDues.filter(fee => fee.month === month);

      let totalRegularDues = 0, totalRegularPaid = 0, totalAdditionalDues = 0, totalAdditionalPaid = 0;
      monthlyRegularFees.forEach(fee => {
        totalRegularDues += fee.dueAmount;
        totalRegularPaid += fee.paidAmount;
      });
      monthlyAdditionalFees.forEach(fee => {
        totalAdditionalDues += fee.dueAmount;
        totalAdditionalPaid += fee.paidAmount;
      });

      let status = monthIndex < joiningMonthIndex ? "Not Applicable" : "Paid";
      const totalDues = totalRegularDues + totalAdditionalDues + (month === "January" ? feeStatus.pastDues : 0);
      const totalPaid = totalRegularPaid + totalAdditionalPaid;

      if (totalDues > 0) {
        status = totalPaid > 0 ? "Partial Payment" : "Unpaid";
      }

      return {
        ...feeStatus,
        student: student ? { ...student, parentContact: parent?.contact || null } : null,
        month,
        monthlyFees: { regularFees: monthlyRegularFees, additionalFees: monthlyAdditionalFees },
        totalRegularDues,
        totalRegularPaid,
        totalAdditionalDues,
        totalAdditionalPaid,
        totalDues,
        totalPaid,
        status,
      };
    });

    const detailedFeeStatus = await Promise.all(studentDetailsPromises);

    res.status(200).json({
      success: true,
      message: "Monthly Fee Status Data Retrieved Successfully",
      data: detailedFeeStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve monthly fee status",
      error: error.message,
    });
  }
};

// Fee income by months
exports.feeIncomeMonths = async (req, res) => {
  try {
    const feesData = await FeeStatus.find({ schoolId: req.user.schoolId });
    let arr = new Array(12).fill(0);

    const monthToIndex = {
      'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
      'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
    };

    for (const feeStatus of feesData) {
      for (const feeHistoryEntry of feeStatus.feeHistory) {
        const date = new Date(feeHistoryEntry.date);
        const monthName = date.toLocaleString('en-US', { month: 'long' });
        const monthIndex = monthToIndex[monthName];
        if (monthIndex !== undefined) {
          arr[monthIndex] += Number(feeHistoryEntry.totalAmountPaid) || 0;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Fees Data Successfully Retrieved",
      data: arr,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving fee income data by month",
      error: error.message,
    });
  }
};

// Get fee history
exports.getFeeHistory = async (req, res) => {
  try {
    const { studentId } = req.query;
    let filter = {
      schoolId: req.user.schoolId,
      ...(studentId ? { studentId } : {}),
    };

    const feeStatusData = await FeeStatus.find(filter).exec();
    let feeHistory = [];

    for (const feeStatus of feeStatusData) {
      const studentData = await NewStudentModel.findOne({ studentId: feeStatus.studentId }, 'studentName class studentId parentId').exec();
      const parent = studentData?.parentId
        ? await ParentModel.findOne({ schoolId: req.user.schoolId, parentId: studentData.parentId }).lean()
        : null;

      if (studentData) {
        feeStatus.feeHistory.forEach(history => {
          feeHistory.push({
            studentId: studentData.studentId,
            studentName: studentData.studentName,
            studentClass: studentData.class,
            parentContact: parent?.contact || null,
            feeReceiptNumber: history.feeReceiptNumber,
            paymentMode: history.paymentMode,
            dues: history.regularFees.reduce((sum, fee) => sum + fee.dueAmount, 0) +
                  history.additionalFees.reduce((sum, fee) => sum + fee.dueAmount, 0),
            ...history._doc,
          });
        });
      }
    }

    feeHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      message: "Fee history retrieved successfully",
      data: feeHistory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve fee history",
      error: error.message,
    });
  }
};

// Edit fee status
exports.editFeeStatus = async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    const updateData = req.body;

    const feeStatus = await FeeStatus.findOneAndUpdate(
      { "feeHistory.feeReceiptNumber": receiptNumber },
      { $set: { "feeHistory.$": updateData } },
      { new: true }
    );

    if (!feeStatus) {
      return res.status(404).json({ success: false, message: "Fee status not found" });
    }

    res.status(200).json({
      success: true,
      message: "Fee status updated successfully",
      data: feeStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update fee status due to an error.",
      error: error.message,
    });
  }
};

// Delete fee status
exports.deleteFeeStatus = async (req, res) => {
  try {
    const { receiptNumber } = req.params;

    const feeStatus = await FeeStatus.findOneAndUpdate(
      { "feeHistory.feeReceiptNumber": receiptNumber },
      { $pull: { feeHistory: { feeReceiptNumber: receiptNumber } } },
      { new: true }
    );

    if (!feeStatus) {
      return res.status(404).json({ success: false, message: "Fee status not found" });
    }

    res.status(200).json({
      success: true,
      message: "Fee status deleted successfully",
      data: feeStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete fee status due to an error.",
      error: error.message,
    });
  }
};

// Get all students' fee status
exports.getAllStudentsFeeStatus = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const students = await NewStudentModel.find({ schoolId }).lean();

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: "No students found for this school", data: [] });
    }

    const feeStatuses = await FeeStatus.find({ schoolId }).lean();
    const feeStatusMap = feeStatuses.reduce((map, feeStatus) => {
      map[feeStatus.studentId] = feeStatus;
      return map;
    }, {});

    const studentsWithFeeStatusPromises = students.map(async student => {
      const feeStatus = feeStatusMap[student.studentId];
      const parent = student.parentId
        ? await ParentModel.findOne({ schoolId, parentId: student.parentId }).lean()
        : null;

      let overallStatus = "Unpaid";
      let totalDues = 0;

      if (feeStatus) {
        totalDues = feeStatus.dues || 0;
        overallStatus = totalDues === 0 ? "Paid" : "Partial";
      }

      return {
        ...student,
        parentContact: parent?.contact || null,
        feeStatus: overallStatus,
        totalDues,
      };
    });

    const studentsWithFeeStatus = await Promise.all(studentsWithFeeStatusPromises);

    res.status(200).json({
      success: true,
      message: "Student Fee Status Data Retrieved Successfully",
      data: studentsWithFeeStatus,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve student fee status data",
      error: error.message,
    });
  }
};

// Get student fee history
exports.getStudentFeeHistory = async (req, res) => {
  try {
    const { studentId } = req.query;
    const schoolId = req.user.schoolId;

    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID is required" });
    }

    const feeStatus = await FeeStatus.findOne({ studentId, schoolId }).lean();
    if (!feeStatus) {
      return res.status(404).json({ success: false, message: "No fee status found for this student" });
    }

    const student = await NewStudentModel.findOne({ studentId, schoolId }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: "No student found with the provided student ID" });
    }

    const parent = student.parentId
      ? await ParentModel.findOne({ schoolId, parentId: student.parentId }).lean()
      : null;

    res.status(200).json({
      success: true,
      message: "Student fee history and dues retrieved successfully",
      data: {
        studentDetails: { ...student, parentContact: parent?.contact || null },
        feeHistory: feeStatus.feeHistory,
        monthlyDues: feeStatus.monthlyDues,
        totalDues: feeStatus.dues,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving fee history",
      error: error.message,
    });
  }
};

// Get fee history and dues
exports.getFeeHistoryAndDues = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID is required" });
    }

    const feeStatusData = await FeeStatus.findOne({ studentId, schoolId: req.user.schoolId }).lean();
    if (!feeStatusData) {
      return res.status(404).json({ success: false, message: "No fee status found for the provided student ID" });
    }

    const student = await NewStudentModel.findOne({ schoolId: req.user.schoolId, studentId }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: "No student found with the provided student ID" });
    }

    const parent = student.parentId
      ? await ParentModel.findOne({ schoolId: req.user.schoolId, parentId: student.parentId }).lean()
      : null;

    const responseData = {
      student: { ...student, parentContact: parent?.contact || null },
      feeStatus: feeStatusData,
    };

    res.status(200).json({
      success: true,
      message: "Fee history and dues retrieved successfully",
      data: responseData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve fee history and dues",
      error: error.message,
    });
  }
};