const express = require("express");

const router = express.Router();
const verifyToken = require('../middleware/auth');
const { createSalaryPayment, getPayment, salaryExpensesMonths } = require("../controllers/employeeController");

router.post('/salaryPay', verifyToken, createSalaryPayment);
router.get('/getPaymentHistory', verifyToken, getPayment);
router.get('/salaryExpensesMonths', verifyToken, salaryExpensesMonths);

module.exports = router;