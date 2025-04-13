const mongoose = require("mongoose");
const NewStudentModel = require("../models/newStudentModel");
const FeeStatus = require("../models/feeStatus");
const FeeStructure = require("../models/feeStructureModel");
const ParentModel = require("../models/parentModel");
const UnifiedReceipt = require("../models/unifiedReceipt");
const { generateStructuredNumber } = require("../utils/numberGenerator");
const AdminInfo = require("../models/adminModel");

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

const generateUnifiedReceiptNumber = async (schoolId) => {
  try {
    const receiptNumber = await generateStructuredNumber(
      schoolId,
      FeeStatus,
      "feeHistory.feeReceiptNumber"
    );
    return `${receiptNumber}`;
  } catch (error) {
    throw new Error(
      `Failed to generate unified receipt number: ${error.message}`
    );
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

async function getAllApplicableFees(schoolId, className, studentId, session) {
  try {
    let allApplicableFees = [];

    const studentRegularFee = await FeeStructure.findOne({
      schoolId,
      session,
      studentId,
      additional: false,
    }).lean();

    let regularFee = studentRegularFee;
    if (!regularFee) {
      regularFee = await FeeStructure.findOne({
        schoolId,
        session,
        className,
        additional: false,
        studentId: { $exists: false },
      }).lean();
    }

    if (regularFee) {
      allApplicableFees.push(regularFee);
    }

    const studentAdditionalFees = await FeeStructure.find({
      schoolId,
      session,
      studentId,
      additional: true,
    }).lean();

    if (studentAdditionalFees.length > 0) {
      allApplicableFees = [...allApplicableFees, ...studentAdditionalFees];
    } else {
      const classAdditionalFees = await FeeStructure.find({
        schoolId,
        session,
        className,
        additional: true,
        studentId: { $exists: false },
      }).lean();
      allApplicableFees = [...allApplicableFees, ...classAdditionalFees];
    }

    return allApplicableFees;
  } catch (error) {
    throw new Error(`Failed to fetch applicable fees: ${error.message}`);
  }
}

async function applyLateFines(feeStatus, feeStructure, currentDate) {
  const lateFines = [];
  const regularFee = feeStructure.find(
    (f) => !f.additional && f.lateFineConfig?.isActive
  );
  if (!regularFee || !regularFee.lateFineConfig) return lateFines;

  const { amount, applyAfterDays } = regularFee.lateFineConfig;
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

  feeStatus.monthlyDues.regularDues.forEach((due) => {
    if (due.dueAmount > 0 && due.frequency === "monthly") {
      const dueDate = new Date(
        currentDate.getFullYear(),
        months.indexOf(due.month),
        1
      );
      dueDate.setDate(dueDate.getDate() + applyAfterDays);
      if (currentDate > dueDate) {
        lateFines.push({
          month: due.month,
          year: currentDate.getFullYear().toString(),
          amount,
          dueAmount: amount,
          paidAmount: 0,
          appliedOn: new Date(),
        });
      }
    }
  });

  return lateFines;
}

exports.createOrUpdateFeePayment = async (req, res) => {
  try {
    let { studentId, session, paymentDetails, mode = "auto" } = req.body;
    const schoolId = req.user.schoolId;
    console.log("Processing fee payment:", req.body);

    // Input validation (unchanged)
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

    // Fetch parent details using parentId from student
    const parent = await ParentModel.findOne({
      schoolId,
      parentId: student.parentId,
    }).lean();
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found for this student.",
      });
    }

    const fees = await getAllApplicableFees(schoolId, student.class, studentId);
    const addiFees = await FeeStructure.find({
      schoolId,
      session,
      additional: true,
    });

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
        feeHistory: [],
        overallAmountPaid: 0,
        overallConcessionApplied: 0,
      });
    }

    const {
      regularFees = [],
      additionalFees = [],
      pastDuesPaid = 0,
      concession = 0,
      totalAmount,
      paymentMode,
      transactionId,
      remark,
    } = paymentDetails;

    // Calculate current dues from feeStatus (unchanged)
    const totalPastDues = feeStatus.pastDues || 0;
    const totalRegularDues = feeStatus.monthlyDues.regularDues.reduce(
      (sum, d) => sum + d.dueAmount,
      0
    );
    const totalAdditionalDues = feeStatus.monthlyDues.additionalDues.reduce(
      (sum, d) => sum + d.dueAmount,
      0
    );
    const totalDuesBefore =
      totalPastDues + totalRegularDues + totalAdditionalDues;

    const computedFullRegularFeeTotal = regularFees.reduce((sum, r) => {
      const due = feeStatus.monthlyDues.regularDues.find(
        (d) => d.month === r.month
      );
      return sum + (due ? due.dueAmount : regularFeeMap.Monthly);
    }, 0);

    const computedFullAdditionalFeeTotal = additionalFees.reduce((sum, a) => {
      const due = feeStatus.monthlyDues.additionalDues.find(
        (d) =>
          d.name === a.name && (d.month === a.month || (!d.month && !a.month))
      );
      return (
        sum + (due ? due.dueAmount : additionalFeeMap[a.name]?.amount || 0)
      );
    }, 0);

    const computedPastDues = feeStatus.pastDues;
    const totalFeeAmount =
      computedFullRegularFeeTotal +
      computedFullAdditionalFeeTotal +
      computedPastDues;

    if (parseFloat(totalAmount) > totalFeeAmount) {
      return res.status(400).json({
        success: false,
        message: `Total amount (₹${totalAmount}) exceeds the full outstanding amount (₹${totalFeeAmount}).`,
      });
    }

    if (feeStatus.feeHistory.length === 0 && totalPastDues > 0) {
      feeStatus.dues += totalPastDues;
      feeStatus.pastDues = 0;
    }

    const previousDuesValue =
      feeStatus.feeHistory.length === 0
        ? computedFullRegularFeeTotal +
          computedFullAdditionalFeeTotal +
          computedPastDues
        : feeStatus.dues;

    let feeReceiptNumber;

    if (mode === "auto") {
      const roundedConcession = Math.round(concession);
      let remainingConcession = roundedConcession;
      let remaining = totalAmount;

      const paidPastDues = Math.min(remaining, totalPastDues);
      remaining -= paidPastDues;

      const existingRegularDues = feeStatus.monthlyDues.regularDues.filter(
        (due) =>
          !regularFees.some((r) => r.month === due.month) && due.dueAmount > 0
      );
      for (const due of existingRegularDues) {
        if (remaining <= 0) break;
        const payment = Math.min(remaining, due.dueAmount);
        due.paidAmount += payment;
        due.dueAmount -= payment;
        due.status = due.dueAmount === 0 ? "Paid" : "Partial";
        remaining -= payment;
      }

      const existingAdditionalDues =
        feeStatus.monthlyDues.additionalDues.filter(
          (due) =>
            !additionalFees.some(
              (a) =>
                a.name === due.name &&
                (a.month === due.month || (!a.month && !a.month))
            ) && due.dueAmount > 0
        );
      for (const due of existingAdditionalDues) {
        if (remaining <= 0) break;
        const payment = Math.min(remaining, due.dueAmount);
        due.paidAmount += payment;
        due.dueAmount -= payment;
        due.status = due.dueAmount === 0 ? "Paid" : "Partial";
        remaining -= payment;
      }

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
            month: r.month,
            paidAmount: due.paidAmount + maxPayment,
            dueAmount: Math.max(0, due.dueAmount - maxPayment),
            status: due.dueAmount - maxPayment === 0 ? "Paid" : "Partial",
          };
          updatedRegular.push(updatedDue);
          remaining -= maxPayment;
        } else {
          updatedRegular.push({ ...due });
        }
      });

      const updatedAdditional = [];
      additionalFees.forEach((a) => {
        let due = feeStatus.monthlyDues.additionalDues.find(
          (d) =>
            d.name === a.name && (d.month === a.month || (!d.month && !a.month))
        );
        if (!due && additionalFeeMap[a.name]) {
          due = {
            name: a.name,
            month: a.month || undefined,
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
              month: due.month || undefined,
              paidAmount: due.paidAmount + maxPayment,
              dueAmount: Math.max(0, due.dueAmount - maxPayment),
              status: due.dueAmount - maxPayment === 0 ? "Paid" : "Partial",
            };
            updatedAdditional.push(updatedDue);
            remaining -= maxPayment;
          } else {
            updatedAdditional.push({ ...due });
          }
        }
      });

      const allDuesToApplyConcession = [
        ...updatedRegular
          .filter((r) => r.dueAmount > 0)
          .map((r) => ({
            type: "regular",
            item: r,
            dueAmount: r.dueAmount,
          })),
        ...updatedAdditional
          .filter((a) => a.dueAmount > 0)
          .map((a) => ({
            type: "additional",
            item: a,
            dueAmount: a.dueAmount,
          })),
      ];

      allDuesToApplyConcession.sort((a, b) => {
        if (a.item.status === "Partial" && b.item.status !== "Partial")
          return -1;
        if (a.item.status !== "Partial" && b.item.status === "Partial")
          return 1;
        return 0;
      });

      if (remainingConcession > 0) {
        for (const dueItem of allDuesToApplyConcession) {
          if (dueItem.dueAmount > 0) {
            const concessionToApply = Math.min(
              remainingConcession,
              dueItem.dueAmount
            );
            dueItem.item.dueAmount -= concessionToApply;
            dueItem.item.concessionApplied =
              (dueItem.item.concessionApplied || 0) + concessionToApply;
            if (dueItem.item.dueAmount === 0) {
              dueItem.item.status = "Paid";
            }
            remainingConcession -= concessionToApply;
            if (remainingConcession <= 0) break;
          }
        }
      }

      const otherRegularDues = feeStatus.monthlyDues.regularDues.filter(
        (due) => !regularFees.some((r) => r.month === due.month)
      );
      const otherAdditionalDues = feeStatus.monthlyDues.additionalDues.filter(
        (due) =>
          !additionalFees.some(
            (a) =>
              a.name === due.name &&
              (a.month === due.month || (!a.month && !due.month))
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

      const totalRegularDuesAfter = feeStatus.monthlyDues.regularDues.reduce(
        (sum, d) => sum + d.dueAmount,
        0
      );
      const totalAdditionalDuesAfter =
        feeStatus.monthlyDues.additionalDues.reduce(
          (sum, d) => sum + d.dueAmount,
          0
        );
      feeStatus.dues =
        totalRegularDuesAfter + totalAdditionalDuesAfter + feeStatus.pastDues;

      feeReceiptNumber = await generateFeeReceiptNumber(schoolId);

      const concessionDetails = allDuesToApplyConcession
        .filter((item) => item.item.concessionApplied > 0)
        .map((item) => {
          if (item.type === "regular") {
            return `Regular Fee (${item.item.month}): ${item.item.concessionApplied}`;
          } else {
            return `${item.item.name} (${item.item.month || "N/A"}): ${
              item.item.concessionApplied
            }`;
          }
        })
        .join(", ");

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
                .map((a) => `${a.name} (${a.month || "N/A"}): ${a.paidAmount}`)
                .join(", ")
            : "None"
        }, ` +
        `Past Dues: ${paidPastDues}, ` +
        `Concession: ${roundedConcession}${
          concessionDetails ? ` (${concessionDetails})` : ""
        }, ` +
        `Remaining Dues: ${feeStatus.dues}`;

      feeStatus.feeHistory.push({
        date: new Date(),
        status: "active",
        regularFees: updatedRegular,
        additionalFees: updatedAdditional,
        pastDuesPaid,
        concessionApplied: roundedConcession,
        paymentMode: paymentMode || "Cash",
        transactionId: transactionId || "N/A",
        totalFeeAmount,
        totalAmountPaid: totalAmount,
        totalDues: feeStatus.dues,
        remark,
        feeReceiptNumber,
        paymentMessage,
        previousDues: previousDuesValue,
      });

      feeStatus.overallAmountPaid =
        (feeStatus.overallAmountPaid || 0) + parseFloat(totalAmount);
      feeStatus.overallConcessionApplied =
        (feeStatus.overallConcessionApplied || 0) + roundedConcession;
    } else if (mode === "manual") {
      let remaining = totalAmount;
      const paidPastDues = Math.min(pastDuesPaid, totalPastDues);
      remaining -= paidPastDues;
      const roundedConcession = Math.round(concession);
      let remainingConcession = roundedConcession;

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
          status: due.dueAmount - paidAmount === 0 ? "Paid" : "Partial",
        };
        updatedRegular.push(updatedDue);
      });

      const updatedAdditional = [];
      additionalFees.forEach((a) => {
        let due = feeStatus.monthlyDues.additionalDues.find(
          (d) =>
            d.name === a.name && (d.month === a.month || (!d.month && !a.month))
        );
        if (!due) {
          if (!additionalFeeMap[a.name]) {
            throw new Error(`Invalid additional fee name: ${a.name}`);
          }
          due = {
            name: a.name,
            month: a.month || undefined,
            paidAmount: 0,
            dueAmount: additionalFeeMap[a.name].amount,
            status: "Unpaid",
          };
        }
        const paidAmount = parseFloat(a.paidAmount) || 0;
        if (paidAmount > due.dueAmount) {
          throw new Error(
            `Payment for ${a.name} (${
              a.month || "N/A"
            }) (₹${paidAmount}) exceeds remaining dues (₹${due.dueAmount}).`
          );
        }
        const updatedDue = {
          name: due.name,
          month: due.month || undefined,
          paidAmount: due.paidAmount + paidAmount,
          dueAmount: Math.max(0, due.dueAmount - paidAmount),
          status: due.dueAmount - paidAmount === 0 ? "Paid" : "Partial",
        };
        updatedAdditional.push(updatedDue);
      });

      const allDuesToApplyConcession = [
        ...updatedRegular
          .filter((r) => r.dueAmount > 0)
          .map((r) => ({ type: "regular", item: r, dueAmount: r.dueAmount })),
        ...updatedAdditional
          .filter((a) => a.dueAmount > 0)
          .map((a) => ({
            type: "additional",
            item: a,
            dueAmount: a.dueAmount,
          })),
      ];

      allDuesToApplyConcession.sort((a, b) => {
        if (a.item.status === "Partial" && b.item.status !== "Partial")
          return -1;
        if (a.item.status !== "Partial" && b.item.status === "Partial")
          return 1;
        return 0;
      });

      if (remainingConcession > 0) {
        for (const dueItem of allDuesToApplyConcession) {
          if (dueItem.dueAmount > 0) {
            const concessionToApply = Math.min(
              remainingConcession,
              dueItem.dueAmount
            );
            dueItem.item.dueAmount -= concessionToApply;
            dueItem.item.concessionApplied =
              (dueItem.item.concessionApplied || 0) + concessionToApply;
            if (dueItem.item.dueAmount === 0) {
              dueItem.item.status = "Paid";
            }
            remainingConcession -= concessionToApply;
            if (remainingConcession <= 0) break;
          }
        }
      }

      const otherRegularDues = feeStatus.monthlyDues.regularDues.filter(
        (due) => !regularFees.some((r) => r.month === due.month)
      );
      const otherAdditionalDues = feeStatus.monthlyDues.additionalDues.filter(
        (due) =>
          !additionalFees.some(
            (a) =>
              a.name === due.name &&
              (a.month === a.month || (!a.month && !due.month))
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
        feeStatus.pastDues;

      feeReceiptNumber = await generateFeeReceiptNumber(schoolId);
      const concessionDetails = allDuesToApplyConcession
        .filter((item) => item.item.concessionApplied > 0)
        .map((item) => {
          if (item.type === "regular") {
            return `Regular Fee (${item.item.month}): ${item.item.concessionApplied}`;
          } else {
            return `${item.item.name} (${item.item.month || "N/A"}): ${
              item.item.concessionApplied
            }`;
          }
        })
        .join(", ");
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
                .map((a) => `${a.name} (${a.month || "N/A"}): ${a.paidAmount}`)
                .join(", ")
            : "None"
        }, ` +
        `Past Dues: ${paidPastDues}, ` +
        `Concession: ${roundedConcession}${
          concessionDetails ? ` (${concessionDetails})` : ""
        }, ` +
        `Remaining Dues: ${feeStatus.dues}`;

      feeStatus.feeHistory.push({
        date: new Date(),
        status: "active",
        regularFees: updatedRegular,
        additionalFees: updatedAdditional,
        pastDuesPaid,
        concessionApplied: roundedConcession,
        paymentMode: paymentMode || "Cash",
        transactionId: transactionId || "N/A",
        totalFeeAmount,
        totalAmountPaid: totalAmount,
        totalDues: feeStatus.dues,
        remark,
        feeReceiptNumber,
        paymentMessage,
        previousDues: previousDuesValue,
      });

      feeStatus.overallAmountPaid =
        (feeStatus.overallAmountPaid || 0) + parseFloat(totalAmount);
      feeStatus.overallConcessionApplied =
        (feeStatus.overallConcessionApplied || 0) + roundedConcession;
    }

    await feeStatus.save();

    // Create feeReceipt object
    const latestFeeHistory =
      feeStatus.feeHistory[feeStatus.feeHistory.length - 1];
    const feeReceipt = {
      studentId: student.studentId,
      studentName: student.studentName,
      studentClass: student.class,
      parentContact: parent.contact,
      admissionNumber: student.admissionNumber,
      fatherName: parent.fatherName,
      feeReceiptNumber: feeReceiptNumber,
      paymentMode: latestFeeHistory.paymentMode,
      dues: latestFeeHistory.totalDues,
      date: latestFeeHistory.date,
      status: latestFeeHistory.status,
      regularFees: latestFeeHistory.regularFees.map((fee) => ({
        month: fee.month,
        paidAmount: fee.paidAmount,
        dueAmount: fee.dueAmount,
        status: fee.status,
      })),
      additionalFees: latestFeeHistory.additionalFees.map((fee) => ({
        name: fee.name,
        month: fee.month || "N/A",
        paidAmount: fee.paidAmount,
        dueAmount: fee.dueAmount,
        status: fee.status,
      })),
      transactionId: latestFeeHistory.transactionId,
      totalFeeAmount: latestFeeHistory.totalFeeAmount,
      pastDuesPaid: latestFeeHistory.pastDuesPaid,
      duesPaid: totalDuesBefore - latestFeeHistory.totalDues, // Calculated as dues cleared in this payment
      previousDues: latestFeeHistory.previousDues,
      remark: latestFeeHistory.remark || "",
      totalAmountPaid: latestFeeHistory.totalAmountPaid,
      totalDues: latestFeeHistory.totalDues,
      concessionFee: 0, // Assuming no separate concession fee unless specified
      lateFinesPaid: 0, // Assuming no late fines unless specified
      concessionApplied: latestFeeHistory.concessionApplied,
      paymentMessage: latestFeeHistory.paymentMessage,
      paidAfterConcession: 0, // Assuming no separate post-concession amount unless specified
      newPaidAmount: latestFeeHistory.totalAmountPaid, // Assuming this is the total amount paid
      lateFines: [], // Assuming no late fines unless specified
    };

    res.status(201).json({
      success: true,
      message: "Fee payment processed successfully",
      data: {
        feeReceiptNumber,
        feeStatus,
        studentAdmissionNumber: student.admissionNumber,
        studentName: student.studentName,
        fatherContact: student.parentContact,
        parentContact: parent.contact,
        feeReceipt, // Adding the new feeReceipt object
      },
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
              ? "Partial"
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
              ? "Partial"
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
        status = totalPaid > 0 ? "Partial" : "Unpaid";
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
    const session = req.user.session; // Assuming session is available in the token

    // Validate session presence (optional, depending on your requirements)
    if (!session) {
      return res.status(400).json({
        success: false,
        message: "Session not found in user token.",
      });
    }

    let filter = {
      schoolId: req.user.schoolId,
      session, // Add session to the filter
      ...(studentId ? { studentId } : {}),
    };

    const feeStatusData = await FeeStatus.find(filter).exec();
    let feeHistory = [];

    for (const feeStatus of feeStatusData) {
      const studentData = await NewStudentModel.findOne(
        { studentId: feeStatus.studentId },
        "studentName class studentId parentId admissionNumber fatherName" // Added admissionNumber and fatherName
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
            admissionNumber: studentData.admissionNumber, // Added admissionNumber
            fatherName: studentData.fatherName, // Added fatherName
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
    const { studentId, session } = req.query;
    const schoolId = req.user.schoolId;
    const currentDate = new Date();

    if (!studentId || !session) {
      return res.status(400).json({
        success: false,
        message: "Student ID and session are required.",
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

    const parent = await ParentModel.findOne({
      schoolId,
      parentId: student.parentId,
    }).lean();
    const fees = await getAllApplicableFees(
      schoolId,
      student.class,
      studentId,
      session
    );

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
        monthlyDues: { regularDues: [], additionalDues: [], lateFines: [] },
        pastDues: 0,
        dues: 0,
        feeHistory: [],
      };
    }

    const regularFees = fees.filter((f) => !f.additional);
    const additionalFees = fees.filter((f) => f.additional);
    const lateFines = await applyLateFines(feeStatus, fees, currentDate);

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

    const monthlyStatus = months.map((month) => {
      const regularDue = feeStatus.monthlyDues.regularDues.find(
        (d) => d.month === month
      ) || {
        paidAmount: 0,
        dueAmount: regularFees[0]?.amount || 0,
        status: "Unpaid",
        frequency: regularFees[0]?.frequency || "monthly",
      };
      const additionalDues = additionalFees.map((fee) => {
        const addDue = feeStatus.monthlyDues.additionalDues.find(
          (d) =>
            d.name === fee.name && (d.month === month || (!d.month && !month))
        ) || {
          name: fee.name,
          paidAmount: 0,
          dueAmount:
            fee.frequency === "one-time" &&
            feeStatus.monthlyDues.additionalDues.some(
              (d) => d.name === fee.name && d.status === "Paid"
            )
              ? 0
              : fee.amount,
          status: "Unpaid",
          frequency: fee.frequency,
        };
        return {
          name: fee.name,
          amount: fee.amount,
          paid: addDue.paidAmount,
          due: addDue.dueAmount,
          status: addDue.status,
          feeType: fee.feeType,
          frequency: fee.frequency,
        };
      });

      return {
        month,
        regularFee: {
          amount: regularFees[0]?.amount || 0,
          paid: regularDue.paidAmount,
          due:
            regularDue.frequency === "one-time" &&
            feeStatus.monthlyDues.regularDues.some((d) => d.status === "Paid")
              ? 0
              : regularDue.dueAmount,
          status: regularDue.status,
          frequency: regularDue.frequency,
        },
        additionalFees: additionalDues,
      };
    });

    res.status(200).json({
      success: true,
      message: "Fee information retrieved successfully.",
      data: {
        student,
        parent,
        feeStructure: {
          regularFees,
          additionalFees,
        },
        feeStatus: {
          ...feeStatus,
          monthlyDues: {
            ...feeStatus.monthlyDues,
            lateFines,
          },
        },
        monthlyStatus,
        pendingMonths: monthlyStatus
          .filter(
            (m) =>
              m.regularFee.due > 0 || m.additionalFees.some((af) => af.due > 0)
          )
          .map((m) => m.month),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve fee information.",
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

exports.getFees = async (req, res) => {
  try {
    const {
      type,
      studentId,
      session,
      month,
      includeFeeHistory = true,
      includeMonthlyDues = true,
      includeStudentDetails = true,
      includeParentDetails = true,
    } = req.query;
    const schoolId = req.user.schoolId;

    if (!type) {
      return res
        .status(400)
        .json({ success: false, message: "Type is required" });
    }

    switch (type) {
      case "monthlyDues":
        // Merges getMonthlyDues and getFeeStatusByMonth
        if (!studentId || !session) {
          return res.status(400).json({
            success: false,
            message:
              "Student ID and session are required for type 'monthlyDues'",
          });
        }
        const feeStatusMonthly = await FeeStatus.findOne({
          schoolId,
          studentId,
          session,
        }).lean();
        if (!feeStatusMonthly) {
          return res
            .status(404)
            .json({ success: false, message: "No fee status found" });
        }
        let monthlyDues;
        if (month) {
          // Logic from getFeeStatusByMonth for a specific month
          const regularDues = feeStatusMonthly.monthlyDues.regularDues.filter(
            (d) => d.month === month
          );
          const additionalDues =
            feeStatusMonthly.monthlyDues.additionalDues.filter(
              (d) => d.month === month
            );
          monthlyDues = {
            regularDues,
            additionalDues,
            lateFines: feeStatusMonthly.totalLateFines,
            pastDues: feeStatusMonthly.pastDues,
            totalDues: feeStatusMonthly.dues,
          };
        } else {
          // Logic from getMonthlyDues for all months
          monthlyDues = {
            regularDues: feeStatusMonthly.monthlyDues.regularDues,
            additionalDues: feeStatusMonthly.monthlyDues.additionalDues,
            lateFines: feeStatusMonthly.totalLateFines,
            pastDues: feeStatusMonthly.pastDues,
            totalDues: feeStatusMonthly.dues,
          };
        }
        return res.status(200).json({
          success: true,
          message: "Monthly dues fetched successfully",
          data: monthlyDues,
        });

      case "incomeMonths":
        // Logic from feeIncomeMonths
        const feesDataIncome = await FeeStatus.find({ schoolId }).lean();
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
        for (const feeStatus of feesDataIncome) {
          for (const feeHistoryEntry of feeStatus.feeHistory) {
            const date = new Date(feeHistoryEntry.date);
            const monthName = date.toLocaleString("en-US", { month: "long" });
            const monthIndex = monthToIndex[monthName];
            if (monthIndex !== undefined) {
              arr[monthIndex] += Number(feeHistoryEntry.totalAmountPaid) || 0;
            }
          }
        }
        return res.status(200).json({
          success: true,
          message: "Fee income data retrieved successfully",
          data: arr,
        });

      case "allStudentsStatus":
        // Logic from getAllStudentsFeeStatus
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
        const studentsWithFeeStatus = await Promise.all(
          students.map(async (student) => {
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
          })
        );
        return res.status(200).json({
          success: true,
          message: "Student fee status data retrieved successfully",
          data: studentsWithFeeStatus,
        });

      case "studentHistory":
        // Logic from getStudentFeeHistory
        if (!studentId) {
          return res
            .status(400)
            .json({ success: false, message: "Student ID is required" });
        }
        const feeStatusStudentHistory = await FeeStatus.findOne({
          schoolId,
          studentId,
          ...(session ? { session } : {}),
        }).lean();
        if (!feeStatusStudentHistory) {
          return res.status(404).json({
            success: false,
            message: "No fee status found for this student",
          });
        }
        const studentHistory = await NewStudentModel.findOne({
          schoolId,
          studentId,
        }).lean();
        if (!studentHistory) {
          return res
            .status(404)
            .json({ success: false, message: "Student not found" });
        }
        const parentHistory = studentHistory.parentId
          ? await ParentModel.findOne({
              schoolId,
              parentId: studentHistory.parentId,
            }).lean()
          : null;
        return res.status(200).json({
          success: true,
          message: "Student fee history retrieved successfully",
          data: {
            studentDetails: {
              ...studentHistory,
              parentContact: parentHistory?.contact || null,
            },
            feeHistory: feeStatusStudentHistory.feeHistory,
            monthlyDues: feeStatusStudentHistory.monthlyDues,
            totalDues: feeStatusStudentHistory.dues,
          },
        });

      case "studentInfo":
        // Logic from getStudentFeeInfo
        if (!studentId || !session) {
          return res.status(400).json({
            success: false,
            message:
              "Student ID and session are required for type 'studentInfo'",
          });
        }
        let studentInfo;
        if (includeStudentDetails) {
          studentInfo = await NewStudentModel.findOne({
            schoolId,
            studentId,
          }).lean();
          if (!studentInfo) {
            return res
              .status(404)
              .json({ success: false, message: "Student not found" });
          }
        }
        let parentInfo;
        if (includeParentDetails && studentInfo?.parentId) {
          parentInfo = await ParentModel.findOne({
            schoolId,
            parentId: studentInfo.parentId,
          }).lean();
        }
        const fees = await getFeesForClass(
          schoolId,
          studentInfo?.class,
          studentId
        );
        const regularFees = fees.filter((f) => !f.additional);
        const additionalFees = fees.filter(
          (f) => f.additional && f.feeType !== "LateFine"
        );
        const lateFineConfig = fees.find((f) => f.feeType === "LateFine");
        let feeStatusInfo = await FeeStatus.findOne({
          schoolId,
          studentId,
          session,
        }).lean();
        if (!feeStatusInfo) {
          feeStatusInfo = {
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
        const currentDate = new Date();
        let lateFines = [];
        if (
          lateFineConfig &&
          currentDate.getDate() > lateFineConfig.lateFineDueDay
        ) {
          feeStatusInfo.monthlyDues.regularDues.forEach((d) => {
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
        const totalLateFines = lateFines.reduce(
          (sum, lf) => sum + lf.dueAmount,
          0
        );
        const monthlyStatus = months.map((month) => {
          const regularDue =
            feeStatusInfo.monthlyDues.regularDues.find(
              (d) => d.month === month
            ) || null;
          const additionalDues =
            feeStatusInfo.monthlyDues.additionalDues.filter(
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
        return res.status(200).json({
          success: true,
          message: "Fee information retrieved successfully",
          data: {
            ...(includeStudentDetails && { student: studentInfo }),
            ...(includeParentDetails && { parent: parentInfo }),
            feeStructure: {
              regularFees,
              additionalFees,
              lateFine: lateFineConfig,
            },
            feeStatus: {
              ...feeStatusInfo,
              totalLateFines: feeStatusInfo.totalLateFines || totalLateFines,
            },
            ...(includeMonthlyDues && { monthlyStatus }),
            pendingMonths: monthlyStatus
              .filter(
                (m) =>
                  m.regularFee.due > 0 ||
                  m.additionalFees.some((af) => af.due > 0)
              )
              .map((m) => m.month),
          },
        });

      case "historyAndDues":
        // Logic from getFeeHistoryAndDues
        if (!studentId) {
          return res
            .status(400)
            .json({ success: false, message: "Student ID is required" });
        }
        const feeStatusHistoryDues = await FeeStatus.findOne({
          schoolId,
          studentId,
          ...(session ? { session } : {}),
        }).lean();
        if (!feeStatusHistoryDues) {
          return res
            .status(404)
            .json({ success: false, message: "No fee status found" });
        }
        const studentHD = await NewStudentModel.findOne({
          schoolId,
          studentId,
        }).lean();
        if (!studentHD) {
          return res
            .status(404)
            .json({ success: false, message: "Student not found" });
        }
        const parentHD = studentHD.parentId
          ? await ParentModel.findOne({
              schoolId,
              parentId: studentHD.parentId,
            }).lean()
          : null;
        return res.status(200).json({
          success: true,
          message: "Fee history and dues retrieved successfully",
          data: {
            student: { ...studentHD, parentContact: parentHD?.contact || null },
            feeStatus: feeStatusHistoryDues,
          },
        });

      default:
        return res
          .status(400)
          .json({ success: false, message: "Invalid type" });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve fee data",
      error: error.message,
    });
  }
};

exports.generateUnifiedFeeReceipt = async (req, res) => {
  try {
    const { studentIds, session, paymentDetails } = req.body;
    const schoolId = req.user.schoolId;
    const currentDate = new Date();

    // Validate input
    if (
      !studentIds ||
      !Array.isArray(studentIds) ||
      studentIds.length < 2 ||
      !session ||
      !paymentDetails ||
      !Array.isArray(paymentDetails)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Student IDs (array with at least 2 students), session, and paymentDetails (array) are required.",
      });
    }

    // Fetch students
    const students = await NewStudentModel.find({
      schoolId,
      studentId: { $in: studentIds },
    }).lean();
    if (students.length !== studentIds.length) {
      return res
        .status(404)
        .json({ success: false, message: "One or more students not found." });
    }

    // Verify same parent
    const parentId = students[0].parentId;
    if (!students.every((s) => s.parentId === parentId)) {
      return res.status(400).json({
        success: false,
        message:
          "All students must belong to the same parent for unified receipt.",
      });
    }

    const parent = await ParentModel.findOne({ schoolId, parentId }).lean();
    if (!parent) {
      return res
        .status(404)
        .json({ success: false, message: "Parent not found." });
    }

    let unifiedReceiptNumber = await generateUnifiedReceiptNumber(schoolId);
    let totalAmountPaid = 0;
    let totalDuesBefore = 0;
    let totalDuesAfter = 0;
    let totalConcession = 0;
    let totalPastDuesPaid = 0;

    const receiptDetails = await Promise.all(
      studentIds.map(async (studentId, index) => {
        const studentPayment = paymentDetails.find(
          (p) => p.studentId === studentId
        );
        if (!studentPayment) {
          throw new Error(`Payment details missing for student ${studentId}`);
        }

        const {
          regularFees = [],
          additionalFees = [],
          pastDuesPaid = 0,
          concession = 0,
          totalAmount,
          paymentMode,
          transactionId,
          remark,
        } = studentPayment;

        let feeStatus = await FeeStatus.findOne({
          schoolId,
          studentId,
          session,
        });
        const student = students.find((s) => s.studentId === studentId);

        if (!feeStatus) {
          feeStatus = new FeeStatus({
            schoolId,
            studentId,
            session,
            year: session.split("-")[0],
            monthlyDues: { regularDues: [], additionalDues: [] },
            pastDues: 0,
            dues: 0,
            feeHistory: [],
            overallAmountPaid: 0,
            overallConcessionApplied: 0,
          });
        }

        const fees = await getAllApplicableFees(
          schoolId,
          student.class,
          studentId,
          session
        );
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
          .filter((f) => f.additional)
          .reduce((map, f) => {
            map[f.name] = { amount: f.amount, type: f.feeType };
            return map;
          }, {});

        // Calculate dues before payment
        const totalPastDues = feeStatus.pastDues || 0;
        const totalRegularDues = feeStatus.monthlyDues.regularDues.reduce(
          (sum, d) => sum + d.dueAmount,
          0
        );
        const totalAdditionalDues = feeStatus.monthlyDues.additionalDues.reduce(
          (sum, d) => sum + d.dueAmount,
          0
        );
        const totalDuesBeforeStudent =
          totalPastDues + totalRegularDues + totalAdditionalDues;
        totalDuesBefore += totalDuesBeforeStudent;

        // Payment distribution
        let remaining = parseFloat(totalAmount);
        const roundedConcession = Math.round(concession);
        let remainingConcession = roundedConcession;
        const paidPastDues = Math.min(remaining, totalPastDues);
        remaining -= paidPastDues;

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
            due.paidAmount += maxPayment;
            due.dueAmount -= maxPayment;
            due.status = due.dueAmount === 0 ? "Paid" : "Partial";
            remaining -= maxPayment;
          }
          updatedRegular.push(due);
        });

        const updatedAdditional = [];
        additionalFees.forEach((a) => {
          let due = feeStatus.monthlyDues.additionalDues.find(
            (d) =>
              d.name === a.name &&
              (d.month === a.month || (!d.month && !a.month))
          );
          if (!due && additionalFeeMap[a.name]) {
            due = {
              name: a.name,
              month: a.month || undefined,
              paidAmount: 0,
              dueAmount: additionalFeeMap[a.name].amount,
              status: "Unpaid",
            };
          }
          if (due && remaining > 0) {
            const maxPayment = Math.min(remaining, due.dueAmount);
            due.paidAmount += maxPayment;
            due.dueAmount -= maxPayment;
            due.status = due.dueAmount === 0 ? "Paid" : "Partial";
            remaining -= maxPayment;
          }
          updatedAdditional.push(due);
        });

        const allDuesToApplyConcession = [
          ...updatedRegular.map((r) => ({
            type: "regular",
            item: r,
            dueAmount: r.dueAmount,
          })),
          ...updatedAdditional.map((a) => ({
            type: "additional",
            item: a,
            dueAmount: a.dueAmount,
          })),
        ].sort((a, b) =>
          a.item.status === "Partial" && b.item.status !== "Partial" ? -1 : 1
        );

        if (remainingConcession > 0) {
          for (const dueItem of allDuesToApplyConcession) {
            if (dueItem.dueAmount > 0) {
              const concessionToApply = Math.min(
                remainingConcession,
                dueItem.dueAmount
              );
              dueItem.item.dueAmount -= concessionToApply;
              dueItem.item.concessionApplied =
                (dueItem.item.concessionApplied || 0) + concessionToApply;
              dueItem.item.status =
                dueItem.item.dueAmount === 0 ? "Paid" : "Partial";
              remainingConcession -= concessionToApply;
              if (remainingConcession <= 0) break;
            }
          }
        }

        const otherRegularDues = feeStatus.monthlyDues.regularDues.filter(
          (due) => !regularFees.some((r) => r.month === due.month)
        );
        const otherAdditionalDues = feeStatus.monthlyDues.additionalDues.filter(
          (due) =>
            !additionalFees.some(
              (a) =>
                a.name === due.name &&
                (a.month === due.month || (!a.month && !due.month))
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
          feeStatus.pastDues;
        totalDuesAfter += feeStatus.dues;

        const feeReceiptNumber = await generateFeeReceiptNumber(schoolId);
        const paymentMessage =
          `Paid ${totalAmount} on ${currentDate.toLocaleDateString()}: ` +
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
                  .map(
                    (a) => `${a.name} (${a.month || "N/A"}): ${a.paidAmount}`
                  )
                  .join(", ")
              : "None"
          }, ` +
          `Past Dues: ${paidPastDues}, Concession: ${roundedConcession}, Remaining Dues: ${feeStatus.dues}`;

        feeStatus.feeHistory.push({
          date: currentDate,
          status: "active",
          regularFees: updatedRegular,
          additionalFees: updatedAdditional,
          pastDuesPaid,
          concessionApplied: roundedConcession,
          paymentMode: paymentMode || "Cash",
          transactionId: transactionId || "N/A",
          totalFeeAmount: totalDuesBeforeStudent,
          totalAmountPaid: totalAmount,
          totalDues: feeStatus.dues,
          remark,
          feeReceiptNumber,
          paymentMessage,
          previousDues: totalDuesBeforeStudent,
          unifiedReceiptNumber,
        });

        feeStatus.overallAmountPaid =
          (feeStatus.overallAmountPaid || 0) + parseFloat(totalAmount);
        feeStatus.overallConcessionApplied =
          (feeStatus.overallConcessionApplied || 0) + roundedConcession;
        await feeStatus.save();

        totalAmountPaid += parseFloat(totalAmount);
        totalConcession += roundedConcession;
        totalPastDuesPaid += paidPastDues;

        return {
          studentId,
          studentName: student.studentName,
          class: student.class,
          admissionNumber: student.admissionNumber,
          regularFees: updatedRegular,
          additionalFees: updatedAdditional,
          pastDuesPaid,
          concession: roundedConcession,
          totalAmount,
          feeReceiptNumber,
        };
      })
    );

    const unifiedReceipt = {
      unifiedReceiptNumber,
      parentId,
      parentName: parent.fatherName,
      parentContact: parent.contact,
      students: receiptDetails,
      totalAmountPaid,
      totalConcession,
      totalPastDuesPaid,
      totalDuesBefore,
      totalDuesAfter,
      paymentMode: paymentDetails[0]?.paymentMode || "Cash",
      transactionId: paymentDetails[0]?.transactionId || "N/A",
      date: currentDate,
      session,
      schoolId,
      remark: paymentDetails[0]?.remark,
    };

    await UnifiedReceipt.create(unifiedReceipt);

    res.status(201).json({
      success: true,
      message: "Unified fee receipt generated successfully.",
      data: unifiedReceipt,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate unified fee receipt.",
      error: error.message,
    });
  }
};

exports.generateFormattedFeeReceipt = async (req, res) => {
  try {
    const { receiptNumber } = req.params;
    const schoolId = req.user.schoolId;

    if (!receiptNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Receipt number is required." });
    }

    const school = await AdminInfo.findOne({ schoolId }).lean();
    if (!school) {
      return res
        .status(404)
        .json({ success: false, message: "School details not found." });
    }

    let receiptData = {};

    // Check for individual receipt
    const feeStatus = await FeeStatus.findOne({
      schoolId,
      "feeHistory.feeReceiptNumber": receiptNumber,
    }).lean();
    if (feeStatus) {
      const student = await NewStudentModel.findOne({
        schoolId,
        studentId: feeStatus.studentId,
      }).lean();
      if (!student) {
        return res
          .status(404)
          .json({ success: false, message: "Student not found." });
      }

      const feeHistory = feeStatus.feeHistory.find(
        (h) => h.feeReceiptNumber === receiptNumber
      );
      if (!feeHistory) {
        return res
          .status(404)
          .json({ success: false, message: "Fee history entry not found." });
      }

      const parent = await ParentModel.findOne({
        schoolId,
        parentId: student.parentId,
      }).lean();
      if (!parent) {
        return res
          .status(404)
          .json({ success: false, message: "Parent not found." });
      }

      receiptData = {
        type: "individual",
        receiptNumber: feeHistory.feeReceiptNumber,
        unifiedReceiptNumber: feeHistory.unifiedReceiptNumber || null,
        school: {
          name: school.schoolName || "N/A",
          address: `${school.address || ""}, ${school.schoolCity || ""}, ${
            school.schoolState || ""
          } - ${school.pincode || ""}`,
          contact: school.contact || "N/A",
          logo: school.logoImage || null,
        },
        studentName: student.studentName || "N/A",
        studentClass: student.class || "N/A",
        admissionNumber: student.admissionNumber || "N/A",
        fatherName: parent.fatherName || "N/A",
        parentContact: parent.contact || "N/A",
        regularFees: feeHistory.regularFees.map((f) => ({
          month: f.month,
          paidAmount: f.paidAmount || 0,
          dueAmount: f.dueAmount || 0,
          status: f.status || "Unpaid",
        })),
        additionalFees: feeHistory.additionalFees.map((f) => ({
          name: f.name,
          month: f.month || "N/A",
          paidAmount: f.paidAmount || 0,
          dueAmount: f.dueAmount || 0,
          status: f.status || "Unpaid",
        })),
        totalFeeAmount: feeHistory.totalFeeAmount || 0,
        totalAmountPaid: feeHistory.totalAmountPaid || 0,
        totalDues: feeHistory.totalDues || 0,
        pastDuesPaid: feeHistory.pastDuesPaid || 0,
        concessionApplied: feeHistory.concessionApplied || 0,
        paymentMode: feeHistory.paymentMode || "N/A",
        transactionId: feeHistory.transactionId || "N/A",
        date: feeHistory.date
          ? new Date(feeHistory.date).toISOString()
          : new Date().toISOString(),
        session: feeStatus.session || "N/A",
        status: feeHistory.status || "Pending",
        remark: feeHistory.remark || "",
      };
    } else {
      // Check for unified receipt
      const unifiedReceipt = await UnifiedReceipt.findOne({
        schoolId,
        unifiedReceiptNumber: receiptNumber,
      }).lean();
      if (!unifiedReceipt) {
        return res
          .status(404)
          .json({ success: false, message: "Receipt not found." });
      }

      receiptData = {
        type: "unified",
        receiptNumber: unifiedReceipt.unifiedReceiptNumber,
        school: {
          name: school.schoolName || "N/A",
          address: `${school.address || ""}, ${school.schoolCity || ""}, ${
            school.schoolState || ""
          } - ${school.pincode || ""}`,
          contact: school.contact || "N/A",
          logo: school.logoImage || null,
        },
        fatherName: unifiedReceipt.parentName || "N/A",
        parentContact: unifiedReceipt.parentContact || "N/A",
        students: unifiedReceipt.students.map((s) => ({
          studentName: s.studentName || "N/A",
          studentClass: s.class || "N/A",
          admissionNumber: s.admissionNumber || "N/A",
          regularFees: s.regularFees.map((f) => ({
            month: f.month,
            paidAmount: f.paidAmount || 0,
            dueAmount: f.dueAmount || 0,
            status: f.status || "Unpaid",
          })),
          additionalFees: s.additionalFees.map((f) => ({
            name: f.name,
            month: f.month || "N/A",
            paidAmount: f.paidAmount || 0,
            dueAmount: f.dueAmount || 0,
            status: f.status || "Unpaid",
          })),
          pastDuesPaid: s.pastDuesPaid || 0,
          concessionApplied: s.concession || 0,
          totalAmountPaid: s.totalAmount || 0,
        })),
        totalFeeAmount: unifiedReceipt.totalDuesBefore || 0,
        totalAmountPaid: unifiedReceipt.totalAmountPaid || 0,
        totalDues: unifiedReceipt.totalDuesAfter || 0,
        pastDuesPaid: unifiedReceipt.totalPastDuesPaid || 0,
        concessionApplied: unifiedReceipt.totalConcession || 0,
        paymentMode: unifiedReceipt.paymentMode || "N/A",
        transactionId: unifiedReceipt.transactionId || "N/A",
        date: unifiedReceipt.date
          ? new Date(unifiedReceipt.date).toISOString()
          : new Date().toISOString(),
        session: unifiedReceipt.session || "N/A",
        status: "active",
        remark: unifiedReceipt.remark || "",
      };
    }

    res.status(200).json({
      success: true,
      message: "Formatted fee receipt generated successfully.",
      data: receiptData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate formatted receipt.",
      error: error.message,
    });
  }
};
