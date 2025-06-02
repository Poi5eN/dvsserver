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



// DESIGN RELATED ROUTES FLOW
router.post("/design", verifyToken, uploads, admin.createDesignFormat);
router.get("/design", verifyToken, admin.getDesignFormats);
router.put("/design/:formatId", verifyToken, uploads, admin.updateDesignFormat);
router.delete("/design/:formatId", verifyToken, admin.deleteDesignFormat);
router.patch("/design/:formatId/set-default", verifyToken, admin.setDefaultDesignFormat);




// CLASS RELATED ROUTES FLOW
router.post('/class', verifyToken, admin.createClass);
// router.get('/class', verifyToken, admin.getAllClasses);
router.get('/class', verifyToken, admin.getClassesGrouped);
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
router.post('/linkStudentToParent', verifyToken,uploads, admin.linkStudentToParent);


// BULK STUDENT EDITING CONTROLLER FLOW
router.put('/studentparent/many', verifyToken, admin.bulkEditStudents);




// STUDENT RELATED CONTROLLER FLOW
router.post('/students', verifyToken, uploads, admin.createStudentOnly);
router.put('/students/:studentId', verifyToken, uploads, admin.editStudentParent);
router.get('/students/:studentId', verifyToken, admin.getStudentParent);
router.put('/students/:studentId/toggle', verifyToken, admin.toggleStudentStatus);
router.put('/students/:studentId/toggle-admission', admin.toggleAdmissionStatus);
router.put('/students/update/:studentId', verifyToken, singleUpload, admin.updateStudent);
router.post("/students/toggle-printed", verifyToken, admin.toggleIsPrinted);
router.put('/bulkupdatestudents', verifyToken,uploads, admin.bulkUpdateStudents);





// PARENT RELATED CONTROLLER FLOW
router.post('/parents', verifyToken, uploads, admin.createParentOnly);
router.get('/parentemail', verifyToken, uploads, admin.getParentByEmail);
router.put('/parents/:parentId', verifyToken, uploads, admin.updateParent);
router.put('/parents/:parentId/toggle', verifyToken, admin.toggleParentStatus);
router.get('/parentandchild', verifyToken, uploads, admin.parentsWithChildren);
router.get('/parentandchild/:parentId', verifyToken, uploads, admin.getParentWithChildren);




// REGISTRATION RELATED CONTROLLERS FLOW
router.post('/registration', verifyToken, uploads, admin.createRegistration );
router.put('/registration/:registrationId', verifyToken, uploads, admin.editRegistration);
router.get('/registration', verifyToken, uploads, admin.getRegistrations);
router.post('/registration/bulk', verifyToken, uploads, admin.createBulkRegistrations);
router.put('/registration/:registrationId/toggle', verifyToken, uploads, admin.updateRegistrationStatus);
router.post('/registration/:registrationId/admit', verifyToken, uploads, admin.admitRegistration);




// FEES RELATED CONTROLLERS FLOW
router.post("/fees/student", verifyToken, admin.createStudentSpecificFee);
router.post('/fees/regular', verifyToken, admin.createFeeStructure)
router.post("/fees/additional", verifyToken, admin.createAdditionalFee);
router.post("/fees/fine", verifyToken, admin.createLateFineFee);
router.get("/fees", verifyToken, admin.getFeeStructures);
router.get("/fees/all", verifyToken, admin.getAllFees);
router.put('/fees/:feeStructureId', verifyToken, admin.updateFees)
router.delete('/fees/:feeStructureId', verifyToken, admin.deleteFees)
// BULK FEES CREATE AND EDIT OPTIONS
router.post('/fees/bulk', verifyToken, admin.bulkCreateFees)
router.put('/fees/bulk', verifyToken, admin.bulkEditFees)






// BOOK RELATED CONTROLLERS FLOW
router.post("/library", verifyToken, admin.createBookDetails);
router.put("/library/:bookId", verifyToken, admin.updateBook);
router.post("/library/issue", verifyToken, admin.issueBook);
router.get("/library", verifyToken, admin.getBooks); // Dynamic GET
router.put("/library/return/:issueId", verifyToken, admin.returnBook);
router.delete("/library/:bookId", verifyToken, admin.deleteBook);




// ITEM RELATED CONTROLLERS FLOW
router.post("/inventory", verifyToken, admin.createItemDetails);
router.get("/inventory", verifyToken, admin.getItems); // Dynamic GET
router.get("/inventory/all", verifyToken, admin.getAllItems); 
router.put("/inventory/:itemId", verifyToken, admin.updateItem);
router.delete("/inventory/:itemId", verifyToken, admin.deleteItem);
router.post("/inventory/sell/:itemId", verifyToken, admin.sellItem);
router.post("/inventory/multi-sell", verifyToken, admin.multiSellItem);

router.post("/items", verifyToken, admin.createItem);
router.put("/items/:itemId", verifyToken, admin.updateItem);
router.post("/purchase-orders", verifyToken, admin.createPurchaseOrder);
router.put("/purchase-orders/:orderId/receive", verifyToken, admin.receivePurchaseOrder);
router.post("/sales", verifyToken, admin.createSale);
router.post("/returns", verifyToken, admin.processReturn);
router.get("/sales", verifyToken, admin.getAllSales);
router.post("/duesandsales", verifyToken, admin.payDuesAndAddSale);
router.get("/inventory/stats", verifyToken, admin.getInventoryStats);
router.get("/items", verifyToken, admin.getAllItems); // Existing endpoint

router.get("/receipts/:saleNumber", verifyToken, admin.generateReceipt);
router.get("/salesdues", verifyToken, admin.getStudentsWithDues);






// BUNDLE RELATED CONTROLLERS FLOW
// Add these lines to your existing adminRoute.js after other routes
router.post("/bundles", verifyToken, admin.createBundle);
router.get("/bundles", verifyToken, admin.getBundles);
router.put("/bundles/:bundleId", verifyToken, admin.updateBundle);
router.delete("/bundles/:bundleId", verifyToken, admin.deleteBundle);

router.post("/suppliers", verifyToken, admin.createSupplier);
router.get("/suppliers", verifyToken, admin.getSuppliers);
router.put("/suppliers/:supplierId", verifyToken, admin.updateSupplier);
router.delete("/suppliers/:supplierId", verifyToken, admin.deleteSupplier);
router.post("/supplier-payments", verifyToken, admin.createSupplierPayment);
router.get("/supplier-payments", verifyToken, admin.getSupplierPayments);




// EMPLOYEE RELATED CONTROLLERS FLOW
router.post("/staff", verifyToken, singleUpload, admin.createEmployee);
router.get("/staff", verifyToken, admin.getEmployees); // Dynamic GET
router.put("/staff/:staffId", verifyToken, singleUpload, admin.updateEmployee);
router.put("/staff/:staffId/toggle", verifyToken, admin.toggleEmployeeStatus);




// NOTICE RELATED CONTROLLERS FLOW
router.post("/notice", verifyToken, uploads, admin.createNotice);
router.get("/notice", verifyToken, admin.getNotices);
router.put("/notice/:noticeId", verifyToken, singleUpload, admin.updateNotice);
router.delete("/notice/:noticeId", verifyToken, admin.deleteNotice);




// CURRICULUM RELATED CONTROLLERS FLOW
router.post("/syllabus", verifyToken, uploads, admin.createSyllabus);
router.get("/syllabus", verifyToken, admin.getSyllabuses);
router.put("/syllabus/:syllabusId", verifyToken, uploads, admin.updateSyllabus);
router.delete("/syllabus/:syllabusId", verifyToken, admin.deleteSyllabus);




// ASSIGNMENT RELATED CONTROLLERS FLOW
router.post("/task", verifyToken, uploads, admin.createTask);
router.get("/task", verifyToken, admin.getTasks);
router.put("/task/:taskId", verifyToken, uploads, admin.updateTask);
router.delete("/task/:taskId", verifyToken, admin.deleteTask);





// EXAM RELATED CONTROLLERS FLOW
router.post("/exam", verifyToken, admin.createAdminExam);
router.get("/exam", verifyToken, admin.getAdminExams);
router.put("/exam/:examId", verifyToken, admin.updateAdminExam);
router.delete("/exam/:examId", verifyToken, admin.deleteAdminExam);




// MARKS RELATED CONTROLLERS FLOW
router.post("/marks/bulk", verifyToken, admin.bulkUploadAdminMarks);
router.get("/marks", verifyToken, admin.getAdminMarks);
router.put("/marks/:marksId", verifyToken, admin.updateAdminMark);
router.delete("/marks/:marksId", verifyToken, admin.deleteAdminMark);












// PENDING ADMISSION THIRD PARTY
router.patch('/approveAdmission/:studentId', verifyToken, admin.approveAdmission);
router.post('/approveAdmissions', verifyToken, admin.approveMultipleAdmissions);
router.get('/pendingAdmissions', verifyToken, admin.getPendingAdmissions);






// router.get('/getAllStudentOfClass', verifyToken, admin.getAllStudentOfClass);
router.put('/promotionOfStudent', verifyToken, admin.promotionOfStudent);
router.get('/getStudentsBySession', verifyToken, admin.getStudentsBySession);
















// OBSOLETE OR UNNECESSARY CONTROLLERS
router.delete('/deleteStudentsBySchool', verifyToken, admin.deleteStudentsBySchool)
router.delete('/deleteStudentsByClass', verifyToken, admin.deleteStudentsByClass)
router.delete('/deleteStudent', verifyToken, singleUpload, admin.deleteStudent);
router.get('/students/filter', verifyToken, admin.getStudentsByClassSectionAdmin);
router.get('/students/lastyear', verifyToken, admin.getStudentsCreatedAfterAprilOfCurrentYear)
router.get('/students', verifyToken, admin.getAllStudents)
router.get('/parents', verifyToken, admin.getAllParents);
router.get('/students/:admissionNumber', verifyToken, uploads, admin.getDataByAdmissionNumber);
router.get('/allparentswithchildren', verifyToken, admin.getAllParentsWithChildren);
router.post('/addSibling', verifyToken, uploads, admin.addSibling);
router.get('/students/inactive', verifyToken, singleUpload, admin.getDeactivatedStudents);
router.get('/getRegistration/:registrationNumber', verifyToken, uploads, admin.getRegistrationByNumber);
router.delete('/deleteRegistration/:registrationNumber', verifyToken, uploads, admin.deleteRegistration);
router.get('/getAllStudentStatus', verifyToken, admin.getAllStudentStatus)
router.get('/myKids', verifyToken, admin.getMyKids);




// router.put("/updateAdditionalFees/:feeStructureId", verifyToken, admin.updateAdditionalFee);

// LIBRARY RELATED CONTROLLERS FLOW
// router.post('/issueBook', verifyToken, admin.issueBook);
// router.put('/returnBook/:issueId', verifyToken, admin.returnBook);
// router.get('/getAllIssuedBookStudent', verifyToken, admin.getAllIssuedBookStudent);

// router.delete('/deleteAdditionalFees/:feeStructureId', verifyToken, admin.deleteAdditionalFee)
module.exports = router 