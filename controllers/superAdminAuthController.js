// controllers/superAdminAuthController.js
const SuperAdmin = require('../models/superAdminModel');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.loginSuperAdmin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const superAdmin = await SuperAdmin.findOne({ username });
    if (!superAdmin) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isMatch = await superAdmin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: superAdmin._id, role: superAdmin.role },
      process.env.JWT_SECRET || 'THESECRETKEY', // Store this in .env
      { expiresIn: '1d' } // Token expires in 1 day
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};