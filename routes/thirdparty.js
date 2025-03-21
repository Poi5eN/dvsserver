const express = require('express');
const router = express.Router();
const thirdpartyAdmissionController = require('../controllers/thirdpartyAdmissionController');
const { uploads } = require('../middleware/multer');
const { convertImagesToBase64 } = require('../middleware/imageUpload');
const verifyToken = require('../middleware/auth');

router.post('/admissions', verifyToken, uploads, convertImagesToBase64, thirdpartyAdmissionController.createAdmission);
router.get('/admissions', verifyToken, thirdpartyAdmissionController.getAllStudentsForThirdParty);
router.put('/admissions/:studentId', verifyToken, uploads, thirdpartyAdmissionController.editAdmission);
router.get('/studentsBySchool', verifyToken, thirdpartyAdmissionController.getStudentsBySchool);
router.get('/students/filter', verifyToken, thirdpartyAdmissionController.getStudentsByClassSectionThirdParty);
router.get('/my-admissions', verifyToken, thirdpartyAdmissionController.getMyAdmissions);
router.get('/my-admissions/school', verifyToken, thirdpartyAdmissionController.getMyAdmissionsBySchool);
router.put('/my-students/:studentId', verifyToken, uploads, thirdpartyAdmissionController.updateMyStudent);
router.put('/admissions/:studentId', verifyToken, uploads, thirdpartyAdmissionController.updateAnyStudent);
router.get('/my-students/school', verifyToken, thirdpartyAdmissionController.getMyStudentsBySchool);
router.get('/classes', verifyToken, thirdpartyAdmissionController.getClassesForSchool);




// NEW UPDATED THIRD PARTY ADMISSION ROUTES
router.post('/students', verifyToken, uploads, thirdpartyAdmissionController.createStudentOnlyThirdParty);

module.exports = router;