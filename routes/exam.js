// routes/exam.routes.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const {
    createExam,
    getExams,
    updateExam,
    deleteExam,
    getExamById,
    getExamsByClass,
    getUpcomingExams,
    getPublishedExams,
    submitExamResults,
    generateReportCard,
    getExamAnalytics
} = require("../controllers/examController");

// Existing routes with original paths
router.post('/createExams', verifyToken, createExam);
router.get('/getExams', verifyToken, getExams);

// Basic CRUD operations
router.get('/exams/:id', verifyToken, getExamById);
router.put('/exams/:id', verifyToken, updateExam);
router.delete('/exams/:id', verifyToken, deleteExam);

// Additional exam routes
router.get('/exams/class/:className/section/:section', verifyToken, getExamsByClass);
router.get('/exams/upcoming', verifyToken, getUpcomingExams);
router.get('/exams/published', verifyToken, getPublishedExams);

// Results and analytics routes (maintained from your original commented code)
router.post('/exams/:id/results', verifyToken, submitExamResults);
router.get('/exams/:examId/students/:studentId/report-card', verifyToken, generateReportCard);
router.get('/exams/:id/analytics', verifyToken, getExamAnalytics);

module.exports = router;