const {Router} = require('express')
const { createStudyMaterial, getStudyMaterial, deleteStudyMaterial ,createAttendance,getAttendanceByMonth,
    createSalaryPayment,getPayment,updateAttendance, getAttendanceForStudent} = require('../controllers/teacherController')
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

module.exports = router