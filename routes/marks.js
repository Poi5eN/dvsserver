const express = require('express');
const router = express.Router();
const verifyToken = require("../middleware/auth");
const {
  addMark,
  getMarks,
  updateMark,
  deleteMark,
  bulkUploadMarks,
  bulkUpdateMarks,
} = require("../controllers/markController");

router.post('/marks', verifyToken, addMark);
router.get('/marks', verifyToken, getMarks);
router.put('/marks/:id', verifyToken, updateMark);
router.delete('/marks/:id', verifyToken, deleteMark);
router.post('/marksbulkupload', verifyToken, bulkUploadMarks);
router.put('/marksbulkupload', verifyToken, bulkUpdateMarks);

module.exports = router;