const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const {
  createExam,
  getExams,
  updateExam,
  deleteExam,
  submitExamResults,
  generateReportCard,
  getExamAnalytics,
  generateFullReportCard,
} = require("../controllers/examController");

router.post('/exams', verifyToken, createExam);
router.get('/exams', verifyToken, getExams);
router.put('/exams/:id', verifyToken, updateExam);
router.delete('/exams/:id', verifyToken, deleteExam);
router.post('/exams/:id/results', verifyToken, submitExamResults);
router.get('/exams/:examId/students/:studentId/report-card', verifyToken, generateReportCard);
router.get('/exams/:id/analytics', verifyToken, getExamAnalytics);
router.get('/results/:studentId/report', verifyToken, generateFullReportCard);

module.exports = router;