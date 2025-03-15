const express = require("express");
const {createResults  } = require("../controllers/resultController");
const verifyToken = require("../middleware/auth");

const router = express.Router();

router.post('/createResults', verifyToken, createResults);
// router.delete('/deleteExam/:examId', verifyToken, deleteExam);
// router.put('/updateExam', verifyToken, updateExam);
// router.get('/getAllExams', verifyToken, getAllExams);

module.exports = router;