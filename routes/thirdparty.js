const express = require('express');
const router = express.Router();
const thirdpartyAdmissionController = require('../controllers/thirdpartyAdmissionController');
const { uploads } = require('../middleware/multer');
const photoUpload = require("../middleware/photoUploadMiddleware");
const { convertImagesToBase64 } = require('../middleware/imageUpload');
const verifyToken = require('../middleware/auth');


// ADMISSIONS RELATED FLOW FOR THIRD PARTY
router.post('/admissions', verifyToken, uploads, convertImagesToBase64, thirdpartyAdmissionController.createAdmission);
router.put('/admissions/:studentId', verifyToken, uploads, thirdpartyAdmissionController.editAdmission);
router.get('/admissions', verifyToken, thirdpartyAdmissionController.getAllStudentsForThirdParty);


// SCHOOL ORIENTED CONTROLLER FLOW FOR THIRD PARTY
router.get('/schools/students', verifyToken, thirdpartyAdmissionController.getStudentsBySchool);
router.get('/schools/students/filter', verifyToken, thirdpartyAdmissionController.getStudentsByClassSectionThirdParty);


// THIRDPARTY PARTICULAR STUDENT RELATED FLOW
router.get('/admissions/my', verifyToken, thirdpartyAdmissionController.getMyAdmissions);
router.get('/admissions/my/school', verifyToken, thirdpartyAdmissionController.getMyAdmissionsBySchool);
router.put('/admissions/my/:studentId', verifyToken, uploads, thirdpartyAdmissionController.updateMyStudent);
router.put('/admissions/any/:studentId', verifyToken, uploads, thirdpartyAdmissionController.updateAnyStudent);
router.get('/students/school', verifyToken, thirdpartyAdmissionController.getMyStudentsBySchool);
router.get('/classes', verifyToken, thirdpartyAdmissionController.getClassesForSchool);




// NEW UPDATED THIRD PARTY ONLY STUDENTS ROUTES
router.post('/students', verifyToken, uploads, thirdpartyAdmissionController.createStudentOnlyThirdParty);



// NEW UPDATED THIRD PARTY ONLY PARENTS ROUTES
router.post('/parents', verifyToken, uploads, thirdpartyAdmissionController.createParentOnlyThirdParty);



// LINK STUDENTS AND PARENTS
router.post('/link', verifyToken, thirdpartyAdmissionController.linkStudentToParentThirdParty);



// NEW PHOTOS AND DOCUMENTS UPLOAD ROUTES
router.post("/photo", verifyToken, uploads, thirdpartyAdmissionController.createInitialStudentPhoto);
router.post('/completeadmission', verifyToken, uploads, thirdpartyAdmissionController.completeAdmissionFromPhoto);
router.get('/photorecords', verifyToken, uploads, thirdpartyAdmissionController.getPhotoRecords);



// NEW TOGGLE PRINTED THIRD PARTY ROUTES
router.put('/printed', verifyToken, thirdpartyAdmissionController.toggleIsPrinted);

module.exports = router;