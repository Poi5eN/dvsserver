const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const {
  createResults,
  getResults,
  updateResult,
  downloadTemplate,
  uploadResults,
  generateBulkReportCards,
} = require("../controllers/resultController");

router.post('/createResults', verifyToken, createResults);
router.get('/getResults', verifyToken, getResults);
router.put('/updateResult', verifyToken, updateResult);
router.get('/downloadTemplate', verifyToken, downloadTemplate);
router.post('/uploadResults', verifyToken, uploadResults);
router.get('/generateBulkReportCards', verifyToken, generateBulkReportCards);

module.exports = router;