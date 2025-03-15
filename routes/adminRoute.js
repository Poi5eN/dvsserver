const {Router} = require('express')
const router = Router()
const admin = require('../controllers/adminController')
const {singleUpload, uploads} = require('../middleware/multer')
const verifyToken = require('../middleware/auth')
const { convertImagesToBase64 } = require('../middleware/imageUpload')

console.log('Admin routes loaded');


// SCHOOL RELATED ROUTES FLOW
router.get('/admin', verifyToken, admin.getAdminInfo);
router.put('/admin', verifyToken, uploads, admin.updateAdmin);



// CLASS RELATED ROUTES FLOW
router.post('/class', verifyToken, admin.createClass);
router.get('/class', verifyToken, admin.getAllClasses);
router.get('/class/:classId', verifyToken, admin.getClassById);
router.put('/class/:classId', verifyToken, admin.updateClass);
router.delete('/class/:classId', verifyToken, admin.deleteClass);



// TEACHER RELATED ROUTES FLOW
router.post('/teacher', verifyToken, singleUpload, admin.createTeacher)
router.put('/teacher/deactivate', verifyToken, admin.deactivateTeacher)
router.put('/teacher/status', verifyToken, admin.toggleTeacherStatus)
router.put('/teacher/:teacherId', verifyToken, singleUpload, admin.updateTeacher)
router.get('/teacher', verifyToken, admin.getAllTeachers)



// FEES RELATED CONTROLLERS FLOW
router.post('/createFees', verifyToken, admin.createFeeStructure)
router.get('/getFees', verifyToken, admin.getAllFeeStructures)
router.get('/getAllFees', verifyToken, admin.getAllFees)
router.put('/updateFees/:feeStructureId', verifyToken, admin.updateFees)
router.delete('/deleteFees/:feeStructureId', verifyToken, admin.deleteFees)
router.post("/createAdditionalFees", verifyToken, admin.createAdditionalFee);
router.get("/getAdditionalFees", verifyToken, admin.getAllAdditionalFee);
router.post("/createStudentSpecificFee", verifyToken, admin.createStudentSpecificFee);


// LIBRARY RELATED CONTROLLERS FLOW
router.post('/issueBook', verifyToken, admin.issueBook);
router.put('/returnBook/:issueId', verifyToken, admin.returnBook);
router.get('/getAllIssuedBookStudent', verifyToken, admin.getAllIssuedBookStudent);


// router.put("/updateAdditionalFees/:feeStructureId", verifyToken, admin.updateAdditionalFee);
// router.delete('/deleteAdditionalFees/:feeStructureId', verifyToken, admin.deleteAdditionalFee)

router.post('/createBook', verifyToken, admin.createBookDetails);
router.get('/getAllBooks', verifyToken, admin.getAllBooks);
router.delete('/deleteBook/:bookId', verifyToken, admin.deleteBook);
router.put('/updateBook/:bookId', verifyToken, admin.updateBook);
router.post('/issueBook', verifyToken, admin.issueBook);
router.put('/returnBook', verifyToken, admin.returnBook);
router.get('/getIssueBookToMe', verifyToken, admin.getAllIssueBookToMe);

router.post('/createItem', verifyToken, admin.createItemDetails);
router.get('/getAllItems', verifyToken, admin.getAllItems);
router.delete('/deleteItem/:itemId', verifyToken, admin.deleteItem);
router.put('/updateItem/:itemId', verifyToken, admin.updateItem);

// POST route for creating registration
// router.post('/createRegistration', verifyToken, uploads, admin.createRegistration);
router.post(
    '/createRegistration',
    verifyToken,
    uploads,
    convertImagesToBase64,
    admin.createRegistration
  );
router.post('/createBulkRegistrations', verifyToken, uploads, admin.createBulkRegistrations);
router.put('/editRegistration/:registrationNumber', verifyToken, uploads, admin.editRegistration);
router.delete('/deleteRegistration/:registrationNumber', verifyToken, uploads, admin.deleteRegistration);
// GET route for fetching all registrations
router.get('/getRegistrations', verifyToken, uploads, admin.getRegistrations);
// GET route for fetching a specific registration by ID
// router.get('/getRegistration/:id', verifyToken, uploads, admin.getRegistrationById);
router.get('/getRegistration/:registrationNumber', verifyToken, uploads, admin.getRegistrationByNumber);



router.post('/students', verifyToken, uploads, admin.createStudentParent);
router.post('/students/bulk', verifyToken, uploads, admin.createBulkStudentParent);
router.put('/students/:studentId', verifyToken, uploads, admin.editStudentParent);
router.get('/students/:studentId', verifyToken, admin.getStudentAndParent);
router.get('/getParentWithChildren/:parentAdmissionNumber', verifyToken, uploads, admin.getParentWithChildren);
router.get('/getDataByAdmissionNumber/:admissionNumber', verifyToken, uploads, admin.getDataByAdmissionNumber);
router.get('/getAllParentsWithChildren', verifyToken, admin.getAllParentsWithChildren);
router.post('/addSibling', verifyToken, uploads, admin.addSibling);
router.put('/updateParent', verifyToken, singleUpload, admin.updateParent);
router.put('/deactivateParent', verifyToken, admin.deactivateParent);
router.get('/getAllParents', verifyToken, admin.getAllParents);
router.get('/getAllStudents', verifyToken, admin.getAllStudents)
router.put('/deactivateStudent', verifyToken, admin.deactivateStudent);
router.put('/bulkUpdateStudents', verifyToken,uploads, admin.bulkUpdateStudents);


// LINK EXISTING STUDENT TO PARENT
router.put('/linkStudentToParent', verifyToken,uploads, admin.linkStudentToParent);
// router.put('/editStudentParent', verifyToken, admin.editStudentParent); {Old that takes ID as field}
router.put('/updateStudent', verifyToken, singleUpload, admin.updateStudent);
router.get('/getDeactivatedStudents', verifyToken, singleUpload, admin.getDeactivatedStudents);
router.delete('/deleteStudent', verifyToken, singleUpload, admin.deleteStudent);

// PENDING ADMISSION THIRD PARTY
// In your admin routes file (for example, routes/adminRoutes.js)
router.patch('/approveAdmission/:studentId', verifyToken, admin.approveAdmission);
router.post('/approveAdmissions', verifyToken, admin.approveMultipleAdmissions);
router.get('/pendingAdmissions', verifyToken, admin.getPendingAdmissions);



// GET route to fetch students by class/section (Admin)
router.get('/students/filter', verifyToken, admin.getStudentsByClassSectionAdmin);





router.get('/getLastYearStudents', verifyToken, admin.getStudentsCreatedAfterAprilOfCurrentYear)


router.delete('/deleteStudentsBySchool', verifyToken, admin.deleteStudentsBySchool)
router.delete('/deleteStudentsByClass', verifyToken, admin.deleteStudentsByClass)


router.post("/createEmployee", verifyToken, singleUpload, admin.createEmployee);
router.get("/getAllEmployees", verifyToken, admin.getAllEmployees);
router.put('/deactivateEmployee', verifyToken, admin.deactivateEmployee);
router.put('/updateEmployee', verifyToken, singleUpload, admin.updateEmployee);





router.get('/getAllStudentStatus', verifyToken, admin.getAllStudentStatus)
router.get('/myKids', verifyToken, admin.getMyKids);

router.post('/createNotice', verifyToken, singleUpload, admin.createNotice);
router.delete('/deleteNotice/:noticeId', verifyToken, admin.deleteNotice);
router.put('/updateNotice/:noticeId', verifyToken, singleUpload, admin.updateNotice);
// router.get('/getAllNotice',admin.getAllNotice);
router.get('/getAllNotice', verifyToken, admin.getAllNotice);

// router.get('/getAllStudentOfClass', verifyToken, admin.getAllStudentOfClass);
router.put('/promotionOfStudent', verifyToken, admin.promotionOfStudent);


router.post('/createCurriculum', verifyToken, singleUpload, admin.createCurriculum);
router.delete('/deleteCurriculum/:curriculumId', verifyToken, admin.deleteCurriculum);
router.put('/updateCurriculum/:curriculumId', verifyToken, singleUpload, admin.updateCurriculum);
router.get('/getAllCurriculum', verifyToken, admin.getAllCurriculum);

router.post('/createAssignment', verifyToken, singleUpload, admin.createAssignment);
router.delete('/deleteAssignment/:assignmentId', verifyToken, admin.deleteAssignment);
router.put('/updateAssignment/:assignmentId', verifyToken, singleUpload, admin.updateAssignment);
router.get('/getAllAssignment', verifyToken, admin.getAllAssignment);



// APIS FOR THE ADMIN TO FETCH AND QUERY THE EXAMS
router.get('/exams', verifyToken, admin.getAdminExams);
router.post('/exams', verifyToken, admin.createAdminExam);
router.put('/exams/:id', verifyToken, admin.updateAdminExam);
router.delete('/exams/:id', verifyToken, admin.deleteAdminExam);
router.get('/exams/:id', verifyToken, admin.getAdminExamById);



// New admin routes
router.post('/marks', verifyToken, admin.addAdminMark);
router.get('/marks', verifyToken, admin.getAdminMarks);
router.put('/marks/:id', verifyToken, admin.updateAdminMark);
router.delete('/marks/:id', verifyToken, admin.deleteAdminMark);
router.get('/marks/student/:studentId', verifyToken, admin.getAdminStudentMarks);
router.get('/marks/exam/:examId', verifyToken, admin.getAdminExamMarks);
router.get('/marks/classperformance', verifyToken, admin.getAdminClassPerformance);
router.post('/marksbulkupload', verifyToken, admin.bulkUploadAdminMarks);


module.exports = router 
