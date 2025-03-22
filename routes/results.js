const express = require("express");
const {createResults, getResults, updateResult, downloadTemplate, uploadResults, generateBulkReportCards  } = require("../controllers/resultController");
const verifyToken = require("../middleware/auth");

const router = express.Router();

router.post('/createResults', verifyToken, createResults);
router.get('/getResults', verifyToken, getResults);
router.get('/updateResult', verifyToken, updateResult);
router.get('/downloadTemplate', verifyToken, downloadTemplate);
router.get('/uploadResults', verifyToken, uploadResults);
router.get('/generateBulkReportCards', verifyToken, generateBulkReportCards);
// router.delete('/deleteExam/:examId', verifyToken, deleteExam);
// router.put('/updateExam', verifyToken, updateExam);

module.exports = router;