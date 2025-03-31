// ABOVE CODE WORKING WELL TO REVERT
const mongoose = require("mongoose");
const NewStudentModel = require("../models/newStudentModel");
const FeeStatus = require("../models/feeStatus");
const FeeStructure = require("../models/feeStructureModel");
const ParentModel = require("../models/parentModel");
const { generateStructuredNumber } = require("../utils/numberGenerator"); // Adjust path as needed

// Helper function to generate a structured fee receipt number
const generateFeeReceiptNumber = async (schoolId) => {
  console.log(`Generating fee receipt number for schoolId: ${schoolId}`);
  try {
    const receiptNumber = await generateStructuredNumber(
      schoolId,
      FeeStatus,
      "feeHistory.feeReceiptNumber"
    );
    console.log(`Generated receipt number: ${receiptNumber}`);
    return receiptNumber;
  } catch (error) {
    console.error("Error generating fee receipt number:", error.message);
    throw error;
  }
};

// Add past dues
exports.addPastDues = async (req, res) => {
  try {
    const { students } = req.body; // Expecting an array of { studentId, pastDuesAmount, session }
    const schoolId = req.user.schoolId;

    if (!schoolId) {
      return res
        .status(400)
        .json({ success: false, message: "School ID is required." });
    }
    if (!Array.isArray(students) || students.length === 0) {
      return res
        .status(400)
        .json({
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
      return res
        .status(400)
        .json({
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

// Fetch fees for a class
async function getFeesForClass(schoolId, className, studentId = null) {
  try {
    console.log(
      `Fetching fees for schoolId: ${schoolId}, className: ${className}, studentId: ${studentId}`
    );
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
      const additionalMessage = studentId ? ` or student ${studentId}` : "";
      throw new Error(
        `No fee structure found for class ${className}${additionalMessage}`
      );
    }
    console.log(`Found fees: ${fees.length} entries`);
    return fees;
  } catch (error) {
    console.error("Error in getFeesForClass:", error.message);
    throw error;
  }
}

// Create or update fee payment
exports.createOrUpdateFeePayment = async (req, res) => {
  try {
    const { studentId, session, paymentDetails } = req.body;
    const schoolId = req.user.schoolId;

    // Validation
    if (
      !studentId ||
      !session ||
      !paymentDetails ||
      !paymentDetails.totalAmount
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Student ID, session, and totalAmount are required.",
        });
    }

    const student = await NewStudentModel.findOne({
      schoolId,
      studentId,
    }).lean();
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found." });

    const fees = await getFeesForClass(schoolId, student.class, studentId);
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

    // Fee mappings
    const regularFeeMap = {
      Monthly: fees.find((f) => !f.additional)?.amount || 0,
    };
    const additionalFeeMap = fees
      .filter((f) => f.additional && f.feeType !== "LateFine")
      .reduce((map, f) => {
        map[f.name] = f.amount;
        return map;
      }, {});
    const lateFineConfig = fees.find((f) => f.feeType === "LateFine");

    let feeStatus =
      (await FeeStatus.findOne({ schoolId, studentId, session })) ||
      new FeeStatus({
        schoolId,
        studentId,
        session,
        year: session.split("-")[0],
        monthlyDues: { regularDues: [], additionalDues: [] },
      });

    const {
      regularFees = [],
      additionalFees = [],
      pastDuesPaid = 0,
      lateFinesPaid, // Optional: manual late fine payment
      concession = 0,
      totalAmount,
      monthsToPay,
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

    // Apply late fines automatically if past due date
    const currentDate = new Date();
    const currentMonth = months[currentDate.getMonth()];
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
    const totalLateFinesBefore = lateFines.reduce(
      (sum, lf) => sum + lf.dueAmount,
      0
    );
    const totalDuesBefore =
      totalPastDues +
      totalRegularDues +
      totalAdditionalDues +
      totalLateFinesBefore;

    // Apply concession
    const totalPayable = Math.max(0, totalDuesBefore - concession);
    if (totalAmount > totalPayable) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Payment (${totalAmount}) exceeds total payable (${totalPayable}) after concession.`,
        });
    }

    // Payment distribution
    let updatedRegular = [],
      updatedAdditional = [],
      updatedLateFines = [...lateFines],
      paidPastDues = 0,
      paidLateFines = 0;
    let remaining = totalAmount;

    if (
      regularFees.length ||
      additionalFees.length ||
      pastDuesPaid ||
      lateFinesPaid !== undefined
    ) {
      // Manual mode
      const specifiedTotal =
        pastDuesPaid +
        (lateFinesPaid || 0) +
        regularFees.reduce((sum, r) => sum + r.paidAmount, 0) +
        additionalFees.reduce((sum, a) => sum + a.paidAmount, 0);
      if (specifiedTotal !== totalAmount) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Specified amounts (${specifiedTotal}) do not match totalAmount (${totalAmount}).`,
          });
      }

      // Past dues
      paidPastDues = Math.min(pastDuesPaid, totalPastDues);
      remaining -= paidPastDues;

      // Late fines (manual)
      if (lateFinesPaid !== undefined) {
        paidLateFines = Math.min(lateFinesPaid, totalLateFinesBefore);
        let remainingLateFines = paidLateFines;
        updatedLateFines.forEach((lf) => {
          const payment = Math.min(remainingLateFines, lf.dueAmount);
          lf.paidAmount += payment;
          lf.dueAmount -= payment;
          remainingLateFines -= payment;
        });
        remaining -= paidLateFines;
      } else {
        // Auto-pay late fines if not specified
        updatedLateFines.forEach((lf) => {
          const payment = Math.min(remaining, lf.dueAmount);
          lf.paidAmount += payment;
          lf.dueAmount -= payment;
          paidLateFines += payment;
          remaining -= payment;
        });
      }

      // Regular fees
      regularFees.forEach((r) => {
        let due = feeStatus.monthlyDues.regularDues.find(
          (d) => d.month === r.month
        ) || {
          month: r.month,
          paidAmount: 0,
          dueAmount: regularFeeMap.Monthly,
          status: "Unpaid",
        };
        due.paidAmount += r.paidAmount;
        due.dueAmount = Math.max(0, due.dueAmount - r.paidAmount);
        due.status = due.dueAmount === 0 ? "Paid" : "Partial Payment";
        if (!feeStatus.monthlyDues.regularDues.some((d) => d.month === r.month))
          feeStatus.monthlyDues.regularDues.push(due);
        updatedRegular.push({ ...due });
      });

      // Additional fees
      additionalFees.forEach((a) => {
        let due = feeStatus.monthlyDues.additionalDues.find(
          (d) => d.name === a.name && d.month === a.month
        ) || {
          name: a.name,
          month: a.month,
          paidAmount: 0,
          dueAmount: additionalFeeMap[a.name],
          status: "Unpaid",
        };
        due.paidAmount += a.paidAmount;
        due.dueAmount = Math.max(0, due.dueAmount - a.paidAmount);
        due.status = due.dueAmount === 0 ? "Paid" : "Partial Payment";
        if (
          !feeStatus.monthlyDues.additionalDues.some(
            (d) => d.name === a.name && d.month === a.month
          )
        )
          feeStatus.monthlyDues.additionalDues.push(due);
        updatedAdditional.push({ ...due });
      });
    } else {
      // Automatic mode
      paidPastDues = Math.min(remaining, totalPastDues);
      remaining -= paidPastDues;

      updatedLateFines.forEach((lf) => {
        const payment = Math.min(remaining, lf.dueAmount);
        lf.paidAmount += payment;
        lf.dueAmount -= payment;
        paidLateFines += payment;
        remaining -= payment;
      });

      (monthsToPay || months).forEach((month) => {
        if (remaining > 0) {
          let regDue = feeStatus.monthlyDues.regularDues.find(
            (d) => d.month === month
          );
          if (!regDue && regularFeeMap.Monthly) {
            regDue = {
              month,
              paidAmount: 0,
              dueAmount: regularFeeMap.Monthly,
              status: "Unpaid",
            };
            feeStatus.monthlyDues.regularDues.push(regDue);
          }
          if (regDue && remaining > 0) {
            const payment = Math.min(remaining, regDue.dueAmount);
            regDue.paidAmount += payment;
            regDue.dueAmount -= payment;
            regDue.status = regDue.dueAmount === 0 ? "Paid" : "Partial Payment";
            updatedRegular.push({ ...regDue });
            remaining -= payment;
          }

          Object.keys(additionalFeeMap).forEach((name) => {
            if (remaining > 0) {
              let addDue = feeStatus.monthlyDues.additionalDues.find(
                (d) => d.name === name && d.month === month
              ) || {
                name,
                month,
                paidAmount: 0,
                dueAmount: additionalFeeMap[name],
                status: "Unpaid",
              };
              const payment = Math.min(remaining, addDue.dueAmount);
              addDue.paidAmount += payment;
              addDue.dueAmount -= payment;
              addDue.status =
                addDue.dueAmount === 0 ? "Paid" : "Partial Payment";
              if (
                !feeStatus.monthlyDues.additionalDues.some(
                  (d) => d.name === name && d.month === a.month
                )
              )
                feeStatus.monthlyDues.additionalDues.push(addDue);
              updatedAdditional.push({ ...addDue });
              remaining -= payment;
            }
          });
        }
      });
    }

    // Update feeStatus
    feeStatus.pastDues = Math.max(0, totalPastDues - paidPastDues);
    feeStatus.totalLateFines = updatedLateFines.reduce(
      (sum, lf) => sum + lf.dueAmount,
      0
    );
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

    // Generate payment message
    const paymentMessage =
      `Paid ${totalAmount} on ${new Date().toLocaleDateString()}: ` +
      `Regular Fees - ${
        updatedRegular.map((r) => `${r.month}: ${r.paidAmount}`).join(", ") ||
        "None"
      }, ` +
      `Additional Fees - ${
        updatedAdditional
          .map((a) => `${a.name} (${a.month}): ${a.paidAmount}`)
          .join(", ") || "None"
      }, ` +
      `Past Dues: ${paidPastDues}, Late Fines: ${paidLateFines}, Concession: ${concession}, Remaining Dues: ${feeStatus.dues}`;

    // Save payment
    const feeReceiptNumber = await generateFeeReceiptNumber(schoolId);
    feeStatus.feeHistory.push({
      date: new Date(),
      status: "active",
      regularFees: updatedRegular,
      additionalFees: updatedAdditional,
      lateFines: updatedLateFines,
      pastDuesPaid: paidPastDues,
      concessionApplied: concession,
      paymentMessage,
      feeReceiptNumber,
      paymentMode: paymentMode || "Cash",
      transactionId: transactionId || "N/A",
      totalFeeAmount:
        totalRegularDues + totalAdditionalDues + totalLateFinesBefore,
      previousDues: totalDuesBefore,
      remark: remark || "",
      totalAmountPaid: totalAmount,
      totalDues: feeStatus.dues,
    });

    await feeStatus.save();

    res.status(201).json({
      success: true,
      message: "Fee payment processed successfully",
      data: { feeReceiptNumber, feeStatus },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to process payment",
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
      return res
        .status(404)
        .json({
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

// Get all students' MONTHLY DUES status
exports.getMonthlyDues = async (req, res) => {
  try {
    const { studentId, session } = req.query;
    const schoolId = req.user.schoolId;

    if (!studentId || !session) {
      return res
        .status(400)
        .json({
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
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch monthly dues",
        error: error.message,
      });
  }
};

// New endpoint to cancel a fee payment
exports.cancelFeePayment = async (req, res) => {
  try {
    const { studentId, feeReceiptNumber } = req.body;
    const schoolId = req.user.schoolId;

    console.log("cancelFeePayment called with:", {
      studentId,
      feeReceiptNumber,
      schoolId,
    });

    if (!schoolId) {
      return res
        .status(400)
        .json({ success: false, message: "School ID is required." });
    }
    if (!studentId || !feeReceiptNumber) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Student ID and Fee Receipt Number are required.",
        });
    }

    const feeStatus = await FeeStatus.findOne({ schoolId, studentId });
    if (!feeStatus) {
      return res
        .status(404)
        .json({
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

    // Mark the fee as canceled
    feeToCancel.status = "canceled";

    // Reverse the effects of this fee on monthlyDues
    feeToCancel.regularFees.forEach((canceledFee) => {
      const regularDue = feeStatus.monthlyDues.regularDues.find(
        (due) => due.month === canceledFee.month
      );
      if (regularDue) {
        regularDue.paidAmount = Math.max(
          0,
          (regularDue.paidAmount || 0) - canceledFee.paidAmount
        );
        regularDue.dueAmount += canceledFee.paidAmount; // Revert paid amount to dues
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
          due.name === canceledFee.name &&
          due.month === (canceledFee.month || "N/A")
      );
      if (additionalDue) {
        additionalDue.paidAmount = Math.max(
          0,
          (additionalDue.paidAmount || 0) - canceledFee.paidAmount
        );
        additionalDue.dueAmount += canceledFee.paidAmount; // Revert paid amount to dues
        additionalDue.status =
          additionalDue.dueAmount > 0
            ? additionalDue.paidAmount > 0
              ? "Partial Payment"
              : "Unpaid"
            : "Paid";
      }
    });

    // Recalculate pastDues and total dues based only on active fees
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

    const totalRegularDues = feeStatus.monthlyDues.regularDues.reduce(
      (sum, due) => sum + due.dueAmount,
      0
    );
    const totalAdditionalDues = feeStatus.monthlyDues.additionalDues.reduce(
      (sum, due) => sum + due.dueAmount,
      0
    );
    feeStatus.dues =
      totalRegularDues + totalAdditionalDues + feeStatus.pastDues;

    const updatedFeeStatus = await feeStatus.save();
    console.log(`Fee ${feeReceiptNumber} canceled successfully`);

    res.status(200).json({
      success: true,
      message: "Fee payment canceled successfully",
      data: updatedFeeStatus.toObject(),
    });
  } catch (error) {
    console.error("Error in cancelFeePayment:", error.message);
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
      return res
        .status(404)
        .json({ success: false, message: "No fee status found.", data: [] });
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
      return res
        .status(404)
        .json({
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
      return res
        .status(404)
        .json({
          success: false,
          message: "No fee status found for this student",
        });
    }

    const student = await NewStudentModel.findOne({
      studentId,
      schoolId,
    }).lean();
    if (!student) {
      return res
        .status(404)
        .json({
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
      return res
        .status(404)
        .json({
          success: false,
          message: "No fee status found for the provided student ID",
        });
    }

    const student = await NewStudentModel.findOne({
      schoolId: req.user.schoolId,
      studentId,
    }).lean();
    if (!student) {
      return res
        .status(404)
        .json({
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
