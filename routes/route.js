// routes/index.js
const { Router } = require('express');
const adminRoute = require('./adminRoute');
const accountUser = require('./accountUser');
const superAdmin = require('./superAdmin');
const contactUs = require('./contactUs');
const teacher = require('./teacher');
const { loginAll, logout } = require('../controllers/loginController');
const classTimeTable = require('./classTimeTable');
const exam = require('./exam');
const marks = require('./marks');
const results = require('./results');
const feeStatus = require('./feeStatus');
const inventory = require('./inventory');
const employee = require('./employee');
const event = require('./event');
const thirdParty = require('./thirdparty');
const authRoutes = require('./authRoutes');
const superAdminRoutes = require('./superAdmin');
const rootAdmin = require('./rootAdmin');
const receptionistRoutes = require('./receptionistRoutes'); // New import
const receipts = require('./receipts'); // New import

const router = Router();

router.post('/login', loginAll);
router.get('/logout', logout);
router.use('/adminRoute', adminRoute);
router.use('/accountUser', accountUser);
router.use('/superAdmin', superAdmin);
router.use('/rootAdmin', rootAdmin);
router.use('/contactUs', contactUs);
router.use('/timeTable', classTimeTable);
router.use('/exam', exam);
router.use('/marks', marks);
router.use('/teacher', teacher);
router.use('/results', results);
router.use('/employee', employee);
router.use('/fees', feeStatus);
router.use('/inventory', inventory);
router.use('/events', event);
router.use('/thirdparty', thirdParty);
router.use('/auth', authRoutes);
router.use('/superadmin', superAdminRoutes);
router.use('/receptionist', receptionistRoutes); // New route
router.use('/receipts', receipts); // New route

module.exports = router;