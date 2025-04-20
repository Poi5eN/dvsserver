const express = require("express");
const { createOrUpdateFeePayment , getFeeStatus, feeIncomeMonths, getFeeHistory, editFeeStatus, deleteFeeStatus, getAllStudentsFeeStatus, getFeeStatusByMonth, getStudentFeeHistory, getFeeHistoryAndDues, addPastDues, cancelFeePayment, getMonthlyDues, getStudentFeeInfo, generateUnifiedFeeReceipt, generateFormattedFeeReceipt, createUnifiedFeePayment, generateFeeReceipt, getUnifiedReceipts, allocateAdditionalFees, allotAdditionalFees} = require("../controllers/feeStatusController");
const { manageDuesPayment, createPayment } = require("../controllers/manageDuesPayment");
const verifyToken = require("../middleware/auth");

const router = express.Router();

router.post("/createFeeStatus", verifyToken, createOrUpdateFeePayment);
router.post("/createUnifiedFeePayment", verifyToken, createUnifiedFeePayment);
router.get("/generateFeeReceipt", verifyToken, generateFeeReceipt);
router.get("/unified-receipts", verifyToken, getUnifiedReceipts);


router.post("/allotAdditionalFees", verifyToken, allotAdditionalFees);


router.post('/createPayment', verifyToken, createPayment);
router.post('/addPastDues', verifyToken, addPastDues);
router.get('/getFeeStatus', verifyToken, getFeeStatus);
router.get('/feeIncomeMonths', verifyToken, feeIncomeMonths);
router.get('/feeHistory', verifyToken, getFeeHistory);
router.get('/getAllStudentsFeeStatus', verifyToken, getAllStudentsFeeStatus);
router.get('/getFeeStatusByMonth', verifyToken, getFeeStatusByMonth);
router.get('/getStudentFeeHistory/:admissionNumber', verifyToken, getStudentFeeHistory);
router.get('/getStudentFeeInfo', verifyToken, getStudentFeeInfo);
router.get('/getFeeHistoryAndDues/:admissionNumber', verifyToken, getFeeHistoryAndDues);
router.get('/getMonthlyDues', verifyToken, getMonthlyDues);
router.put('/editFeeStatus/:receiptNumber', verifyToken, editFeeStatus);
router.delete('/deleteFeeStatus/:receiptNumber', verifyToken, deleteFeeStatus);
router.post('/cancelFeePayment', verifyToken, cancelFeePayment);

// router.post('/generateUnifiedReceipt', verifyToken, generateUnifiedFeeReceipt);
// router.get("/formatted-receipt/:receiptNumber", verifyToken, generateFormattedFeeReceipt);


// NEW API ROUTES WITH UNIFIED FUNCTIONALITY
// Unified GET endpoint
// router.get('/fees', feeController.getFees);

// // Kept separate as per requirement
// router.get('/fee-status', feeController.getFeeStatus);
// router.get('/fee-history', feeController.getFeeHistory);

// // Other endpoints (unchanged)
// router.post('/fees/payment', feeController.createOrUpdateFeePayment);
// router.post('/fees/past-dues', feeController.addPastDues);
// router.put('/fees/cancel', feeController.cancelFeePayment);
// router.put('/fees/status/:receiptNumber', feeController.editFeeStatus);
// router.delete('/fees/status/:receiptNumber', feeController.deleteFeeStatus);



// DUES MANAGEMENT
router.post('/manageDuesPayment', verifyToken, manageDuesPayment);

module.exports = router;