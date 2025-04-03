const mongoose = require("mongoose");
const NewStudentModel = require("../models/newStudentModel");
const FeeStatus = require("../models/feeStatus");
const FeeStructure = require("../models/feeStructureModel");
const ParentModel = require("../models/parentModel");
const { generateStructuredNumber } = require("../utils/numberGenerator");

// Helper function to generate a structured fee receipt number
const generateFeeReceiptNumber = async (schoolId) => {
  try {
    const receiptNumber = await generateStructuredNumber(
      schoolId,
      FeeStatus,
      "feeHistory.feeReceiptNumber"
    );
    return receiptNumber;
  } catch (error) {
    console.error("Error generating fee receipt number:", error.message);
    throw error;
  }
};

// Fetch fees for a class or student
async function getFeesForClass(schoolId, className, studentId = null) {
  try {
    let fees;
    if (studentId) {
      fees = await FeeStructure.find({ schoolId, studentId });
      if (fees.length === 0) {
        fees = await FeeStructure.find({
          schoolId,
          className,
          studentId: { $exists: false },
        });
      }
    } else {
      fees = await FeeStructure.find({
        schoolId,
        className,
        studentId: { $exists: false },
      });
    }
    if (fees.length === 0) {
      throw new Error(
        `No fee structure found for class ${className}${
          studentId ? ` or student ${studentId}` : ""
        }`
      );
    }
    return fees;
  } catch (error) {
    throw error;
  }
}

// Add past dues
exports.addPastDues = async (req, res) => {
  try {
    const { students } = req.body;
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res
        .status(400)
        .json({ success: false, message: "School ID is required." });
    }
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: "A non-empty array of students is required.",
      });
    }
    if (
      students.some(
        (student) =>
          !student.studentId ||
          student.pastDuesAmount === undefined ||
          student.pastDuesAmount < 0 ||
          !student.session
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Each student must have a valid studentId, pastDuesAmount (>= 0), and session (e.g., '2025-2026').",
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

        let feeStatus = await FeeStatus.findOne({
          schoolId,
          studentId,
          session,
        });
        if (!feeStatus) {
          feeStatus = new FeeStatus({
            schoolId,
            studentId,
            year: session.split("-")[0],
            session,
            pastDues: pastDuesAmount,
            dues: pastDuesAmount,
            monthlyDues: { regularDues: [], additionalDues: [] },
          });
        } else {
          const previousPastDues = feeStatus.pastDues || 0;
          feeStatus.pastDues = pastDuesAmount;
          feeStatus.dues = feeStatus.dues - previousPastDues + pastDuesAmount;
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

// Create or update fee payment
exports.createOrUpdateFeePayment = async (req, res) => {
  try {
    const { studentId, session, paymentDetails, mode = "auto" } = req.body;
    const schoolId = req.user.schoolId;

    if (
      !studentId ||
      !session ||
      !paymentDetails ||
      !paymentDetails.totalAmount
    ) {
      return res.status(400).json({
        success: false,
        message: "Student ID, session, and totalAmount are required.",
      });
    }

    const student = await NewStudentModel.findOne({
      schoolId,
      studentId,
    }).lean();
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found." });
    }

    const fees = await getFeesForClass(schoolId, student.class, studentId);
    const months = [
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
      "January",
      "February",
      "March",
    ];

    const regularFeeMap = {
      Monthly: fees.find((f) => !f.additional)?.amount || 0,
    };
    const additionalFeeMap = fees
      .filter((f) => f.additional && f.feeType !== "LateFine")
      .reduce((map, f) => {
        map[f.name] = { amount: f.amount, type: f.feeType };
        return map;
      }, {});
    const lateFineConfig = fees.find((f) => f.feeType === "LateFine");

    let feeStatus = await FeeStatus.findOne({ schoolId, studentId, session });
    if (!feeStatus) {
      feeStatus = new FeeStatus({
        schoolId,
        studentId,
        session,
        year: session.split("-")[0],
        monthlyDues: { regularDues: [], additionalDues: [] },
        pastDues: 0,
        dues: 0,
        totalLateFines: 0,
        feeHistory: [],
      });
    }

    const {
      regularFees = [],
      additionalFees = [],
      pastDuesPaid = 0,
      lateFinesPaid = 0,
      concession = 0,
      totalAmount,
      paymentMode,
      transactionId,
      remark,
    } = paymentDetails;

    // Calculate initial dues
    const totalPastDues = feeStatus.pastDues || 0;
    const totalRegularDues = feeStatus.monthlyDues.regularDues.reduce(
      (sum, d) => sum + d.dueAmount,
      0
    );
    const totalAdditionalDues = feeStatus.monthlyDues.additionalDues.reduce(
      (sum, d) => sum + d.dueAmount,
      0
    );

    const currentDate = new Date();
    const lateFines = [];
    if (
      lateFineConfig &&
      currentDate.getDate() > lateFineConfig.lateFineDueDay
    ) {
      feeStatus.monthlyDues.regularDues.forEach((d) => {
        if (
          d.dueAmount > 0 &&
          months.indexOf(d.month) <= currentDate.getMonth()
        ) {
          lateFines.push({
            amount: lateFineConfig.amount,
            paidAmount: 0,
            dueAmount: lateFineConfig.amount,
            appliedOn: new Date(),
          });
        }
      });
    }
    // Calculate total late fines before payment
    totalLateFinesBefore = feeStatus.lateFines.reduce(
      (sum, lf) => sum + lf.dueAmount,
      0
    );

    feeStatus.totalLateFines = totalLateFinesBefore;

    // Update total dues before payment
    const totalDuesBefore =
      totalPastDues +
      totalRegularDues +
      totalAdditionalDues +
      totalLateFinesBefore;

    // Calculate total remaining dues for the selected fees
    let totalRemainingDues = 0;

    // Regular fees remaining dues
    const regularFeesDues = regularFees.reduce((sum, r) => {
      const due = feeStatus.monthlyDues.regularDues.find(
        (d) => d.month === r.month
      );
      return sum + (due ? due.dueAmount : regularFeeMap.Monthly);
    }, 0);

    // Additional fees remaining dues
    const additionalFeesDues = additionalFees.reduce((sum, a) => {
      const due = feeStatus.monthlyDues.additionalDues.find(
        (d) => d.name === a.name && d.month === a.month
      );
      return (
        sum + (due ? due.dueAmount : additionalFeeMap[a.name]?.amount || 0)
      );
    }, 0);

    // Total remaining dues for selected items
    totalRemainingDues =
      totalLateFinesBefore +
      totalPastDues +
      regularFeesDues +
      additionalFeesDues;

    // Validate totalAmount against remaining dues
    if (parseFloat(totalAmount) > totalRemainingDues) {
      return res.status(400).json({
        success: false,
        message: `Total amount (₹${totalAmount}) exceeds remaining dues (₹${totalRemainingDues}) for the selected fees.`,
      });
    }

    // Calculate totalFeeAmount for the selected fees in this transaction
    const regularFeeTotal = regularFees.length * regularFeeMap.Monthly;
    const additionalFeeTotal = additionalFees.reduce((sum, a) => {
      return sum + (additionalFeeMap[a.name]?.amount || 0);
    }, 0);
    const totalFeeAmount =
      regularFeeTotal +
      additionalFeeTotal +
      (pastDuesPaid > 0 ? totalPastDues : 0) +
      totalLateFinesBefore;

    // Handle past dues on first payment
    if (feeStatus.feeHistory.length === 0 && totalPastDues > 0) {
      feeStatus.dues += totalPastDues; // Add past dues to total dues on first payment
      feeStatus.pastDues = 0; // Reset past dues
    }

    let feeReceiptNumber;

    if (mode === "auto") {
      let remaining = totalAmount;

      // Pay late fines first
      let paidLateFines = 0;
      const updatedLateFines = feeStatus.lateFines.map((lf) => {
        const payment = Math.min(remaining, lf.dueAmount);
        const updatedLf = {
          ...lf,
          paidAmount: lf.paidAmount + payment,
          dueAmount: lf.dueAmount - payment,
        };
        paidLateFines += payment;
        remaining -= payment;
        return updatedLf;
      });

      // Pay past dues
      const paidPastDues = Math.min(remaining, totalPastDues);
      remaining -= paidPastDues;

      // Process regular fees based on selected months
      const updatedRegular = [];
      regularFees.forEach((r) => {
        let due = feeStatus.monthlyDues.regularDues.find(
          (d) => d.month === r.month
        );
        if (!due) {
          due = {
            month: r.month,
            paidAmount: 0,
            dueAmount: regularFeeMap.Monthly,
            status: "Unpaid",
          };
        }
        if (remaining > 0) {
          const maxPayment = Math.min(remaining, due.dueAmount);
          const updatedDue = {
            month: due.month,
            paidAmount: due.paidAmount + maxPayment,
            dueAmount: Math.max(0, due.dueAmount - maxPayment),
            status:
              due.dueAmount - maxPayment === 0 ? "Paid" : "Partial Payment",
          };
          updatedRegular.push(updatedDue);
          remaining -= maxPayment;
        } else {
          updatedRegular.push({ ...due });
        }
      });

      // Process additional fees based on selected fees and months
      const updatedAdditional = [];
      additionalFees.forEach((a) => {
        let due = feeStatus.monthlyDues.additionalDues.find(
          (d) => d.name === a.name && d.month === a.month
        );
        if (!due && additionalFeeMap[a.name]) {
          due = {
            name: a.name,
            month: a.month,
            paidAmount: 0,
            dueAmount: additionalFeeMap[a.name].amount,
            status: "Unpaid",
          };
        }
        if (due) {
          if (remaining > 0) {
            const maxPayment = Math.min(remaining, due.dueAmount);
            const updatedDue = {
              name: due.name,
              month: due.month,
              paidAmount: due.paidAmount + maxPayment,
              dueAmount: Math.max(0, due.dueAmount - maxPayment),
              status:
                due.dueAmount - maxPayment === 0 ? "Paid" : "Partial Payment",
            };
            updatedAdditional.push(updatedDue);
            remaining -= maxPayment;
          } else {
            updatedAdditional.push({ ...due });
          }
        }
      });

      // Update feeStatus
      feeStatus.lateFines = updatedLateFines;
      feeStatus.totalLateFines = updatedLateFines.reduce(
        (sum, lf) => sum + lf.dueAmount,
        0
      );
      const otherRegularDues = feeStatus.monthlyDues.regularDues.filter(
        (due) => !regularFees.some((r) => r.month === due.month)
      );
      const otherAdditionalDues = feeStatus.monthlyDues.additionalDues.filter(
        (due) =>
          !additionalFees.some(
            (a) => a.name === due.name && a.month === due.month
          )
      );

      feeStatus.monthlyDues.regularDues = [
        ...otherRegularDues,
        ...updatedRegular,
      ];
      feeStatus.monthlyDues.additionalDues = [
        ...otherAdditionalDues,
        ...updatedAdditional,
      ];

      feeStatus.pastDues = Math.max(0, totalPastDues - paidPastDues);
      feeStatus.dues =
        feeStatus.monthlyDues.regularDues.reduce(
          (sum, d) => sum + d.dueAmount,
          0
        ) +
        feeStatus.monthlyDues.additionalDues.reduce(
          (sum, d) => sum + d.dueAmount,
          0
        ) +
        feeStatus.pastDues +
        feeStatus.totalLateFines;

      // Record the payment in feeHistory
      feeReceiptNumber = await generateFeeReceiptNumber(schoolId);
      const paymentMessage =
        `Paid ${totalAmount} on ${new Date().toLocaleDateString()}: ` +
        `Regular Fees - ${
          updatedRegular.length > 0
            ? updatedRegular
                .map((r) => `${r.month}: ${r.paidAmount}`)
                .join(", ")
            : "None"
        }, ` +
        `Additional Fees - ${
          updatedAdditional.length > 0
            ? updatedAdditional
                .map((a) => `${a.name} (${a.month}): ${a.paidAmount}`)
                .join(", ")
            : "None"
        }, ` +
        `Past Dues: ${paidPastDues}, Late Fines: ${paidLateFines}, Concession: ${concession}, ` +
        `Remaining Dues: ${feeStatus.dues}`;

      feeStatus.feeHistory.push({
        date: new Date(),
        status: "active",
        regularFees: updatedRegular,
        additionalFees: updatedAdditional,
        lateFines: updatedLateFines.filter((lf) => lf.paidAmount > 0),
        pastDuesPaid,
        concessionApplied: concession,
        paymentMode: paymentMode || "Cash",
        transactionId: transactionId || "N/A",
        totalFeeAmount,
        totalAmountPaid: totalAmount,
        totalDues: feeStatus.dues,
        remark,
        feeReceiptNumber,
        paymentMessage,
        previousDues: totalDuesBefore,
      });
    } else if (mode === "manual") {
      let remaining = totalAmount;
      let paidLateFines = Math.min(lateFinesPaid, totalLateFinesBefore);
      let paidPastDues = Math.min(pastDuesPaid, totalPastDues);
      remaining -= paidLateFines + paidPastDues;

      const updatedLateFines = feeStatus.lateFines.map((lf) => {
        const payment = Math.min(paidLateFines, lf.dueAmount);
        const updatedLf = {
          ...lf,
          paidAmount: lf.paidAmount + payment,
          dueAmount: lf.dueAmount - payment,
        };
        paidLateFines -= payment;
        return updatedLf;
      });

      const updatedRegular = [];
      regularFees.forEach((r) => {
        let due = feeStatus.monthlyDues.regularDues.find(
          (d) => d.month === r.month
        );
        if (!due) {
          due = {
            month: r.month,
            paidAmount: 0,
            dueAmount: regularFeeMap.Monthly,
            status: "Unpaid",
          };
        }
        const paidAmount = parseFloat(r.paidAmount) || 0;
        if (paidAmount > due.dueAmount) {
          throw new Error(
            `Payment for ${r.month} (₹${paidAmount}) exceeds remaining dues (₹${due.dueAmount}).`
          );
        }
        const updatedDue = {
          month: due.month,
          paidAmount: due.paidAmount + paidAmount,
          dueAmount: Math.max(0, due.dueAmount - paidAmount),
          status: due.dueAmount - paidAmount === 0 ? "Paid" : "Partial Payment",
        };
        updatedRegular.push(updatedDue);
      });

      const updatedAdditional = [];
      additionalFees.forEach((a) => {
        let due = feeStatus.monthlyDues.additionalDues.find(
          (d) => d.name === a.name && d.month === a.month
        );
        if (!due) {
          if (!additionalFeeMap[a.name]) {
            throw new Error(`Invalid additional fee name: ${a.name}`);
          }
          due = {
            name: a.name,
            month: a.month,
            paidAmount: 0,
            dueAmount: additionalFeeMap[a.name].amount,
            status: "Unpaid",
          };
        }
        const paidAmount = parseFloat(a.paidAmount) || 0;
        if (paidAmount > due.dueAmount) {
          throw new Error(
            `Payment for ${a.name} (${a.month}) (₹${paidAmount}) exceeds remaining dues (₹${due.dueAmount}).`
          );
        }
        const updatedDue = {
          name: a.name,
          month: a.month,
          paidAmount: due.paidAmount + paidAmount,
          dueAmount: Math.max(0, due.dueAmount - paidAmount),
          status: due.dueAmount - paidAmount === 0 ? "Paid" : "Partial Payment",
        };
        updatedAdditional.push(updatedDue);
      });

      // Update feeStatus
      feeStatus.lateFines = updatedLateFines;
      feeStatus.totalLateFines = updatedLateFines.reduce(
        (sum, lf) => sum + lf.dueAmount,
        0
      );
      const otherRegularDues = feeStatus.monthlyDues.regularDues.filter(
        (due) => !regularFees.some((r) => r.month === due.month)
      );
      const otherAdditionalDues = feeStatus.monthlyDues.additionalDues.filter(
        (due) =>
          !additionalFees.some(
            (a) => a.name === due.name && a.month === due.month
          )
      );

      feeStatus.monthlyDues.regularDues = [
        ...otherRegularDues,
        ...updatedRegular,
      ];
      feeStatus.monthlyDues.additionalDues = [
        ...otherAdditionalDues,
        ...updatedAdditional,
      ];

      feeStatus.pastDues = Math.max(0, totalPastDues - paidPastDues);
      feeStatus.dues =
        feeStatus.monthlyDues.regularDues.reduce(
          (sum, d) => sum + d.dueAmount,
          0
        ) +
        feeStatus.monthlyDues.additionalDues.reduce(
          (sum, d) => sum + d.dueAmount,
          0
        ) +
        feeStatus.pastDues +
        feeStatus.totalLateFines;

      feeReceiptNumber = await generateFeeReceiptNumber(schoolId);
      const paymentMessage =
        `Paid ${totalAmount} on ${new Date().toLocaleDateString()}: ` +
        `Regular Fees - ${
          updatedRegular.length > 0
            ? updatedRegular
                .map((r) => `${r.month}: ${r.paidAmount}`)
                .join(", ")
            : "None"
        }, ` +
        `Additional Fees - ${
          updatedAdditional.length > 0
            ? updatedAdditional
                .map((a) => `${a.name} (${a.month}): ${a.paidAmount}`)
                .join(", ")
            : "None"
        }, ` +
        `Past Dues: ${paidPastDues}, Late Fines: ${paidLateFines}, Concession: ${concession}, ` +
        `Remaining Dues: ${feeStatus.dues}`;

      feeStatus.feeHistory.push({
        date: new Date(),
        status: "active",
        regularFees: updatedRegular,
        additionalFees: updatedAdditional,
        lateFines: updatedLateFines.filter((lf) => lf.paidAmount > 0),
        pastDuesPaid,
        concessionApplied: concession,
        paymentMode: paymentMode || "Cash",
        transactionId: transactionId || "N/A",
        totalFeeAmount,
        totalAmountPaid: totalAmount,
        totalDues: feeStatus.dues,
        remark,
        feeReceiptNumber,
        paymentMessage,
        previousDues: totalDuesBefore,
      });
    }

    await feeStatus.save();

    res.status(201).json({
      success: true,
      message: "Fee payment processed successfully",
      data: { feeReceiptNumber, feeStatus },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process payment",
      error: error.message,
    });
  }
};

// Get fee status
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
      return res.status(404).json({
        success: false,
        message: "No fee status found for the provided filter",
        data: [],
      });
    }

    const detailedFeeStatus = await Promise.all(
      feesData.map(async (feeStatus) => {
        const student = await NewStudentModel.findOne({
          schoolId: req.user.schoolId,
          studentId: feeStatus.studentId,
        }).lean();
        const parent = student?.parentId
          ? await ParentModel.findOne({
              schoolId: req.user.schoolId,
              parentId: student.parentId,
            }).lean()
          : null;

        const activeFeeHistory = feeStatus.feeHistory.filter(
          (fee) => fee.status === "active"
        );
        const totalPastDuesPaid = activeFeeHistory.reduce(
          (sum, fee) => sum + (fee.pastDuesPaid || 0),
          0
        );
        const calculatedDues =
          feeStatus.monthlyDues.regularDues.reduce(
            (sum, due) => sum + due.dueAmount,
            0
          ) +
          feeStatus.monthlyDues.additionalDues.reduce(
            (sum, due) => sum + due.dueAmount,
            0
          ) +
          Math.max(0, feeStatus.pastDues - totalPastDuesPaid);

        return {
          ...feeStatus,
          dues: calculatedDues,
          student: student
            ? { ...student, parentContact: parent?.contact || null }
            : null,
        };
      })
    );

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

// Get monthly dues
exports.getMonthlyDues = async (req, res) => {
  try {
    const { studentId, session } = req.query;
    const schoolId = req.user.schoolId;

    if (!studentId || !session) {
      return res.status(400).json({
        success: false,
        message: "Student ID and session are required.",
      });
    }

    const feeStatus = await FeeStatus.findOne({ schoolId, studentId, session });
    if (!feeStatus) {
      return res
        .status(404)
        .json({ success: false, message: "No fee status found." });
    }

    const monthlyDues = {
      regularDues: feeStatus.monthlyDues.regularDues,
      additionalDues: feeStatus.monthlyDues.additionalDues,
      lateFines: feeStatus.totalLateFines,
      pastDues: feeStatus.pastDues,
      totalDues: feeStatus.dues,
    };

    res.status(200).json({
      success: true,
      message: "Monthly dues fetched successfully",
      data: monthlyDues,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly dues",
      error: error.message,
    });
  }
};

// Cancel a fee payment
exports.cancelFeePayment = async (req, res) => {
  try {
    const { studentId, feeReceiptNumber } = req.body;
    const schoolId = req.user.schoolId;

    if (!studentId || !feeReceiptNumber) {
      return res.status(400).json({
        success: false,
        message: "Student ID and Fee Receipt Number are required.",
      });
    }

    const feeStatus = await FeeStatus.findOne({ schoolId, studentId });
    if (!feeStatus) {
      return res.status(404).json({
        success: false,
        message: "Fee status not found for this student.",
      });
    }

    const feeToCancel = feeStatus.feeHistory.find(
      (fee) => fee.feeReceiptNumber === feeReceiptNumber
    );
    if (!feeToCancel) {
      return res
        .status(404)
        .json({ success: false, message: "Fee receipt number not found." });
    }
    if (feeToCancel.status === "canceled") {
      return res
        .status(400)
        .json({ success: false, message: "Fee is already canceled." });
    }

    feeToCancel.status = "canceled";

    feeToCancel.regularFees.forEach((canceledFee) => {
      const regularDue = feeStatus.monthlyDues.regularDues.find(
        (due) => due.month === canceledFee.month
      );
      if (regularDue) {
        regularDue.paidAmount = Math.max(
          0,
          (regularDue.paidAmount || 0) - canceledFee.paidAmount
        );
        regularDue.dueAmount += canceledFee.paidAmount;
        regularDue.status =
          regularDue.dueAmount > 0
            ? regularDue.paidAmount > 0
              ? "Partial Payment"
              : "Unpaid"
            : "Paid";
      }
    });

    feeToCancel.additionalFees.forEach((canceledFee) => {
      const additionalDue = feeStatus.monthlyDues.additionalDues.find(
        (due) =>
          due.name === canceledFee.name && due.month === canceledFee.month
      );
      if (additionalDue) {
        additionalDue.paidAmount = Math.max(
          0,
          (additionalDue.paidAmount || 0) - canceledFee.paidAmount
        );
        additionalDue.dueAmount += canceledFee.paidAmount;
        additionalDue.status =
          additionalDue.dueAmount > 0
            ? additionalDue.paidAmount > 0
              ? "Partial Payment"
              : "Unpaid"
            : "Paid";
      }
    });

    const activeFeeHistory = feeStatus.feeHistory.filter(
      (fee) => fee.status === "active"
    );
    const totalPastDuesPaid = activeFeeHistory.reduce(
      (sum, fee) => sum + (fee.pastDuesPaid || 0),
      0
    );
    feeStatus.pastDues = Math.max(
      0,
      feeStatus.pastDues - totalPastDuesPaid + feeToCancel.pastDuesPaid
    );
    feeStatus.dues =
      feeStatus.monthlyDues.regularDues.reduce(
        (sum, due) => sum + due.dueAmount,
        0
      ) +
      feeStatus.monthlyDues.additionalDues.reduce(
        (sum, due) => sum + due.dueAmount,
        0
      ) +
      feeStatus.pastDues;

    const updatedFeeStatus = await feeStatus.save();

    res.status(200).json({
      success: true,
      message: "Fee payment canceled successfully",
      data: updatedFeeStatus.toObject(),
    });
  } catch (error) {
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
      return res.status(404).json({
        success: false,
        message: "No fee status found.",
        data: [],
      });
    }

    const student = await NewStudentModel.findOne({
      schoolId,
      studentId,
    }).lean();
    const joiningMonthIndex = student
      ? new Date(student.joiningDate).getMonth()
      : 0;
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthIndex = months.indexOf(month);

    const studentDetailsPromises = feesData.map(async (feeStatus) => {
      const parent = student?.parentId
        ? await ParentModel.findOne({
            schoolId,
            parentId: student.parentId,
          }).lean()
        : null;

      const monthlyRegularFees = feeStatus.monthlyDues.regularDues.filter(
        (fee) => fee.month === month
      );
      const monthlyAdditionalFees = feeStatus.monthlyDues.additionalDues.filter(
        (fee) => fee.month === month
      );

      let totalRegularDues = 0,
        totalRegularPaid = 0,
        totalAdditionalDues = 0,
        totalAdditionalPaid = 0;
      monthlyRegularFees.forEach((fee) => {
        totalRegularDues += fee.dueAmount;
        totalRegularPaid += fee.paidAmount;
      });
      monthlyAdditionalFees.forEach((fee) => {
        totalAdditionalDues += fee.dueAmount;
        totalAdditionalPaid += fee.paidAmount;
      });

      let status = monthIndex < joiningMonthIndex ? "Not Applicable" : "Paid";
      const totalDues =
        totalRegularDues +
        totalAdditionalDues +
        (month === "January" ? feeStatus.pastDues : 0);
      const totalPaid = totalRegularPaid + totalAdditionalPaid;

      if (totalDues > 0) {
        status = totalPaid > 0 ? "Partial Payment" : "Unpaid";
      }

      return {
        ...feeStatus,
        student: student
          ? { ...student, parentContact: parent?.contact || null }
          : null,
        month,
        monthlyFees: {
          regularFees: monthlyRegularFees,
          additionalFees: monthlyAdditionalFees,
        },
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
      January: 0,
      February: 1,
      March: 2,
      April: 3,
      May: 4,
      June: 5,
      July: 6,
      August: 7,
      September: 8,
      October: 9,
      November: 10,
      December: 11,
    };

    for (const feeStatus of feesData) {
      for (const feeHistoryEntry of feeStatus.feeHistory) {
        const date = new Date(feeHistoryEntry.date);
        const monthName = date.toLocaleString("en-US", { month: "long" });
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
      const studentData = await NewStudentModel.findOne(
        { studentId: feeStatus.studentId },
        "studentName class studentId parentId"
      ).exec();
      const parent = studentData?.parentId
        ? await ParentModel.findOne({
            schoolId: req.user.schoolId,
            parentId: studentData.parentId,
          }).lean()
        : null;

      if (studentData) {
        feeStatus.feeHistory.forEach((history) => {
          feeHistory.push({
            studentId: studentData.studentId,
            studentName: studentData.studentName,
            studentClass: studentData.class,
            parentContact: parent?.contact || null,
            feeReceiptNumber: history.feeReceiptNumber,
            paymentMode: history.paymentMode,
            dues:
              history.regularFees.reduce((sum, fee) => sum + fee.dueAmount, 0) +
              history.additionalFees.reduce(
                (sum, fee) => sum + fee.dueAmount,
                0
              ),
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
      return res
        .status(404)
        .json({ success: false, message: "Fee status not found" });
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
      return res
        .status(404)
        .json({ success: false, message: "Fee status not found" });
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
      return res.status(404).json({
        success: false,
        message: "No students found for this school",
        data: [],
      });
    }

    const feeStatuses = await FeeStatus.find({ schoolId }).lean();
    const feeStatusMap = feeStatuses.reduce((map, feeStatus) => {
      map[feeStatus.studentId] = feeStatus;
      return map;
    }, {});

    const studentsWithFeeStatusPromises = students.map(async (student) => {
      const feeStatus = feeStatusMap[student.studentId];
      const parent = student.parentId
        ? await ParentModel.findOne({
            schoolId,
            parentId: student.parentId,
          }).lean()
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

    const studentsWithFeeStatus = await Promise.all(
      studentsWithFeeStatusPromises
    );

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
      return res
        .status(400)
        .json({ success: false, message: "Student ID is required" });
    }

    const feeStatus = await FeeStatus.findOne({ studentId, schoolId }).lean();
    if (!feeStatus) {
      return res.status(404).json({
        success: false,
        message: "No fee status found for this student",
      });
    }

    const student = await NewStudentModel.findOne({
      studentId,
      schoolId,
    }).lean();
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "No student found with the provided student ID",
      });
    }

    const parent = student.parentId
      ? await ParentModel.findOne({
          schoolId,
          parentId: student.parentId,
        }).lean()
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

// Get fee information for student
exports.getStudentFeeInfo = async (req, res) => {
  try {
    const {
      studentId,
      session,
      className,
      parentId,
      includeFeeHistory = true,
      includeMonthlyDues = true,
      includeStudentDetails = true,
      includeParentDetails = true,
    } = req.query;
    const schoolId = req.user.schoolId;

    // Validate required parameters
    if (!studentId || !session) {
      return res.status(400).json({
        success: false,
        message: "Student ID and session are required.",
      });
    }

    // Fetch student details
    let student;
    if (includeStudentDetails) {
      student = await NewStudentModel.findOne({ schoolId, studentId }).lean();
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found.",
        });
      }
    }

    // Fetch parent details if requested
    let parent;
    if (includeParentDetails && student?.parentId) {
      parent = await ParentModel.findOne({
        schoolId,
        parentId: student.parentId,
      }).lean();
    }

    // Fetch fee structure for the student's class or specific student
    const fees = await getFeesForClass(
      schoolId,
      student?.class || className,
      studentId
    );

    // Organize fee structure
    const regularFees = fees.filter((f) => !f.additional);
    const additionalFees = fees.filter(
      (f) => f.additional && f.feeType !== "LateFine"
    );
    const lateFineConfig = fees.find((f) => f.feeType === "LateFine");

    // Fetch fee status
    let feeStatus = await FeeStatus.findOne({
      schoolId,
      studentId,
      session,
    }).lean();
    if (!feeStatus) {
      feeStatus = {
        schoolId,
        studentId,
        session,
        year: session.split("-")[0],
        monthlyDues: { regularDues: [], additionalDues: [] },
        pastDues: 0,
        dues: 0,
        totalLateFines: 0,
        feeHistory: [],
      };
    }

    // Calculate late fines if applicable
    const months = [
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
      "January",
      "February",
      "March",
    ];
    // Calculate late fines dynamically for all unpaid months up to the current date
    const currentDate = new Date();
    const currentMonthIndex = currentDate.getMonth(); // 0-11 (January-December)
    const lateFines = [];
    let totalLateFinesBefore = feeStatus.totalLateFines || 0;

    // Initialize late fines array in feeStatus if not present
    if (!feeStatus.lateFines) {
      feeStatus.lateFines = [];
    }

    // Check for late fines on all unpaid regular dues up to the current month
    if (lateFineConfig) {
      months.forEach((month, monthIndex) => {
        // Only apply late fines for months up to the current month
        if (monthIndex > currentMonthIndex) return;

        const regularDue = feeStatus.monthlyDues.regularDues.find(
          (d) => d.month === month
        );

        // If there's an unpaid or partially paid due for this month
        if (regularDue && regularDue.dueAmount > 0) {
          // Check if the current date is past the due date for this month
          const dueDateForMonth = new Date(
            currentDate.getFullYear(),
            monthIndex,
            lateFineConfig.lateFineDueDay
          );
          if (currentDate > dueDateForMonth) {
            // Check if a late fine has already been applied for this month
            const existingLateFine = feeStatus.lateFines.find(
              (lf) =>
                lf.month === month &&
                lf.year === currentDate.getFullYear().toString()
            );

            if (!existingLateFine) {
              // Apply a new late fine
              const lateFine = {
                month,
                year: currentDate.getFullYear().toString(),
                amount: lateFineConfig.amount,
                paidAmount: 0,
                dueAmount: lateFineConfig.amount,
                appliedOn: new Date(),
              };
              lateFines.push(lateFine);
              feeStatus.lateFines.push(lateFine);
            }
          }
        }
      });
    }
    const totalLateFines = lateFines.reduce((sum, lf) => sum + lf.dueAmount, 0);

    // Prepare monthly status for regular and additional fees
    const monthlyStatus = months.map((month) => {
      const regularDue =
        feeStatus?.monthlyDues.regularDues.find((d) => d.month === month) ||
        null;
      const additionalDues =
        feeStatus?.monthlyDues.additionalDues.filter(
          (d) => d.month === month
        ) || [];

      return {
        month,
        regularFee: {
          amount: regularFees[0]?.amount || 0,
          paid: regularDue?.paidAmount || 0,
          due: regularDue?.dueAmount || regularFees[0]?.amount || 0,
          status: regularDue?.status || "Unpaid",
        },
        additionalFees: additionalFees.map((fee) => {
          const addDue = additionalDues.find((d) => d.name === fee.name);
          return {
            name: fee.name,
            amount: fee.amount,
            paid: addDue?.paidAmount || 0,
            due: addDue?.dueAmount || fee.amount,
            status: addDue?.status || "Unpaid",
            feeType: fee.feeType,
          };
        }),
      };
    });

    // Prepare the response
    const responseData = {
      success: true,
      message: "Fee information retrieved successfully",
      data: {
        ...(includeStudentDetails && { student }),
        ...(includeParentDetails && { parent }),
        feeStructure: {
          regularFees,
          additionalFees,
          lateFine: lateFineConfig,
        },
        feeStatus: {
          ...feeStatus,
          totalLateFines: feeStatus.totalLateFines || totalLateFines,
        },
        ...(includeMonthlyDues && { monthlyStatus }),
        pendingMonths: monthlyStatus
          .filter(
            (m) =>
              m.regularFee.due > 0 || m.additionalFees.some((af) => af.due > 0)
          )
          .map((m) => m.month),
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve fee information",
      error: error.message,
    });
  }
};

// Get fee history and dues
exports.getFeeHistoryAndDues = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res
        .status(400)
        .json({ success: false, message: "Student ID is required" });
    }

    const feeStatusData = await FeeStatus.findOne({
      studentId,
      schoolId: req.user.schoolId,
    }).lean();
    if (!feeStatusData) {
      return res.status(404).json({
        success: false,
        message: "No fee status found for the provided student ID",
      });
    }

    const student = await NewStudentModel.findOne({
      schoolId: req.user.schoolId,
      studentId,
    }).lean();
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "No student found with the provided student ID",
      });
    }

    const parent = student.parentId
      ? await ParentModel.findOne({
          schoolId: req.user.schoolId,
          parentId: student.parentId,
        }).lean()
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
