const mongoose = require("mongoose");
const NewStudentModel = require("../models/newStudentModel");
const FeeStatus = require("../models/feeStatus");
const FeeStructure = require("../models/feeStructureModel");
const ParentModel = require("../models/parentModel");
const UnifiedReceipt = require("../models/unifiedReceipt"); // New model
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

async function getAllApplicableFees(schoolId, className, studentId) {
  try {
    console.log("Fetching fees for:", schoolId, className, studentId);
    let allApplicableFees = [];

    // Step 1: Try to get student-specific regular fee first
    const studentRegularFee = await FeeStructure.findOne({
      schoolId,
      studentId,
      additional: false,
    }).lean();

    // Step 2: If no student-specific regular fee, get the class-level regular fee
    let regularFee;
    if (studentRegularFee) {
      console.log("Found student-specific regular fee");
      regularFee = studentRegularFee;
    } else {
      console.log(
        "No student-specific regular fee, looking for class regular fee"
      );
      regularFee = await FeeStructure.findOne({
        schoolId,
        className,
        additional: false,
        studentId: { $exists: false },
      }).lean();
    }

    if (regularFee) {
      allApplicableFees.push(regularFee);
    }

    // Step 3: Get student-specific additional fees
    const studentAdditionalFees = await FeeStructure.find({
      schoolId,
      studentId,
      additional: true,
    }).lean();

    if (studentAdditionalFees.length > 0) {
      console.log(
        `Found ${studentAdditionalFees.length} student-specific additional fees`
      );
      allApplicableFees = [...allApplicableFees, ...studentAdditionalFees];
    } else {
      // Step 4: Get class-level additional fees if no student-specific ones found
      console.log(
        "No student-specific additional fees, getting class-level additional fees"
      );
      const classAdditionalFees = await FeeStructure.find({
        schoolId,
        className,
        additional: true,
        studentId: { $exists: false },
      }).lean();

      allApplicableFees = [...allApplicableFees, ...classAdditionalFees];
    }

    // Step 5: Find general school-level additional fees that apply to all students
    // (like late fees, etc. that might not be class-specific)
    const schoolLevelFees = await FeeStructure.find({
      schoolId,
      additional: true,
      className: { $exists: false },
      studentId: { $exists: false },
    }).lean();

    if (schoolLevelFees.length > 0) {
      console.log(
        `Found ${schoolLevelFees.length} school-level additional fees`
      );

      // Add school-level fees that don't overlap with existing fees
      schoolLevelFees.forEach((fee) => {
        const feeExists = allApplicableFees.some(
          (existingFee) =>
            existingFee.name === fee.name && existingFee.feeType === fee.feeType
        );

        if (!feeExists) {
          allApplicableFees.push(fee);
        }
      });
    }

    console.log(`Total applicable fees found: ${allApplicableFees.length}`);

    if (allApplicableFees.length === 0) {
      throw new Error(
        `No fee structure found for class ${className} or student ${studentId}`
      );
    }

    return allApplicableFees;
  } catch (error) {
    console.error("Error fetching applicable fees:", error);
    throw error;
  }
}

// Core payment processing function
async function processFeePayment(
  studentId,
  session,
  paymentDetails,
  feeReceiptNumber,
  schoolId
) {
  const student = await NewStudentModel.findOne({ schoolId, studentId }).lean();
  if (!student) throw new Error("Student not found.");

  const parent = await ParentModel.findOne({
    schoolId,
    parentId: student.parentId,
  }).lean();
  if (!parent) throw new Error("Parent not found for this student.");

  const fees = await getAllApplicableFees(schoolId, student.class, studentId);
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
    date,
  } = paymentDetails;

  // Calculate dues (similar to original logic)
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
    return sum + (due ? due.dueAmount : additionalFeeMap[a.name]?.amount || 0);
  }, 0);

  const computedPastDues = feeStatus.pastDues;
  const totalFeeAmount =
    computedFullRegularFeeTotal +
    computedFullAdditionalFeeTotal +
    computedPastDues;

  if (parseFloat(totalAmount) > totalFeeAmount) {
    throw new Error(
      `Total amount (₹${totalAmount}) exceeds outstanding amount (₹${totalFeeAmount}).`
    );
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

  const roundedConcession = Math.round(concession);
  let remainingConcession = roundedConcession;
  let remaining = totalAmount;

  const paidPastDues = Math.min(remaining, totalPastDues);
  remaining -= paidPastDues;

  // Process regular and additional dues (similar to original logic)
  const updatedRegular = [];
  regularFees.forEach((r) => {
    let due = feeStatus.monthlyDues.regularDues.find(
      (d) => d.month === r.month
    ) || {
      month: r.month,
      paidAmount: 0,
      dueAmount: regularFeeMap.Monthly,
      status: "Unpaid",
    };
    if (remaining > 0) {
      const maxPayment = Math.min(remaining, due.dueAmount);
      due = {
        month: r.month,
        paidAmount: due.paidAmount + maxPayment,
        dueAmount: Math.max(0, due.dueAmount - maxPayment),
        status: due.dueAmount - maxPayment === 0 ? "Paid" : "Partial",
      };
      remaining -= maxPayment;
    }
    updatedRegular.push(due);
  });

  const updatedAdditional = [];
  additionalFees.forEach((a) => {
    let due = feeStatus.monthlyDues.additionalDues.find(
      (d) =>
        d.name === a.name && (d.month === a.month || (!d.month && !a.month))
    ) || {
      name: a.name,
      month: a.month || undefined,
      paidAmount: 0,
      dueAmount: additionalFeeMap[a.name]?.amount || 0,
      status: "Unpaid",
    };
    if (remaining > 0) {
      const maxPayment = Math.min(remaining, due.dueAmount);
      due = {
        name: a.name,
        month: a.month || undefined,
        paidAmount: due.paidAmount + maxPayment,
        dueAmount: Math.max(0, due.dueAmount - maxPayment),
        status: due.dueAmount - maxPayment === 0 ? "Paid" : "Partial",
      };
      remaining -= maxPayment;
    }
    updatedAdditional.push(due);
  });

  // Apply concession
  const allDuesToApplyConcession = [
    ...updatedRegular
      .filter((r) => r.dueAmount > 0)
      .map((r) => ({ type: "regular", item: r, dueAmount: r.dueAmount })),
    ...updatedAdditional
      .filter((a) => a.dueAmount > 0)
      .map((a) => ({ type: "additional", item: a, dueAmount: a.dueAmount })),
  ].sort((a, b) =>
    a.item.status === "Partial" && b.item.status !== "Partial" ? -1 : 0
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
        if (dueItem.item.dueAmount === 0) dueItem.item.status = "Paid";
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

  feeStatus.monthlyDues.regularDues = [...otherRegularDues, ...updatedRegular];
  feeStatus.monthlyDues.additionalDues = [
    ...otherAdditionalDues,
    ...updatedAdditional,
  ];
  feeStatus.pastDues = Math.max(0, totalPastDues - paidPastDues);
  feeStatus.dues =
    feeStatus.monthlyDues.regularDues.reduce((sum, d) => sum + d.dueAmount, 0) +
    feeStatus.monthlyDues.additionalDues.reduce(
      (sum, d) => sum + d.dueAmount,
      0
    ) +
    feeStatus.pastDues;

  const concessionDetails = allDuesToApplyConcession
    .filter((item) => item.item.concessionApplied > 0)
    .map((item) =>
      item.type === "regular"
        ? `Regular Fee (${item.item.month}): ${item.item.concessionApplied}`
        : `${item.item.name} (${item.item.month || "N/A"}): ${
            item.item.concessionApplied
          }`
    )
    .join(", ");

  const paymentMessage =
    `Paid ${totalAmount} on ${new Date(date).toLocaleDateString()}: ` +
    `Regular Fees - ${
      updatedRegular.length > 0
        ? updatedRegular.map((r) => `${r.month}: ${r.paidAmount}`).join(", ")
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

  const feeHistoryEntry = {
    date: new Date(date),
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
  };

  feeStatus.feeHistory.push(feeHistoryEntry);
  feeStatus.overallAmountPaid =
    (feeStatus.overallAmountPaid || 0) + parseFloat(totalAmount);
  feeStatus.overallConcessionApplied =
    (feeStatus.overallConcessionApplied || 0) + roundedConcession;

  await feeStatus.save();
  return { feeStatus, feeHistoryEntry, student, parent };
}

// Single student fee payment
exports.createOrUpdateFeePayment = async (req, res) => {
  try {
    const { studentId, session, paymentDetails } = req.body;
    const schoolId = req.user.schoolId;

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

    const feeReceiptNumber = await generateFeeReceiptNumber(schoolId);
    const { feeStatus, feeHistoryEntry, student, parent } =
      await processFeePayment(
        studentId,
        session,
        paymentDetails,
        feeReceiptNumber,
        schoolId
      );

    const feeReceipt = {
      studentId: student.studentId,
      studentName: student.studentName,
      studentClass: student.class,
      parentContact: parent.contact,
      admissionNumber: student.admissionNumber,
      fatherName: parent.fatherName,
      feeReceiptNumber,
      paymentMode: feeHistoryEntry.paymentMode,
      dues: feeHistoryEntry.totalDues,
      date: feeHistoryEntry.date,
      status: feeHistoryEntry.status,
      regularFees: feeHistoryEntry.regularFees.map((fee) => ({
        month: fee.month,
        paidAmount: fee.paidAmount,
        dueAmount: fee.dueAmount,
        status: fee.status,
      })),
      additionalFees: feeHistoryEntry.additionalFees.map((fee) => ({
        name: fee.name,
        month: fee.month || "N/A",
        paidAmount: fee.paidAmount,
        dueAmount: fee.dueAmount,
        status: fee.status,
      })),
      transactionId: feeHistoryEntry.transactionId,
      totalFeeAmount: feeHistoryEntry.totalFeeAmount,
      pastDuesPaid: feeHistoryEntry.pastDuesPaid,
      duesPaid: feeHistoryEntry.previousDues - feeHistoryEntry.totalDues,
      previousDues: feeHistoryEntry.previousDues,
      remark: feeHistoryEntry.remark || "",
      totalAmountPaid: feeHistoryEntry.totalAmountPaid,
      totalDues: feeHistoryEntry.totalDues,
      concessionApplied: feeHistoryEntry.concessionApplied,
      paymentMessage: feeHistoryEntry.paymentMessage,
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
        feeReceipt,
      },
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

// Unified fee payment for multiple students (siblings)
exports.createUnifiedFeePayment = async (req, res) => {
  try {
    const { students, session, unifiedPaymentDetails } = req.body;
    const schoolId = req.user.schoolId;

    if (
      !students ||
      !Array.isArray(students) ||
      students.length === 0 ||
      !session
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Students array and session are required.",
        });
    }

    const feeReceiptNumber = await generateFeeReceiptNumber(schoolId);
    const feeHistoryEntries = [];
    const studentDetails = [];

    for (const { studentId, paymentDetails } of students) {
      if (!studentId || !paymentDetails || !paymentDetails.totalAmount) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Each student must have studentId and paymentDetails with totalAmount.",
          });
      }

      const combinedPaymentDetails = {
        ...paymentDetails,
        paymentMode: unifiedPaymentDetails.paymentMode,
        transactionId: unifiedPaymentDetails.transactionId,
        date: unifiedPaymentDetails.date,
        remark: unifiedPaymentDetails.remark,
      };

      const { feeStatus, feeHistoryEntry, student, parent } =
        await processFeePayment(
          studentId,
          session,
          combinedPaymentDetails,
          feeReceiptNumber,
          schoolId
        );

      feeHistoryEntries.push(feeHistoryEntry);
      studentDetails.push({
        studentId,
        studentName: student.studentName,
        class: student.class,
        feeStatus,
      });
    }

    const unifiedReceipt = new UnifiedReceipt({
      schoolId,
      feeReceiptNumber,
      studentIds: students.map((s) => s.studentId),
      totalAmountPaid: feeHistoryEntries.reduce(
        (sum, entry) => sum + parseFloat(entry.totalAmountPaid),
        0
      ),
      totalDues: feeHistoryEntries.reduce(
        (sum, entry) => sum + entry.totalDues,
        0
      ),
      paymentMode: unifiedPaymentDetails.paymentMode,
      transactionId: unifiedPaymentDetails.transactionId,
      date: new Date(unifiedPaymentDetails.date),
      remark: unifiedPaymentDetails.remark,
    });

    await unifiedReceipt.save();

    res.status(201).json({
      success: true,
      message: "Unified fee payment processed successfully",
      data: {
        feeReceiptNumber,
        feeHistoryEntries,
        unifiedReceipt,
        studentDetails,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to process unified payment",
        error: error.message,
      });
  }
};

// Dedicated receipt generation API
exports.generateFeeReceipt = async (req, res) => {
  try {
    const { feeReceiptNumber } = req.params;
    const schoolId = req.user.schoolId;

    const feeStatuses = await FeeStatus.find({
      schoolId,
      "feeHistory.feeReceiptNumber": feeReceiptNumber,
    }).select("studentId feeHistory.$");
    if (feeStatuses.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Receipt not found" });
    }

    const feeHistoryEntries = feeStatuses.map((fs) => ({
      studentId: fs.studentId,
      feeHistory: fs.feeHistory.find(
        (fh) => fh.feeReceiptNumber === feeReceiptNumber
      ),
    }));

    const studentIds = feeHistoryEntries.map((e) => e.studentId);
    const students = await NewStudentModel.find({
      schoolId,
      studentId: { $in: studentIds },
    }).lean();
    const parentIds = [...new Set(students.map((s) => s.parentId))];
    const parents = await ParentModel.find({
      schoolId,
      parentId: { $in: parentIds },
    }).lean();
    const parent = parents[0]; // Assuming siblings share the same parent

    const unifiedReceipt = await UnifiedReceipt.findOne({
      schoolId,
      feeReceiptNumber,
    });
    const isUnified = !!unifiedReceipt;

    const receiptData = {
      receiptNumber: feeReceiptNumber,
      date: feeHistoryEntries[0].feeHistory.date,
      schoolDetails: {
        name: req.user.schoolName,
        address: req.user.address,
        contact: req.user.contact,
        logo: req.user.image?.url,
      },
      parentDetails: {
        parentId: parent.parentId,
        fatherName: parent.fatherName,
        motherName: parent.motherName,
        contact: parent.contact,
      },
      students: feeHistoryEntries.map((entry) => {
        const student = students.find((s) => s.studentId === entry.studentId);
        return {
          studentId: student.studentId,
          studentName: student.studentName,
          class: student.class,
          admissionNumber: student.admissionNumber,
          feeDetails: {
            regularFees: entry.feeHistory.regularFees.map((fee) => ({
              month: fee.month,
              paidAmount: fee.paidAmount,
              dueAmount: fee.dueAmount,
              status: fee.status,
            })),
            additionalFees: entry.feeHistory.additionalFees.map((fee) => ({
              name: fee.name,
              month: fee.month || "N/A",
              paidAmount: fee.paidAmount,
              dueAmount: fee.dueAmount,
              status: fee.status,
            })),
            pastDuesPaid: entry.feeHistory.pastDuesPaid,
            totalFeeAmount: entry.feeHistory.totalFeeAmount,
            totalAmountPaid: entry.feeHistory.totalAmountPaid,
            totalDues: entry.feeHistory.totalDues,
            concessionApplied: entry.feeHistory.concessionApplied,
            paymentMode: entry.feeHistory.paymentMode,
            transactionId: entry.feeHistory.transactionId,
            remark: entry.feeHistory.remark,
          },
        };
      }),
      totalAmountPaid: feeHistoryEntries.reduce(
        (sum, e) => sum + e.feeHistory.totalAmountPaid,
        0
      ),
      totalDues: feeHistoryEntries.reduce(
        (sum, e) => sum + e.feeHistory.totalDues,
        0
      ),
      paymentMode: feeHistoryEntries[0].feeHistory.paymentMode,
      transactionId: feeHistoryEntries[0].feeHistory.transactionId,
      remark: unifiedReceipt?.remark || feeHistoryEntries[0].feeHistory.remark,
      isUnified,
    };

    res.status(200).json({ success: true, data: receiptData });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to generate receipt",
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
    console.log("mate----------");
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
    const currentDate = new Date();
    let lateFines = [];
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
