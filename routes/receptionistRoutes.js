// routes/receptionistRoutes.js
const express = require('express');
const router = express.Router();
const receptionistRegistrationController = require('../controllers/receptionistRegistrationController');
const { uploads } = require('../middleware/multer');
const verifyToken = require('../middleware/auth');

router.post('/registrations', verifyToken, uploads, receptionistRegistrationController.createRegistration);
router.put('/registrations/:registrationId', verifyToken, uploads, receptionistRegistrationController.editRegistration);
router.get('/registrations', verifyToken, receptionistRegistrationController.getAllRegistrationsForReceptionist);
router.get('/registrations/school', verifyToken, receptionistRegistrationController.getRegistrationsBySchool);
router.get('/registrations/filter', verifyToken, receptionistRegistrationController.getRegistrationsByClassSection);
router.get('/my-registrations', verifyToken, receptionistRegistrationController.getMyRegistrations);
router.get('/my-registrations/school', verifyToken, receptionistRegistrationController.getMyRegistrationsBySchool);
router.put('/my-registrations/:registrationId', verifyToken, receptionistRegistrationController.updateMyRegistration);
router.put('/registrations/:registrationId/update', verifyToken, receptionistRegistrationController.updateAnyRegistration);
router.get('/classes', verifyToken, receptionistRegistrationController.getClassesForSchool);

module.exports = router;