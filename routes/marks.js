// routes/mark.routes.js
const express = require('express');
const router = express.Router();
const verifyToken = require("../middleware/auth");
const {
    addMark,
    getMarks,
    updateMark,
    deleteMark,
    getStudentMarks,
    getExamMarks,
    getClassPerformance,
    bulkUploadMarks
} = require("../controllers/markController");

// Existing routes with original paths
router.post('/marks', verifyToken, addMark);
router.get('/getmarks', verifyToken, getMarks);

// New routes with consistent naming
router.put('/marks/:id', verifyToken, updateMark);
router.delete('/marks/:id', verifyToken, deleteMark);
router.get('/marks/student/:studentId', verifyToken, getStudentMarks);
router.get('/marks/exam/:examId', verifyToken, getExamMarks);
router.get('/marks/classperformance', verifyToken, getClassPerformance);
router.post('/marksbulkupload', verifyToken, bulkUploadMarks);

module.exports = router;