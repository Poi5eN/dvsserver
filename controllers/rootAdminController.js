// controllers/rootAdminController.js
const RootAdmin = require('../models/rootAdminModel');
const SuperAdmin = require('../models/superAdminModel');
const AdminInfo = require('../models/adminModel');
const ThirdPartyUser = require('../models/thirdPartyModel');
const { hashPassword } = require('./authController'); // Assuming this exists
const { v4: uuidv4 } = require('uuid');
const sendEmail = require('../utils/email');
const bcrypt = require('bcryptjs');
const s3 = require('../config/minio');

// Create RootAdmin (No Auth - Initial Setup)
exports.createRootAdmin = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Please provide email, password, and name' });
    }

    const existingRootAdmin = await RootAdmin.findOne({ email });
    if (existingRootAdmin) {
      return res.status(409).json({ success: false, message: 'RootAdmin already exists' });
    }

    const hashedPassword = await hashPassword(password);
    const rootAdminId = uuidv4();

    await RootAdmin.create({
      rootAdminId,
      email,
      password: hashedPassword,
      name,
    });

    const softwareLogoUrl = 'https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png';
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RootAdmin Account Created</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Comic Sans MS', Arial, sans-serif; background-color: #e0f7fa; color: #000000;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
              <img src="${softwareLogoUrl}" alt="Digital Vidya Saarthi" style="max-width: 120px; height: auto; margin-bottom: 10px;" onerror="this.src='https://via.placeholder.com/150?text=Digital+Vidya+Saarthi';">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Welcome, RootAdmin!</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Your System Oversight Begins</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, ${name}!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Your RootAdmin account has been created, granting you the highest level of access to Digital Vidya Saarthi.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Credentials</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>RootAdmin ID:</strong> ${rootAdminId}</p>
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Log in to oversee the entire system and create SuperAdmins!</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #e5e5e5; padding: 20px; text-align: center;">
              <img src="${softwareLogoUrl}" alt="Digital Vidya Saarthi | Vidyaalay ERP" style="max-width: 150px; height: auto; margin-bottom: 10px;" onerror="this.src='https://via.placeholder.com/150?text=Digital+Vidya+Saarthi';">
              <p style="margin: 0; font-size: 16px; color: #000000; font-weight: bold;">Digital Vidya Saarthi | Vidyaalay ERP</p>
              <p style="margin: 5px 0; font-size: 14px; color: #000000;">Empowering Education with Technology</p>
              <p style="margin: 5px 0; font-size: 12px; color: #000000;">
                Contact us: <a href="mailto:digitalvidyasaarthi@gmail.com" style="color: #ff5600; text-decoration: none;">digitalvidyasaarthi@gmail.com</a> | 
                <a href="https://digitalvidyasaarthi.in" style="color: #ff5600; text-decoration: none;">DigitalVidyaSaarthi.in</a>
              </p>
              <p style="margin: 5px 0 0; font-size: 12px; color: #000000;">© ${new Date().getFullYear()} All Rights Reserved</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    await sendEmail(email, 'RootAdmin Account Created', emailContent);

    res.status(201).json({
      success: true,
      message: 'RootAdmin created successfully',
      rootAdmin: { rootAdminId, email, name },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// RootAdmin Login
exports.loginRootAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const rootAdmin = await RootAdmin.findOne({ email }).select('+password');
    if (!rootAdmin || !(await bcrypt.compare(password, rootAdmin.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      rootAdmin: { rootAdminId: rootAdmin.rootAdminId, email, name: rootAdmin.name },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create SuperAdmin by RootAdmin
exports.createSuperAdmin = async (req, res) => {
  try {
    const { email, password, name, rootAdminId } = req.body;

    if (!email || !password || !name || !rootAdminId) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const rootAdminExists = await RootAdmin.findOne({ rootAdminId });
    if (!rootAdminExists) {
      return res.status(403).json({ success: false, message: 'Invalid RootAdmin ID' });
    }

    const existingSuperAdmin = await SuperAdmin.findOne({ email });
    if (existingSuperAdmin) {
      return res.status(409).json({ success: false, message: 'SuperAdmin already exists' });
    }

    const hashedPassword = await hashPassword(password);
    const superAdminId = uuidv4();

    await SuperAdmin.create({
      superAdminId,
      email,
      password: hashedPassword,
      name,
      createdBy: rootAdminId,
    });

    const softwareLogoUrl = 'https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png';
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SuperAdmin Account Created</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Comic Sans MS', Arial, sans-serif; background-color: #e0f7fa; color: #000000;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
              <img src="${softwareLogoUrl}" alt="Digital Vidya Saarthi" style="max-width: 120px; height: auto; margin-bottom: 10px;" onerror="this.src='https://via.placeholder.com/150?text=Digital+Vidya+Saarthi';">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Welcome, SuperAdmin!</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Your System Management Journey Begins</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, ${name}!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Your SuperAdmin account has been successfully created. You now have full control over the Digital Vidya Saarthi system.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Credentials</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>SuperAdmin ID:</strong> ${superAdminId}</p>
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Log in to start managing schools, admins, and more!</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #e5e5e5; padding: 20px; text-align: center;">
              <img src="${softwareLogoUrl}" alt="Digital Vidya Saarthi | Vidyaalay ERP" style="max-width: 150px; height: auto; margin-bottom: 10px;" onerror="this.src='https://via.placeholder.com/150?text=Digital+Vidya+Saarthi';">
              <p style="margin: 0; font-size: 16px; color: #000000; font-weight: bold;">Digital Vidya Saarthi | Vidyaalay ERP</p>
              <p style="margin: 5px 0; font-size: 14px; color: #000000;">Empowering Education with Technology</p>
              <p style="margin: 5px 0; font-size: 12px; color: #000000;">
                Contact us: <a href="mailto:digitalvidyasaarthi@gmail.com" style="color: #ff5600; text-decoration: none;">digitalvidyasaarthi@gmail.com</a> | 
                <a href="https://digitalvidyasaarthi.in" style="color: #ff5600; text-decoration: none;">DigitalVidyaSaarthi.in</a>
              </p>
              <p style="margin: 5px 0 0; font-size: 12px; color: #000000;">© ${new Date().getFullYear()} All Rights Reserved</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    await sendEmail(email, 'SuperAdmin Account Created', emailContent);

    res.status(201).json({
      success: true,
      message: 'SuperAdmin created successfully',
      superAdmin: { superAdminId, email, name },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Data (Counts and Full Records)
exports.getAllData = async (req, res) => {
  try {
    const superAdmins = await SuperAdmin.find();
    const admins = await AdminInfo.find();
    const thirdPartyUsers = await ThirdPartyUser.find();

    res.status(200).json({
      success: true,
      counts: {
        totalSuperAdmins: superAdmins.length,
        totalAdmins: admins.length,
        totalThirdPartyUsers: thirdPartyUsers.length,
      },
      data: {
        superAdmins,
        admins,
        thirdPartyUsers,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CRUD for SuperAdmins
exports.updateSuperAdmin = async (req, res) => {
  try {
    const { superAdminId } = req.params;
    const { email, password, name } = req.body;

    const updateData = {};
    if (email) updateData.email = email;
    if (password) updateData.password = await hashPassword(password);
    if (name) updateData.name = name;

    const updatedSuperAdmin = await SuperAdmin.findOneAndUpdate(
      { superAdminId },
      updateData,
      { new: true }
    );

    if (!updatedSuperAdmin) {
      return res.status(404).json({ success: false, message: 'SuperAdmin not found' });
    }

    res.status(200).json({
      success: true,
      message: 'SuperAdmin updated',
      superAdmin: updatedSuperAdmin,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSuperAdmin = async (req, res) => {
  try {
    const { superAdminId } = req.params;
    const deletedSuperAdmin = await SuperAdmin.findOneAndDelete({ superAdminId });
    if (!deletedSuperAdmin) {
      return res.status(404).json({ success: false, message: 'SuperAdmin not found' });
    }
    res.status(200).json({ success: true, message: 'SuperAdmin deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CRUD for Admins (Unrestricted Access)
exports.updateAnyAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { email, password, schoolName, ...userFields } = req.body;
    const file = req.file;

    const admin = await AdminInfo.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    if (email) admin.email = email;
    if (password) admin.password = await hashPassword(password);
    if (schoolName) {
      admin.schoolName = schoolName;
      admin.slug = schoolName.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');
    }
    Object.assign(admin, userFields);

    if (file) {
      if (admin.image && admin.image.public_id) {
        await s3.deleteObject({
          Bucket: process.env.MINIO_BUCKET,
          Key: admin.image.public_id,
        }).promise();
      }
      const fileKey = `admins/${Date.now()}-${file.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };
      const minioData = await s3.upload(params).promise();
      admin.image = { public_id: fileKey, url: minioData.Location };
    }

    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Admin updated successfully',
      admin,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAnyAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const deletedAdmin = await AdminInfo.findByIdAndDelete(adminId);
    if (!deletedAdmin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    if (deletedAdmin.image && deletedAdmin.image.public_id) {
      await s3.deleteObject({
        Bucket: process.env.MINIO_BUCKET,
        Key: deletedAdmin.image.public_id,
      }).promise();
    }
    res.status(200).json({ success: true, message: 'Admin deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CRUD for ThirdParty Users (Unrestricted Access)
exports.updateAnyThirdParty = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, password, assignedSchools } = req.body;
    const file = req.file;

    const thirdPartyUser = await ThirdPartyUser.findOne({ userId });
    if (!thirdPartyUser) {
      return res.status(404).json({ success: false, message: 'ThirdParty user not found' });
    }

    if (name) thirdPartyUser.name = name;
    if (email) thirdPartyUser.email = email;
    if (password) thirdPartyUser.password = await hashPassword(password);
    if (assignedSchools) thirdPartyUser.assignedSchools = assignedSchools;

    if (file) {
      if (thirdPartyUser.image && thirdPartyUser.image.public_id) {
        await s3.deleteObject({
          Bucket: process.env.MINIO_BUCKET,
          Key: thirdPartyUser.image.public_id,
        }).promise();
      }
      const fileKey = `thirdparty/${Date.now()}-${file.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };
      const minioData = await s3.upload(params).promise();
      thirdPartyUser.image = { public_id: fileKey, url: minioData.Location };
    }

    await thirdPartyUser.save();

    res.status(200).json({
      success: true,
      message: 'ThirdParty user updated successfully',
      user: thirdPartyUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAnyThirdParty = async (req, res) => {
  try {
    const { userId } = req.params;
    const deletedUser = await ThirdPartyUser.findOneAndDelete({ userId });
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: 'ThirdParty user not found' });
    }
    if (deletedUser.image && deletedUser.image.public_id) {
      await s3.deleteObject({
        Bucket: process.env.MINIO_BUCKET,
        Key: deletedUser.image.public_id,
      }).promise();
    }
    res.status(200).json({ success: true, message: 'ThirdParty user deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};