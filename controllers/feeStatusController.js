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
    const { studentId, pastDuesAmount, students, year } = req.body;
    const schoolId = req.user.schoolId;

    console.log('addPastDues called with:', { studentId, pastDuesAmount, students, year, schoolId });

    if (!schoolId) {
      return res.status(400).json({ success: false, message: "School ID is required." });
    }
    if (!studentId && (!students || !Array.isArray(students) || students.length === 0)) {
      return res.status(400).json({ success: false, message: "Either studentId or a non-empty students array is required." });
    }
    if (studentId && (pastDuesAmount === undefined || pastDuesAmount < 0)) {
      return res.status(400).json({ success: false, message: "Valid past dues amount is required for single student." });
    }
    if (students && students.some(student => !student.studentId || student.pastDuesAmount === undefined || student.pastDuesAmount < 0)) {
      return res.status(400).json({ success: false, message: "Each student must have a valid studentId and pastDuesAmount (>= 0)." });
    }
    if (!year) {
      return res.status(400).json({ success: false, message: "Year is required." });
    }

    let targetStudents = studentId ? [{ studentId, pastDuesAmount }] : students;
    const results = [];
    const errors = [];

    for (const { studentId: stuId, pastDuesAmount: duesAmount } of targetStudents) {
      try {
        console.log(`Processing studentId: ${stuId}`);
        const student = await NewStudentModel.findOne({ studentId: stuId, schoolId });
        if (!student) {
          errors.push({ studentId: stuId, message: "Student not found." });
          continue;
        }

        let feeStatus = await FeeStatus.findOne({ schoolId, studentId: stuId, year });
        if (!feeStatus) {
          feeStatus = new FeeStatus({
            schoolId,
            studentId: stuId,
            year,
            pastDues: duesAmount,
            dues: duesAmount,
            monthlyDues: { regularDues: [], additionalDues: [] },
            session: "2023-2024", // Assuming a default session; adjust as needed
          });
        } else {
          feeStatus.pastDues = duesAmount;
          feeStatus.dues = feeStatus.dues - (feeStatus.pastDues || 0) + duesAmount;
        }

        await feeStatus.save();
        results.push({
          studentId: stuId,
          success: true,
          message: "Past dues added/updated successfully.",
          data: feeStatus,
        });
      } catch (err) {
        errors.push({ studentId: stuId, message: err.message });
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
    throw new Error(`Failed to fetch fees: ${error.message}`);
  }
}

// Create or update fee payment
exports.createOrUpdateFeePayment = async (req, res) => {
  try {
    const { studentId, className, feeHistory } = req.body;
    const schoolId = req.user.schoolId;
    const year = new Date().getFullYear().toString();

    console.log('createOrUpdateFeePayment called with:', { studentId, className, feeHistory, schoolId });

    if (!schoolId) {
      return res.status(400).json({ success: false, message: "School ID is required." });
    }
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID is required." });
    }

    const student = await NewStudentModel.findOne({ schoolId, studentId }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }
    console.log(`Student found: ${student.studentName}`);

    const parent = student.parentId
      ? await ParentModel.findOne({ schoolId, parentId: student.parentId }).lean()
      : null;
    const joiningMonthIndex = new Date(student.joiningDate).getMonth();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const fees = await getFeesForClass(schoolId, className, studentId);
    const regularFeeMap = {};
    const additionalFeeMap = {};
    fees.forEach(fee => {
      if (fee.additional) {
        additionalFeeMap[fee.name] = fee.amount || 0;
      } else {
        regularFeeMap[fee.feeType] = fee.amount || 0;
      }
    });

    const regularFees = feeHistory.regularFees || [];
    const additionalFees = feeHistory.additionalFees || [];
    const pastDuesPaid = feeHistory.pastDuesPaid || 0;

    let existingFeePayment = await FeeStatus.findOne({ schoolId, studentId, year });
    const pastDues = existingFeePayment ? existingFeePayment.pastDues || 0 : 0;
    const existingRegularFees = existingFeePayment ? existingFeePayment.monthlyDues.regularDues : [];
    const existingAdditionalFees = existingFeePayment ? existingFeePayment.monthlyDues.additionalDues : [];

    let totalPaidAmount = pastDuesPaid;
    regularFees.forEach(entry => totalPaidAmount += entry.paidAmount || 0);
    additionalFees.forEach(entry => totalPaidAmount += entry.paidAmount || 0);

    const calculateFees = (entries, feeMap, isRegular) => {
      return entries.map(entry => {
        const monthIndex = months.indexOf(entry.month);
        if (isRegular && monthIndex < joiningMonthIndex) {
          return {
            month: entry.month,
            dueAmount: 0,
            paidAmount: 0,
            status: "Not Applicable",
          };
        }

        const feeAmount = feeMap[isRegular ? "Monthly" : entry.name] || 0;
        const previousPaidAmount = isRegular
          ? existingRegularFees.find(fee => fee.month === entry.month)?.paidAmount || 0
          : existingAdditionalFees.find(fee => fee.name === entry.name && fee.month === (entry.month || "N/A"))?.paidAmount || 0;
        const paidAmount = entry.paidAmount || 0;
        const totalAmountPaid = previousPaidAmount + paidAmount;

        if (totalAmountPaid > feeAmount) {
          throw new Error(`Payment for ${isRegular ? "regular" : "additional"} fee in ${entry.month || "N/A"} exceeds the remaining dues.`);
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

    const date = new Date(feeHistory.date || new Date());
    const formattedDate = date.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
    const feeReceiptNumber = await generateFeeReceiptNumber(schoolId);

    const newFeeHistory = {
      date: formattedDate,
      status: totalPaidAmount > 0 ? (pastDuesPaid + regularFees.length + additionalFees.length > 0 ? "Partial Payment" : "Paid") : "Unpaid",
      regularFees: updatedRegularFees,
      additionalFees: updatedAdditionalFees,
      pastDuesPaid,
      feeReceiptNumber,
      paymentMode: feeHistory.paymentMode || "N/A",
      transactionId: feeHistory.transactionId || "N/A",
      totalFeeAmount: feeHistory.totalFeeAmount || 0,
      previousDues: pastDues,
      remark: feeHistory.remark || "",
      concessionFee: feeHistory.concessionFee || 0,
      paidAfterConcession: feeHistory.paidAfterConcession || 0,
      newPaidAmount: feeHistory.newPaidAmount || 0,
      totalAmountPaid: totalPaidAmount,
      totalDues: null,
    };

    let responseData;

    if (existingFeePayment) {
      console.log('Updating existing fee payment');
      existingFeePayment.feeHistory.push(newFeeHistory);

      updatedRegularFees.forEach(entry => {
        let regularDue = existingFeePayment.monthlyDues.regularDues.find(due => due.month === entry.month);
        if (regularDue) {
          regularDue.dueAmount = entry.dueAmount;
          regularDue.paidAmount = (regularDue.paidAmount || 0) + entry.paidAmount;
          regularDue.status = entry.status;
        } else if (months.indexOf(entry.month) >= joiningMonthIndex) {
          existingFeePayment.monthlyDues.regularDues.push({
            month: entry.month,
            dueAmount: entry.dueAmount,
            paidAmount: entry.paidAmount,
            status: entry.status,
          });
        }
      });

      updatedAdditionalFees.forEach(entry => {
        let additionalDue = existingFeePayment.monthlyDues.additionalDues.find(due => due.name === entry.name && due.month === (entry.month || "N/A"));
        if (additionalDue) {
          additionalDue.dueAmount = entry.dueAmount;
          additionalDue.paidAmount = (additionalDue.paidAmount || 0) + entry.paidAmount;
          additionalDue.status = entry.status;
        } else {
          existingFeePayment.monthlyDues.additionalDues.push({
            name: entry.name,
            month: entry.month || "N/A",
            dueAmount: entry.dueAmount,
            paidAmount: entry.paidAmount,
            status: entry.status,
          });
        }
      });

      const remainingPastDues = Math.max(0, pastDues - pastDuesPaid);
      existingFeePayment.pastDues = remainingPastDues;

      const totalRegularDues = existingFeePayment.monthlyDues.regularDues.reduce((sum, due) => sum + due.dueAmount, 0);
      const totalAdditionalDues = existingFeePayment.monthlyDues.additionalDues.reduce((sum, due) => sum + due.dueAmount, 0);
      existingFeePayment.dues = totalRegularDues + totalAdditionalDues + remainingPastDues;

      const updatedFeePayment = await existingFeePayment.save();
      console.log('Fee payment updated successfully');
      responseData = {
        feeReceiptNumber,
        feeStatus: updatedFeePayment.toObject(),
        studentDetails: {
          fullName: student.studentName,
          studentId: student.studentId,
          class: student.class,
          contact: student.contact,
          joiningDate: student.joiningDate,
        },
        parentDetails: parent
          ? {
              fullName: `${parent.fatherName} & ${parent.motherName || ''}`,
              contact: parent.contact,
              email: parent.email,
            }
          : null,
      };
      res.status(201).json({
        success: true,
        message: "Fee Status is Saved Successfully",
        data: responseData,
      });
    } else {
      console.log('Creating new fee payment');
      const initialRegularDues = months.slice(joiningMonthIndex).map(month => ({
        month,
        dueAmount: regularFeeMap["Monthly"] || 0,
        paidAmount: 0,
        status: "Unpaid",
      }));

      updatedRegularFees.forEach(entry => {
        const due = initialRegularDues.find(d => d.month === entry.month);
        if (due) {
          due.dueAmount = entry.dueAmount;
          due.paidAmount = entry.paidAmount;
          due.status = entry.status;
        }
      });

      const totalRegularDues = initialRegularDues.reduce((sum, due) => sum + due.dueAmount, 0);
      const totalAdditionalDues = updatedAdditionalFees.reduce((sum, due) => sum + due.dueAmount, 0);
      const remainingPastDues = Math.max(0, pastDues - pastDuesPaid);
      const totalDues = totalRegularDues + totalAdditionalDues + remainingPastDues;

      const newFeePayment = new FeeStatus({
        schoolId,
        studentId,
        year,
        dues: totalDues,
        pastDues: remainingPastDues,
        feeHistory: [newFeeHistory],
        monthlyDues: {
          regularDues: initialRegularDues,
          additionalDues: updatedAdditionalFees.map(entry => ({
            name: entry.name,
            month: entry.month || "N/A",
            dueAmount: entry.dueAmount,
            paidAmount: entry.paidAmount,
            status: entry.status,
          })),
        },
        session: "2023-2024", // Assuming a default session; adjust as needed
      });

      const savedFeePayment = await newFeePayment.save();
      console.log('Fee payment saved successfully');
      responseData = {
        feeReceiptNumber,
        feeStatus: savedFeePayment.toObject(),
        studentDetails: {
          fullName: student.studentName,
          studentId: student.studentId,
          class: student.class,
          contact: student.contact,
          joiningDate: student.joiningDate,
        },
        parentDetails: parent
          ? {
              fullName: `${parent.fatherName} & ${parent.motherName || ''}`,
              contact: parent.contact,
              email: parent.email,
            }
          : null,
      };
      res.status(201).json({
        success: true,
        message: "Fee Status is Saved Successfully",
        data: responseData,
      });
    }
  } catch (error) {
    console.error('Error in createOrUpdateFeePayment:', error);
    res.status(400).json({
      success: false,
      message: "Fee Status is not created Successfully",
      error: error.message,
    });
  }
};

// Get fee status
exports.getFeeStatus = async (req, res) => {
  try {
    const { studentId } = req.query;
    let filter = {
      ...(studentId ? { studentId } : {}),
      schoolId: req.user.schoolId,
    };

    console.log('getFeeStatus called with filter:', filter);
    const feesData = await FeeStatus.find(filter).lean();
    if (feesData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No fee status found for the provided filter",
        data: [],
      });
    }

    const studentDetailsPromises = feesData.map(async feeStatus => {
      const student = await NewStudentModel.findOne({ schoolId: req.user.schoolId, studentId: feeStatus.studentId }).lean();
      const parent = student?.parentId
        ? await ParentModel.findOne({ schoolId: req.user.schoolId, parentId: student.parentId }).lean()
        : null;

      return {
        ...feeStatus,
        student: student ? { ...student, parentContact: parent?.contact || null } : null,
      };
    });

    const detailedFeeStatus = await Promise.all(studentDetailsPromises);
    console.log('Fee status retrieved successfully');

    res.status(200).json({
      success: true,
      message: "Fee Status Data Retrieved Successfully",
      data: detailedFeeStatus,
    });
  } catch (error) {
    console.error('Error in getFeeStatus:', error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve fee status",
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