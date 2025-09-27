const {Router} = require('express')
const { createStudyMaterial, getStudyMaterial, deleteStudyMaterial ,createAttendance,getAttendanceByMonth,
    createSalaryPayment,getPayment,updateAttendance, getAttendanceForStudent, getTeacherAssignments, getTeacherExams, createTeacherExam, getAllTeacherAssignments, getAllTeacherCurriculum} = require('../controllers/teacherController')
const { singleUpload } = require('../middleware/multer')
const verifyToken = require('../middleware/auth')
const router = Router()

router.post('/createStudyMaterial', verifyToken, singleUpload, createStudyMaterial)
router.get('/getStudyMaterial',verifyToken, getStudyMaterial)
router.delete('/deleteStudyMaterial/:studyId', verifyToken , deleteStudyMaterial)

router.post('/createAttendance', verifyToken, createAttendance);
router.get('/getAttendance',verifyToken, getAttendanceByMonth);
router.get('/getAttendanceForStudent',verifyToken, getAttendanceForStudent);


router.post('/salaryPay', verifyToken, createSalaryPayment);
router.get('/getPaymentHistory', verifyToken, getPayment);

// Assignment and Curriculum routes for teachers
router.get('/assignments', verifyToken, getTeacherAssignments);
router.get('/exams', verifyToken, getTeacherExams);
router.post('/exams', verifyToken, createTeacherExam);
router.get('/getAllAssignment', verifyToken, getAllTeacherAssignments);
router.get('/getAllCurriculum', verifyToken, getAllTeacherCurriculum);

// Debug route to test if teacher routes are working
router.get('/test', (req, res) => {
    res.json({ success: true, message: "Teacher routes are working - Updated 2025-01-27" });
});

module.exports = router