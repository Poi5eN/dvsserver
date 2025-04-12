const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const receiptController = require("../controllers/receiptController");



router.get("/sales/:saleId", verifyToken, receiptController.generateReceipt);



module.exports = router;