// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { loginSuperAdmin } = require('../controllers/superAdminAuthController');

router.post('/superadmin/login', loginSuperAdmin);

module.exports = router;