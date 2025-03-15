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



// ADMISSION RELATED CONTROLLER FLOW
router.post('/admission', verifyToken, uploads, admin.createStudentParent);
router.post('/admission/bulk', verifyToken, uploads, admin.createBulkStudentParent);
router.get('/studentparent', verifyToken, uploads, admin.getStudentParent);
router.put('/studentparent/:studentId/toggle', verifyToken, uploads, admin.toggleStudentParentStatus);
router.put('/linkStudentToParent', verifyToken,uploads, admin.linkStudentToParent);



// STUDENT RELATED CONTROLLER FLOW
router.put('/students/:studentId', verifyToken, uploads, admin.editStudentParent);
router.get('/students/:studentId', verifyToken, admin.getStudentAndParent);
router.put('/students/:studentId/toggle', verifyToken, admin.toggleStudentStatus);
router.put('/students/update/:studentId', verifyToken, singleUpload, admin.updateStudent);
router.put('/bulkupdatestudents', verifyToken,uploads, admin.bulkUpdateStudents);



// PARENT RELATED CONTROLLER FLOW
router.put('/parents/:parentId', verifyToken, singleUpload, admin.updateParent);
router.put('/parents/:parentId/toggle', verifyToken, admin.toggleParentStatus);
router.get('/parentandchild/:parentAdmissionNumber', verifyToken, uploads, admin.getParentWithChildren);



// FEES RELATED CONTROLLERS FLOW
router.post('/createFees', verifyToken, admin.createFeeStructure)
router.get('/getFees', verifyToken, admin.getAllFeeStructures)
router.get('/getAllFees', verifyToken, admin.getAllFees)
router.put('/updateFees/:feeStructureId', verifyToken, admin.updateFees)
router.delete('/deleteFees/:feeStructureId', verifyToken, admin.deleteFees)
router.post("/createAdditionalFees", verifyToken, admin.createAdditionalFee);
router.get("/getAdditionalFees", verifyToken, admin.getAllAdditionalFee);
router.post("/createStudentSpecificFee", verifyToken, admin.createStudentSpecificFee);



// REGISTRATION RELATED CONTROLLERS FLOW
router.post('/registration', verifyToken, uploads, admin.createRegistration );
router.put('/registration/:registrationId', verifyToken, uploads, admin.editRegistration);
router.get('/registration', verifyToken, uploads, admin.getRegistrations);
router.post('/registration/bulk', verifyToken, uploads, admin.createBulkRegistrations);
router.put('/registration/:registrationId/toggle', verifyToken, uploads, admin.updateRegistrationStatus);
router.post('/registration/:registrationId/admit', verifyToken, uploads, admin.admitRegistration);




// LIBRARY RELATED CONTROLLERS FLOW
router.post('/issueBook', verifyToken, admin.issueBook);
router.put('/returnBook/:issueId', verifyToken, admin.returnBook);
router.get('/getAllIssuedBookStudent', verifyToken, admin.getAllIssuedBookStudent);



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







// LINK EXISTING STUDENT TO PARENT
// router.put('/editStudentParent', verifyToken, admin.editStudentParent); {Old that takes ID as field}
router.delete('/deleteStudent', verifyToken, singleUpload, admin.deleteStudent);

// PENDING ADMISSION THIRD PARTY
// In your admin routes file (for example, routes/adminRoutes.js)
router.patch('/approveAdmission/:studentId', verifyToken, admin.approveAdmission);
router.post('/approveAdmissions', verifyToken, admin.approveMultipleAdmissions);
router.get('/pendingAdmissions', verifyToken, admin.getPendingAdmissions);



// GET route to fetch students by class/section (Admin)
router.get('/students/filter', verifyToken, admin.getStudentsByClassSectionAdmin);







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









// OBSOLETE OR UNNECESSARY CONTROLLERS
router.get('/students/lastyear', verifyToken, admin.getStudentsCreatedAfterAprilOfCurrentYear)
router.get('/students', verifyToken, admin.getAllStudents)
router.get('/parents', verifyToken, admin.getAllParents);
router.get('/students/:admissionNumber', verifyToken, uploads, admin.getDataByAdmissionNumber);
router.get('/allparentswithchildren', verifyToken, admin.getAllParentsWithChildren);
router.post('/addSibling', verifyToken, uploads, admin.addSibling);
router.get('/students/inactive', verifyToken, singleUpload, admin.getDeactivatedStudents);
router.get('/getRegistration/:registrationNumber', verifyToken, uploads, admin.getRegistrationByNumber);
router.delete('/deleteRegistration/:registrationNumber', verifyToken, uploads, admin.deleteRegistration);




// router.put("/updateAdditionalFees/:feeStructureId", verifyToken, admin.updateAdditionalFee);
// router.delete('/deleteAdditionalFees/:feeStructureId', verifyToken, admin.deleteAdditionalFee)