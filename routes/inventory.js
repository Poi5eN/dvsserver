const express = require("express");
const {
  createsellItem,
  returnsellItem,
  getSalesRecords,
  multiItemSell,
  getInventorySummary,
  getTopSellingItems,
  generateReceipt,
} = require("../controllers/inventoryController");
const verifyToken = require("../middleware/auth");

const router = express.Router();

// Sales-related routes
router.post("/createsellItem", verifyToken, createsellItem);
router.post("/multiItemSell", verifyToken, multiItemSell);
router.put("/returnsellItem", verifyToken, returnsellItem);
router.get("/getSalesRecords", verifyToken, getSalesRecords);

// Inventory summary and analytics
router.get("/getInventorySummary", verifyToken, getInventorySummary);
router.get("/getTopSellingItems", verifyToken, getTopSellingItems);

// Receipt generation
router.get("/generateReceipt/:saleId", verifyToken, generateReceipt);

module.exports = router;