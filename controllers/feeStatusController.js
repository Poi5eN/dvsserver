// ABOVE CODE WORKING WELL TO REVERT
const mongoose = require('mongoose');
const NewStudentModel = require("../models/newStudentModel");
const FeeStatus = require("../models/feeStatus");
const FeeStructure = require("../models/feeStructureModel");
const ParentModel = require('../models/parentModel');
const { generateStructuredNumber } = require('../utils/numberGenerator'); // Adjust path as needed

// Helper function to generate a structured fee receipt number (e.g., DI1000)
const generateFeeReceiptNumber = async (schoolId) => {
  return generateStructuredNumber(schoolId, FeeStatus, 'feeHistory.feeReceiptNumber');
};



exports.addPastDues = async (req, res) => {
  try {
    const { admissionNumber, pastDuesAmount, students, year } = req.body;
    const schoolId = req.user.schoolId;

    // Validation
    if (!schoolId) {
      return res.status(400).json({ success: false, message: "School ID is required." });
    }
    if (!admissionNumber && (!students || !Array.isArray(students) || students.length === 0)) {
      return res.status(400).json({ success: false, message: "Either admissionNumber or a non-empty students array is required." });
    }
    if (admissionNumber && (pastDuesAmount === undefined || pastDuesAmount < 0)) {
      return res.status(400).json({ success: false, message: "Valid past dues amount is required for single student." });
    }
    if (students && students.some(student => !student.admissionNumber || student.pastDuesAmount === undefined || student.pastDuesAmount < 0)) {
      return res.status(400).json({ success: false, message: "Each student in the array must have a valid admissionNumber and pastDuesAmount (>= 0)." });
    }
    if (!year) {
      return res.status(400).json({ success: false, message: "Year is required." });
    }

    // Prepare the list of students to process
    let targetStudents = [];
    if (admissionNumber) {
      targetStudents.push({ admissionNumber, pastDuesAmount });
    } else {
      targetStudents = students;
    }

    const results = [];
    const errors = [];

    for (const { admissionNumber: admNo, pastDuesAmount: duesAmount } of targetStudents) {
      try {
        // Check if student exists
        const student = await NewStudentModel.findOne({ admissionNumber: admNo, schoolId });
        if (!student) {
          errors.push({ admissionNumber: admNo, message: "Student not found." });
          continue;
        }

        // Find or create fee status
        let feeStatus = await FeeStatus.findOne({ schoolId, admissionNumber: admNo, year });
        if (!feeStatus) {
          feeStatus = new FeeStatus({
            schoolId,
            admissionNumber: admNo,
            year,
            pastDues: duesAmount,
            dues: duesAmount, // Initial dues include past dues
            monthlyDues: { regularDues: [], additionalDues: [] },
          });
        } else {
          feeStatus.pastDues = duesAmount;
          feeStatus.dues = feeStatus.dues - (feeStatus.pastDues || 0) + duesAmount; // Adjust total dues
        }

        await feeStatus.save();
        results.push({
          admissionNumber: admNo,
          success: true,
          message: "Past dues added/updated successfully.",
          data: feeStatus,
        });
      } catch (err) {
        errors.push({ admissionNumber: admNo, message: err.message });
      }
    }

    // Respond with results and any errors
    if (errors.length > 0 && results.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Failed to process all past dues.",
        errors,
      });
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

// Helper function to fetch fees for a class
async function getFeesForClass(schoolId, className, admissionNumber = null) {
    try {
      let fees;
  
      // If admissionNumber is provided, prioritize student-specific fees
      if (admissionNumber) {
        fees = await FeeStructure.find({
          schoolId,
          admissionNumber,
        });
  
        // If no student-specific fees are found, fall back to class-based fees
        if (fees.length === 0) {
          fees = await FeeStructure.find({
            schoolId,
            className,
            admissionNumber: { $exists: false }, // Only class-wide fees
          });
        }
      } else {
        // Fetch class-wide fees only
        fees = await FeeStructure.find({
          schoolId,
          className,
          admissionNumber: { $exists: false },
        });
      }
  
      if (fees.length === 0) {
        const additionalMessage = admissionNumber ? ` or student ${admissionNumber}` : '';
        throw new Error(`No fee structure found for class ${className}${additionalMessage}`);
      }
  
      return fees;
    } catch (error) {
      throw new Error(`Failed to fetch fees: ${error.message}`);
    }
  }

// Controller to create or update fee payment
// Controller to create or update fee payment
exports.createOrUpdateFeePayment = async (req, res) => {
  try {
    const { admissionNumber, className, feeHistory } = req.body;
    const schoolId = req.user.schoolId;
    const year = new Date().getFullYear().toString();

    // Validate inputs
    if (!schoolId) {
      return res.status(400).json({ success: false, message: "School ID is required." });
    }
    if (!admissionNumber) {
      return res.status(400).json({ success: false, message: "Admission number is required." });
    }

    // Fetch student and parent details
    const student = await NewStudentModel.findOne({ schoolId, admissionNumber }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }
    const parent = student.parentId
      ? await ParentModel.findOne({ schoolId, _id: student.parentId }).lean()
      : null;
    const joiningMonthIndex = new Date(student.joiningDate).getMonth();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Fetch fees
    const fees = await getFeesForClass(schoolId, className, admissionNumber);
    const regularFeeMap = {};
    const additionalFeeMap = {};
    fees.forEach(fee => {
      if (fee.additional) {
        additionalFeeMap[fee.name] = fee.amount || 0;
      } else {
        regularFeeMap[fee.feeType] = fee.amount || 0;
      }
    });

    // Extract payment details
    const regularFees = feeHistory.regularFees || [];
    const additionalFees = feeHistory.additionalFees || [];
    const pastDuesPaid = feeHistory.pastDuesPaid || 0;

    // Fetch existing fee payment record
    let existingFeePayment = await FeeStatus.findOne({ schoolId, admissionNumber, year });
    const pastDues = existingFeePayment ? existingFeePayment.pastDues || 0 : 0;
    const existingRegularFees = existingFeePayment ? existingFeePayment.monthlyDues.regularDues : [];
    const existingAdditionalFees = existingFeePayment ? existingFeePayment.monthlyDues.additionalDues : [];

    // Calculate total paid amount for this transaction
    let totalPaidAmount = pastDuesPaid;
    regularFees.forEach(entry => totalPaidAmount += entry.paidAmount || 0);
    additionalFees.forEach(entry => totalPaidAmount += entry.paidAmount || 0);

    // Function to handle fee calculation and validation
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

    // Format the date and generate unique fee receipt number
    const date = new Date(feeHistory.date || new Date());
    const formattedDate = date.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
    const feeReceiptNumber = await generateFeeReceiptNumber(schoolId);

    // Create new fee history entry
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
      totalDues: null, // Will be set in FeeStatus.dues
    };

    let responseData;

    if (existingFeePayment) {
      existingFeePayment.feeHistory.push(newFeeHistory);

      // Update monthly dues for regular fees
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

      // Update monthly dues for additional fees
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

      // Update past dues
      const remainingPastDues = Math.max(0, pastDues - pastDuesPaid);
      existingFeePayment.pastDues = remainingPastDues;

      // Calculate total dues
      const totalRegularDues = existingFeePayment.monthlyDues.regularDues.reduce((sum, due) => sum + due.dueAmount, 0);
      const totalAdditionalDues = existingFeePayment.monthlyDues.additionalDues.reduce((sum, due) => sum + due.dueAmount, 0);
      existingFeePayment.dues = totalRegularDues + totalAdditionalDues + remainingPastDues;

      const updatedFeePayment = await existingFeePayment.save();
      responseData = {
        feeReceiptNumber, // Explicitly include the generated receipt number
        feeStatus: updatedFeePayment.toObject(), // Convert to plain object to ensure all fields are visible
        studentDetails: {
          fullName: student.fullName,
          admissionNumber: student.admissionNumber,
          class: student.class,
          contact: student.contact,
          joiningDate: student.joiningDate,
        },
        parentDetails: parent
          ? {
              fullName: parent.fullName,
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
      // Initialize monthly dues from joining month onward
      const initialRegularDues = months.slice(joiningMonthIndex).map(month => ({
        month,
        dueAmount: regularFeeMap["Monthly"] || 0,
        paidAmount: 0,
        status: "Unpaid",
      }));

      // Apply payments to initial regular dues
      updatedRegularFees.forEach(entry => {
        const due = initialRegularDues.find(d => d.month === entry.month);
        if (due) {
          due.dueAmount = entry.dueAmount;
          due.paidAmount = entry.paidAmount;
          due.status = entry.status;
        }
      });

      // Calculate total dues
      const totalRegularDues = initialRegularDues.reduce((sum, due) => sum + due.dueAmount, 0);
      const totalAdditionalDues = updatedAdditionalFees.reduce((sum, due) => sum + due.dueAmount, 0);
      const remainingPastDues = Math.max(0, pastDues - pastDuesPaid);
      const totalDues = totalRegularDues + totalAdditionalDues + remainingPastDues;

      const newFeePayment = new FeeStatus({
        schoolId,
        admissionNumber,
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
      });

      const savedFeePayment = await newFeePayment.save();
      responseData = {
        feeReceiptNumber, // Explicitly include the generated receipt number
        feeStatus: savedFeePayment.toObject(), // Convert to plain object to ensure all fields are visible
        studentDetails: {
          fullName: student.fullName,
          admissionNumber: student.admissionNumber,
          class: student.class,
          contact: student.contact,
          joiningDate: student.joiningDate,
        },
        parentDetails: parent
          ? {
              fullName: parent.fullName,
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
    res.status(400).json({
      success: false,
      message: "Fee Status is not created Successfully",
      error: error.message,
    });
  }
};




// Controller to get fee status
exports.getFeeStatus = async (req, res) => {
    try {
        const { admissionNumber } = req.query;

        let filter = {
            ...(admissionNumber ? { admissionNumber: admissionNumber } : {}),
            schoolId: req.user.schoolId
        };

        const feesData = await FeeStatus.find(filter).lean();

        if (feesData.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No fee status found for the provided filter",
                data: []
            });
        }

        const studentDetailsPromises = feesData.map(async feeStatus => {
            const student = await NewStudentModel.findOne({
                schoolId: req.user.schoolId,
                admissionNumber: feeStatus.admissionNumber
            }).lean();

            const parent = student?.parentId ? await ParentModel.findOne({
                schoolId: req.user.schoolId,
                _id: student.parentId
            }).lean() : null;

            return {
                ...feeStatus,
                student: student ? {
                    ...student,
                    parentContact: parent?.contact || null
                } : null
            };
        });

        const detailedFeeStatus = await Promise.all(studentDetailsPromises);

        res.status(200).json({
            success: true,
            message: "Fee Status Data Retrieved Successfully",
            data: detailedFeeStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to retrieve fee status",
            error: error.message
        });
    }
};

exports.getFeeStatusByMonth = async (req, res) => {
    try {
      const { admissionNumber, month } = req.query;
      const schoolId = req.user.schoolId;
  
      let filter = { ...(admissionNumber ? { admissionNumber } : {}), schoolId };
      const feesData = await FeeStatus.find(filter).lean();
  
      if (feesData.length === 0) {
        return res.status(404).json({ success: false, message: "No fee status found.", data: [] });
      }
  
      const student = await NewStudentModel.findOne({ schoolId, admissionNumber }).lean();
      const joiningMonthIndex = student ? new Date(student.joiningDate).getMonth() : 0;
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const monthIndex = months.indexOf(month);
  
      const studentDetailsPromises = feesData.map(async feeStatus => {
        const parent = student?.parentId ? await ParentModel.findOne({ schoolId, _id: student.parentId }).lean() : null;
  
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


exports.feeIncomeMonths = async (req, res) => {
    try {
        const feesData = await FeeStatus.find({ schoolId: req.user.schoolId });

        // Initialize the array with 12 zeros for each month
        let arr = new Array(12).fill(0);

        const monthToIndex = {
            'January': 0,
            'February': 1,
            'March': 2,
            'April': 3,
            'May': 4,
            'June': 5,
            'July': 6,
            'August': 7,
            'September': 8,
            'October': 9,
            'November': 10,
            'December': 11
        };

        // Debugging: Log the feesData to inspect the structure
        console.log('Fees Data:', feesData);

        for (const feeStatus of feesData) {
            for (const feeHistoryEntry of feeStatus.feeHistory) {
                // Debugging: Log each feeHistoryEntry
                console.log('Fee History Entry:', feeHistoryEntry);

                // Convert month name to an index (0-11)
                const monthIndex = monthToIndex[feeHistoryEntry.month];
                
                // Debugging: Check if monthIndex is valid
                if (monthIndex !== undefined) {
                    arr[monthIndex] += Number(feeHistoryEntry.totalAmountPaid) || 0; // Accumulate totalAmountPaid
                } else {
                    console.warn(`Invalid month name: ${feeHistoryEntry.month}`);
                }
            }
        }

        res.status(200).json({
            success: true,
            message: "Fees Data Successfully Retrieved",
            data: arr
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving fee income data by month",
            error: error.message
        });
    }
};


exports.getFeeHistory = async (req, res) => {
    try {
        const { admissionNumber } = req.query;

        let filter = {
            schoolId: req.user.schoolId,
            ...(admissionNumber ? { admissionNumber: admissionNumber } : {})
        };

        const feeStatusData = await FeeStatus.find(filter).exec();

        let feeHistory = [];
        for (const feeStatus of feeStatusData) {
            const studentData = await NewStudentModel.findOne({ 
                admissionNumber: feeStatus.admissionNumber 
            }, 'fullName class admissionNumber parentId').exec();

            const parent = studentData?.parentId ? await ParentModel.findOne({
                schoolId: req.user.schoolId,
                _id: studentData.parentId
            }).lean() : null;

            if (studentData) {
                feeStatus.feeHistory.forEach(history => {
                    feeHistory.push({
                        admissionNumber: studentData.admissionNumber,
                        studentName: studentData.fullName,
                        studentClass: studentData.class,
                        parentContact: parent?.contact || null,
                        feeReceiptNumber: history.feeReceiptNumber,
                        paymentMode: history.paymentMode,
                        dues: history.regularFees.reduce((sum, fee) => sum + fee.dueAmount, 0) + 
                              history.additionalFees.reduce((sum, fee) => sum + fee.dueAmount, 0),
                        ...history._doc
                    });
                });
            } else {
                console.error(`Student with admissionNumber ${feeStatus.admissionNumber} not found`);
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



// EDIT FEESTATUS CONTROLLER
exports.editFeeStatus = async (req, res) => {
    try {
        const { receiptNumber } = req.params;
        const updateData = req.body;

        // Find and update the fee status
        const feeStatus = await FeeStatus.findOneAndUpdate(
            { "feeHistory.feeReceiptNumber": receiptNumber },
            { $set: { "feeHistory.$": updateData } },
            { new: true }
        );

        if (!feeStatus) {
            return res.status(404).json({
                success: false,
                message: "Fee status not found",
            });
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

  
// DELETE FEESTATUS CONTROLLER
exports.deleteFeeStatus = async (req, res) => {
    try {
        const { receiptNumber } = req.params;

        // Find and update the fee status
        const feeStatus = await FeeStatus.findOneAndUpdate(
            { "feeHistory.feeReceiptNumber": receiptNumber },
            { $pull: { feeHistory: { feeReceiptNumber: receiptNumber } } },
            { new: true }
        );

        if (!feeStatus) {
            return res.status(404).json({
                success: false,
                message: "Fee status not found",
            });
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





// // ALL STUDENTS TABLE CREATION FOR FEE MANAGEMENT

exports.getAllStudentsFeeStatus = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;

        const students = await NewStudentModel.find({ schoolId }).lean();

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No students found for this school",
                data: []
            });
        }

        const feeStatuses = await FeeStatus.find({ schoolId }).lean();

        const feeStatusMap = feeStatuses.reduce((map, feeStatus) => {
            map[feeStatus.admissionNumber] = feeStatus;
            return map;
        }, {});

        const studentsWithFeeStatusPromises = students.map(async student => {
            const feeStatus = feeStatusMap[student.admissionNumber];
            const parent = student.parentId ? await ParentModel.findOne({
                schoolId,
                _id: student.parentId
            }).lean() : null;

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
                totalDues
            };
        });

        const studentsWithFeeStatus = await Promise.all(studentsWithFeeStatusPromises);

        res.status(200).json({
            success: true,
            message: "Student Fee Status Data Retrieved Successfully",
            data: studentsWithFeeStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to retrieve student fee status data",
            error: error.message
        });
    }
};

exports.getStudentFeeHistory = async (req, res) => {
    try {
        const { admissionNumber } = req.query;
        const schoolId = req.user.schoolId;

        if (!admissionNumber) {
            return res.status(400).json({
                success: false,
                message: "Admission number is required",
            });
        }

        const feeStatus = await FeeStatus.findOne({
            admissionNumber,
            schoolId
        }).lean();

        if (!feeStatus) {
            return res.status(404).json({
                success: false,
                message: "No fee status found for this student",
            });
        }

        const student = await NewStudentModel.findOne({
            admissionNumber,
            schoolId
        }).lean();

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "No student found with the provided admission number",
            });
        }

        const parent = student.parentId ? await ParentModel.findOne({
            schoolId,
            _id: student.parentId
        }).lean() : null;

        res.status(200).json({
            success: true,
            message: "Student fee history and dues retrieved successfully",
            data: {
                studentDetails: {
                    ...student,
                    parentContact: parent?.contact || null
                },
                feeHistory: feeStatus.feeHistory,
                monthlyDues: feeStatus.monthlyDues,
                totalDues: feeStatus.dues,
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error retrieving fee history",
            error: error.message
        });
    }
};

exports.getFeeHistoryAndDues = async (req, res) => {
    try {
        const { admissionNumber } = req.params;

        if (!admissionNumber) {
            return res.status(400).json({
                success: false,
                message: "Admission number is required"
            });
        }

        const feeStatusData = await FeeStatus.findOne({
            admissionNumber: admissionNumber,
            schoolId: req.user.schoolId
        }).lean();

        if (!feeStatusData) {
            return res.status(404).json({
                success: false,
                message: "No fee status found for the provided admission number"
            });
        }

        const student = await NewStudentModel.findOne({
            schoolId: req.user.schoolId,
            admissionNumber: admissionNumber
        }).lean();

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "No student found with the provided admission number"
            });
        }

        const parent = student.parentId ? await ParentModel.findOne({
            schoolId: req.user.schoolId,
            _id: student.parentId
        }).lean() : null;

        const responseData = {
            student: {
                ...student,
                parentContact: parent?.contact || null
            },
            feeStatus: feeStatusData
        };

        res.status(200).json({
            success: true,
            message: "Fee history and dues retrieved successfully",
            data: responseData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to retrieve fee history and dues",
            error: error.message
        });
    }
};
