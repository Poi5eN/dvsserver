const FeeStatus = require("../models/feeStatus");
const FeeManage = require("../models/feeManage");
const NewStudentModel = require("../models/newStudentModel");
const FeeStructure = require("../models/feeStructureModel");

// Helper function to generate a unique fee receipt number
function generateUniqueFeeReceiptNumber() {
    const characters = 'ABC0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Helper function to fetch fees for a class
async function getFeesForClass(schoolId, className) {
    try {
        const fees = await FeeStructure.find({ schoolId, className });

        if (fees.length === 0) {
            throw new Error(`No fee structure found for class ${className}`);
        }

        return fees;
    } catch (error) {
        throw new Error(`Failed to fetch fees for class ${className}: ${error.message}`);
    }
}

// Function to calculate dues for each month
function calculateMonthlyDues(feeEntries, feeMap) {
    let totalPaidAmount = 0;
    let totalDues = 0;

    const fees = feeEntries.map(entry => {
        const feeAmount = feeMap[entry.name || entry.feeType] || 0;
        const paidAmount = entry.paidAmount || 0;
        const dueAmount = feeAmount - paidAmount;
        const status = dueAmount <= 0 ? "Paid" : (paidAmount > 0 ? "Partial Payment" : "Unpaid");

        totalPaidAmount += paidAmount;
        totalDues += dueAmount > 0 ? dueAmount : 0;

        return {
            ...entry,
            dueAmount: dueAmount > 0 ? dueAmount : 0,
            status,
        };
    });

    return { fees, totalPaidAmount, totalDues };
}

// Controller to manage dues and track payment status for an academic year
exports.manageDuesPayment = async (req, res) => {
    try {
        const { admissionNumber, payDuesAmount, className } = req.body;
        const schoolId = req.user.schoolId;
        const year = new Date().getFullYear();

        // Fetch the fee structure for the class
        const fees = await FeeStructure.find({ schoolId, className });
        const regularFeeMap = {};
        const additionalFeeMap = {};

        fees.forEach(fee => {
            if (fee.additional) {
                additionalFeeMap[fee.name] = fee.amount || 0;
            } else {
                regularFeeMap[fee.feeType] = fee.amount || 0;
            }
        });

        // Find the existing fee payment record
        const existingFeePayment = await FeeStatus.findOne({
            schoolId,
            admissionNumber,
            year,
        });

        if (!existingFeePayment) {
            return res.status(404).json({
                success: false,
                message: `No fee payment record found for the student with admission number ${admissionNumber} for year ${year}`,
            });
        }

        // Calculate dues for regular and additional fees
        let { fees: regularFees, totalDues: totalRegularDues } = calculateMonthlyDues(
            existingFeePayment.monthlyDues.regularDues,
            regularFeeMap
        );

        let { fees: additionalFees, totalDues: totalAdditionalDues } = calculateMonthlyDues(
            existingFeePayment.monthlyDues.additionalDues,
            additionalFeeMap
        );

        let totalDues = totalRegularDues + totalAdditionalDues;
        let totalPaidAmount = 0;

        // Apply payment to the dues
        let remainingPayment = payDuesAmount || 0;

        // Pay off regular dues
        for (let i = 0; i < regularFees.length; i++) {
            const fee = regularFees[i];
            if (fee.dueAmount > 0 && remainingPayment > 0) {
                const amountToPay = Math.min(remainingPayment, fee.dueAmount);
                fee.paidAmount += amountToPay;
                fee.dueAmount -= amountToPay;
                remainingPayment -= amountToPay;
                fee.status = fee.dueAmount <= 0 ? "Paid" : "Partial Payment";
            }
        }

        // Pay off additional dues
        for (let i = 0; i < additionalFees.length; i++) {
            const fee = additionalFees[i];
            if (fee.dueAmount > 0 && remainingPayment > 0) {
                const amountToPay = Math.min(remainingPayment, fee.dueAmount);
                fee.paidAmount += amountToPay;
                fee.dueAmount -= amountToPay;
                remainingPayment -= amountToPay;
                fee.status = fee.dueAmount <= 0 ? "Paid" : "Partial Payment";
            }
        }

        // Recalculate total dues after payment
        totalRegularDues = regularFees.reduce((sum, fee) => sum + fee.dueAmount, 0);
        totalAdditionalDues = additionalFees.reduce((sum, fee) => sum + fee.dueAmount, 0);
        totalDues = totalRegularDues + totalAdditionalDues;

        // Update the fee payment record
        existingFeePayment.monthlyDues.regularDues = regularFees;
        existingFeePayment.monthlyDues.additionalDues = additionalFees;
        existingFeePayment.dues = totalDues;
        existingFeePayment.totalAmountPaid += payDuesAmount;

        await existingFeePayment.save();

        res.status(200).json({
            success: true,
            message: "Dues payment processed successfully",
            data: {
                regularFees,
                additionalFees,
                totalDues,
                totalAmountPaid: existingFeePayment.totalAmountPaid,
                remainingPayment,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error processing dues payment",
            error: error.message,
        });
    }
};




exports.createPayment = async (req, res) => {
    try {
        const { admissionNumber, className, feeHistory } = req.body;
        const schoolId = req.user.schoolId;
        const year = new Date().getFullYear();

        // Fetch fees for the class
        const fees = await getFeesForClass(schoolId, className);

        const regularFeeMap = {};
        const additionalFeeMap = {};

        // Categorize fees into regular and additional
        fees.forEach(fee => {
            if (fee.additional) {
                additionalFeeMap[fee.name] = fee.amount || 0;
            } else {
                regularFeeMap[fee.feeType] = fee.amount || 0;
            }
        });

        let totalPaidAmount = 0;
        let totalDues = 0;

        // Fetch existing fee payment record
        const existingFeePayment = await FeeManage.findOne({
            schoolId,
            admissionNumber,
            year,
        });

        // Initialize records if not existing
        const existingRegularFees = existingFeePayment ? existingFeePayment.monthlyDues.regularDues : [];
        const existingAdditionalFees = existingFeePayment ? existingFeePayment.monthlyDues.additionalDues : [];

        // Function to handle fee calculation and validation
        const calculateFees = (entries, feeMap, isRegular) => {
            return entries.map(entry => {
                const feeAmount = feeMap[isRegular ? "Monthly" : entry.name] || 0;
                const previousPaidAmount = isRegular
                    ? existingRegularFees.find(fee => fee.month === entry.month)?.paidAmount || 0
                    : existingAdditionalFees.find(fee => fee.name === entry.name && fee.month === entry.month)?.paidAmount || 0;
                const paidAmount = entry.paidAmount || 0;
                const totalAmountPaid = previousPaidAmount + paidAmount;

                // Check for overpayment
                if (totalAmountPaid > feeAmount) {
                    throw new Error(`Payment for ${isRegular ? 'regular' : 'additional'} fee in ${entry.month || 'N/A'} exceeds the remaining dues.`);
                }

                const dueAmount = feeAmount - totalAmountPaid;
                const status = dueAmount <= 0 ? "Paid" : "Partial Payment";

                totalPaidAmount += paidAmount;
                totalDues += dueAmount > 0 ? dueAmount : 0;

                return {
                    ...entry,
                    dueAmount: dueAmount > 0 ? dueAmount : 0,
                    status
                };
            });
        };

        // Calculate dues for regular fees
        const regularFees = calculateFees(feeHistory.regularFees, regularFeeMap, true);

        // Calculate dues for additional fees
        const additionalFees = calculateFees(feeHistory.additionalFees, additionalFeeMap, false);

        // Format the date from the frontend or use the current date
        const date = new Date(feeHistory.date || new Date());
        const formattedDate = date.toLocaleDateString("en-US", {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        const newFeeHistory = {
            date: formattedDate, // Use the formatted date
            status: totalDues <= 0 ? "Paid" : "Partial Payment",
            regularFees,
            additionalFees,
            feeReceiptNumber: generateUniqueFeeReceiptNumber(),
            paymentMode: feeHistory.paymentMode || "N/A",
            transactionId: feeHistory.transactionId || "N/A",
            totalFeeAmount: feeHistory.totalFeeAmount || 0,
            previousDues: feeHistory.previousDues || 0,
            remark: feeHistory.remark || "",
            concessionFee: feeHistory.concessionFee || 0,
            paidAfterConcession: feeHistory.paidAfterConcession || 0,
            newPaidAmount: feeHistory.newPaidAmount || 0,
            totalAmountPaid: totalPaidAmount,
            totalDues
        };

        if (existingFeePayment) {
            existingFeePayment.feeHistory.push(newFeeHistory);

            // Update monthly dues for regular fees
            regularFees.forEach(entry => {
                let regularDue = existingFeePayment.monthlyDues.regularDues.find(due => due.month === entry.month);
                if (regularDue) {
                    regularDue.dueAmount = entry.dueAmount;
                    regularDue.paidAmount = (regularDue.paidAmount || 0) + entry.paidAmount; // Update paid amount
                    regularDue.status = entry.status;
                } else {
                    existingFeePayment.monthlyDues.regularDues.push({
                        month: entry.month,
                        dueAmount: entry.dueAmount,
                        paidAmount: entry.paidAmount, // Set paid amount
                        status: entry.status
                    });
                }
            });

            // Update monthly dues for additional fees
            additionalFees.forEach(entry => {
                let additionalDue = existingFeePayment.monthlyDues.additionalDues.find(due => due.name === entry.name && due.month === entry.month);
                if (additionalDue) {
                    additionalDue.dueAmount = entry.dueAmount;
                    additionalDue.paidAmount = (additionalDue.paidAmount || 0) + entry.paidAmount; // Update paid amount
                    additionalDue.status = entry.status;
                } else {
                    existingFeePayment.monthlyDues.additionalDues.push({
                        name: entry.name,
                        month: entry.month || "N/A",
                        dueAmount: entry.dueAmount,
                        paidAmount: entry.paidAmount, // Set paid amount
                        status: entry.status
                    });
                }
            });

            existingFeePayment.dues = totalDues;

            const updatedFeePayment = await existingFeePayment.save();
            res.status(201).json({
                success: true,
                message: "Fee Status updated successfully",
                data: updatedFeePayment
            });
        } else {
            const newFeePayment = new FeeManage({
                schoolId,
                admissionNumber,
                year,
                dues: totalDues,
                feeHistory: [newFeeHistory],
                monthlyDues: {
                    regularDues: regularFees.map(entry => ({
                        month: entry.month,
                        dueAmount: entry.dueAmount,
                        paidAmount: entry.paidAmount, // Set paid amount
                        status: entry.status
                    })),
                    additionalDues: additionalFees.map(entry => ({
                        name: entry.name,
                        month: entry.month || "N/A",
                        dueAmount: entry.dueAmount,
                        paidAmount: entry.paidAmount, // Set paid amount
                        status: entry.status
                    }))
                }
            });

            const savedFeePayment = await newFeePayment.save();
            res.status(201).json({
                success: true,
                message: "Fee payment created successfully",
                data: savedFeePayment
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

