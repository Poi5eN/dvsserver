// controllers/superAdminController.js
const Collection = require('../models/adminModel');
const SuperAdmin = require('../models/superAdminModel');
const UserCredentials = require('../models/userCredentialsModel');
const bcrypt = require('bcryptjs');
const { hashPassword } = require('./authController');
const { v4: uuidv4 } = require('uuid');
const sendEmail = require('../utils/email');
const ThirdPartyUser = require('../models/thirdPartyModel');
const ReceptionistModel = require('../models/receptionistModel');
const s3 = require('../config/minio');
const AdminInfo = require('../models/adminModel');
const { sanitizeHtml } = require('../utils/sanitize'); // Add this import

// console.log('s3 in controller:', s3); // Debug log

// In your createAdmin controller
// Create SuperAdmin (No Auth Required)
exports.createSuperAdmin = async (req, res) => {
  try {
    const { email, password, name, rootAdminId } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and name',
      });
    }

    const existingSuperAdmin = await SuperAdmin.findOne({ email });
    if (existingSuperAdmin) {
      return res.status(409).json({
        success: false,
        message: 'SuperAdmin with this email already exists',
      });
    }

    const hashedPassword = await hashPassword(password);
    const superAdminId = uuidv4();

    await SuperAdmin.create({
      superAdminId,
      email,
      password: hashedPassword,
      name,
      createdBy: rootAdminId, // Ensures required field is provided
    });

    const emailContent = `
      <p>Your SuperAdmin credentials:</p>
      <p>Email: ${email}</p>
      <p>Password: ${password}</p>
    `;
    await sendEmail(email, 'SuperAdmin Account Created', emailContent);

    res.status(201).json({
      success: true,
      message: 'SuperAdmin created successfully',
      superAdmin: { superAdminId, email, name },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// SuperAdmin Login
exports.loginSuperAdmin = async (req, res) => {
  console.log('Request body:', req.body);
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find SuperAdmin by email and include password field
    const superAdmin = await SuperAdmin.findOne({ email }).select('+password');
    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Compare provided password with stored hashed password
    const isMatch = await bcrypt.compare(password, superAdmin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Successful login response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      superAdmin: {
        superAdminId: superAdmin.superAdminId,
        email: superAdmin.email,
        name: superAdmin.name,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// controllers/superAdminController.js (updated createAdmin)
exports.createAdmin = async (req, res) => {
  try {
    const { email, password, schoolName, superAdminId, ...userFields } = req.body;
    const file = req.file;

    if (!email || !password || !schoolName || !superAdminId) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields' });
    }

    const slug = schoolName.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');
    const existingAdmin = await AdminInfo.findOne({ $or: [{ email }, { slug }] });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: `Admin with this ${existingAdmin.email === email ? 'email' : 'school name'} already exists`,
      });
    }

    // Check for existing credentials
    const schoolId = uuidv4();
    const existingCredentials = await UserCredentials.findOne({ $or: [{ email }, { userId: schoolId }] });
    if (existingCredentials) {
      return res.status(409).json({
        success: false,
        message: `Credentials with this ${existingCredentials.email === email ? 'email' : 'userId'} already exist`,
      });
    }

    const hashedPassword = await hashPassword(password);
    let imageObj = {};
    if (file) {
      const fileKey = `admins/${Date.now()}-${file.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };
      const minioData = await s3.upload(params).promise();
      imageObj = { public_id: fileKey, url: minioData.Location };
    }

    const admin = await AdminInfo.create({
      schoolId,
      email,
      password: hashedPassword,
      schoolName,
      slug,
      createdBy: superAdminId,
      image: imageObj,
      ...userFields,
    });

    // Save credentials in UserCredentials model
    try {
      await UserCredentials.create({
        userId: schoolId,
        email,
        password, // Store plain-text password
        userType: 'admin',
        schoolName,
        createdBy: superAdminId,
      });
      console.log(`Credentials saved for admin: ${email}`);
    } catch (credError) {
      await AdminInfo.deleteOne({ schoolId });
      throw new Error(`Failed to save credentials: ${credError.message}`);
    }

    const schoolImageUrl = imageObj.url || 'https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg';
    const softwareLogoUrl = 'https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png';
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>School Admin Account Created</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Comic Sans MS', Arial, sans-serif; background-color: #e0f7fa; color: #000000;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
              <img src="${schoolImageUrl}" alt="${schoolName}" style="max-width: 120px; height: auto; border-radius: 50%; border: 3px solid #fff; margin-bottom: 10px;" onerror="this.src='https://i.ibb.co/1Y1qz1g/school.webp';">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">${schoolName}</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Welcome to Your School Portal</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, School Admin!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Your admin account for ${schoolName} has been created successfully.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Credentials</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Login URL:</strong> <a href="https://digitalvidyasaarthi.in/${slug}" style="color: #ff5600;">https://digitalvidyasaarthi.in/${slug}</a></p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>School ID:</strong> ${schoolId}</p>
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Log in to manage your school’s operations with ease!</p>
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
    await sendEmail(email, 'Your School Portal Credentials', emailContent);

    res.status(201).json({ success: true, message: 'Admin created successfully', admin });
  } catch (error) {
    console.error(`Error in createAdmin: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};



// controllers/superAdminController.js (updated getAdminsBySuperAdmin)
exports.getAdminsBySuperAdmin = async (req, res) => {
  try {
    const { superAdminId } = req.params;
    const admins = await AdminInfo.find({ createdBy: superAdminId });
    
    const adminIds = admins.map(admin => admin.schoolId);
    const credentials = await UserCredentials.find({
      userId: { $in: adminIds },
      createdBy: superAdminId,
      userType: 'admin',
    }).select('+password');

    const missingCredentials = adminIds.filter(id => !credentials.some(cred => cred.userId === id));
    if (missingCredentials.length > 0) {
      console.warn(`No credentials found for adminIds: ${missingCredentials.join(', ')}`);
    }

    const responseAdmins = admins.map(admin => {
      const credential = credentials.find(cred => cred.userId === admin.schoolId);
      return {
        ...admin._doc,
        password: credential ? credential.password : null,
      };
    });

    res.status(200).json({
      success: true,
      totalAdmins: admins.length,
      admins: responseAdmins,
    });
  } catch (error) {
    console.error(`Error in getAdminsBySuperAdmin: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// // Get admins created by a specific SuperAdmin
// // Get Admins by SuperAdmin
// exports.getAdminsBySuperAdmin = async (req, res) => {
//   try {
//     const { superAdminId } = req.params;
//     const admins = await AdminInfo.find({ createdBy: superAdminId }).select('+plainPassword');
//     res.status(200).json({
//       success: true,
//       totalAdmins: admins.length,
//       admins: admins.map(admin => ({
//         ...admin._doc,
//         password: admin.plainPassword, // Return plain-text password as 'password'
//       })),
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// In your updateAdmin controller
// Modified createThirdPartyUser to include createdBy
exports.createThirdPartyUser = async (req, res) => {
  try {
    const { name, email, password, assignedSchools, session, superAdminId } = req.body;
    const file = req.file;

    if (!name || !email || !password || !assignedSchools || !session || !superAdminId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields: name, email, password, assignedSchools, session, and superAdminId' 
      });
    }

    const userExists = await ThirdPartyUser.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const userId = uuidv4();
    const existingCredentials = await UserCredentials.findOne({ $or: [{ email }, { userId }] });
    if (existingCredentials) {
      return res.status(409).json({
        success: false,
        message: `Credentials with this ${existingCredentials.email === email ? 'email' : 'userId'} already exist`,
      });
    }

    const hashedPassword = await hashPassword(password);
    let imageObj = {};
    if (file) {
      const fileKey = `thirdparty/${Date.now()}-${file.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };
      const minioData = await s3.upload(params).promise();
      imageObj = { public_id: fileKey, url: minioData.Location };
    }

    let parsedAssignedSchools;
    try {
      parsedAssignedSchools = JSON.parse(assignedSchools);
      if (!Array.isArray(parsedAssignedSchools)) {
        throw new Error('assignedSchools must be an array');
      }
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid format for assignedSchools: ' + error.message });
    }

    const thirdPartyUser = await ThirdPartyUser.create({
      userId,
      name,
      email,
      password: hashedPassword,
      assignedSchools: parsedAssignedSchools,
      session,
      image: imageObj,
      createdBy: superAdminId,
    });

    // Save credentials in UserCredentials model
    try {
      await UserCredentials.create({
        userId,
        email,
        password, // Store plain-text password
        userType: 'thirdparty',
        createdBy: superAdminId,
      });
      console.log(`Credentials saved for third-party user: ${email}`);
    } catch (credError) {
      await ThirdPartyUser.deleteOne({ userId });
      throw new Error(`Failed to save credentials: ${credError.message}`);
    }

    const softwareLogoUrl = 'https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png';
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Third Party Account Created</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Comic Sans MS', Arial, sans-serif; background-color: #e0f7fa; color: #000000;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
              <img src="${softwareLogoUrl}" alt="Digital Vidya Saarthi" style="max-width: 120px; height: auto; margin-bottom: 10px;" onerror="this.src='https://via.placeholder.com/150?text=Digital+Vidya+Saarthi';">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Welcome, Third Party User!</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Your Registration Handler Role Begins</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, ${name}!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Your Third Party account has been created to assist with registrations.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Credentials</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>User ID:</strong> ${userId}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Session:</strong> ${session}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Assigned Schools:</strong></p>
                ${thirdPartyUser.assignedSchools.map((school) => `<p style="margin: 5px 0 0 20px; font-size: 16px;">- ${school.schoolName}</p>`).join('')}
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Log in to start handling registrations for your assigned schools!</p>
            </td>
          </tr>
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
    await sendEmail(email, 'Third Party Registration Account Credentials', emailContent);

    const userResponse = thirdPartyUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'ThirdParty user created successfully',
      user: userResponse,
    });
  } catch (error) {
    console.error(`Error in createThirdPartyUser: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getThirdPartyUsersBySuperAdmin = async (req, res) => {
  try {
    const { superAdminId } = req.params;
    const thirdPartyUsers = await ThirdPartyUser.find({ createdBy: superAdminId });

    const userIds = thirdPartyUsers.map(user => user.userId);
    const credentials = await UserCredentials.find({
      userId: { $in: userIds },
      createdBy: superAdminId,
      userType: 'thirdparty',
    }).select('+password');

    const missingCredentials = userIds.filter(id => !credentials.some(cred => cred.userId === id));
    if (missingCredentials.length > 0) {
      console.warn(`No credentials found for thirdParty userIds: ${missingCredentials.join(', ')}`);
    }

    const responseUsers = thirdPartyUsers.map(user => {
      const credential = credentials.find(cred => cred.userId === user.userId);
      return {
        ...user._doc,
        password: credential ? credential.password : null,
      };
    });

    res.status(200).json({
      success: true,
      totalUsers: thirdPartyUsers.length,
      thirdPartyUsers: responseUsers,
    });
  } catch (error) {
    console.error(`Error in getThirdPartyUsersBySuperAdmin: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// CRUD operations restricted to SuperAdmin's own admins
// Update Admin (Restricted)
exports.updateAdmin = async (req, res) => {
  try {
    const { adminId, superAdminId } = req.params;
    const { email, password, schoolName, ...userFields } = req.body;
    const file = req.file;

    const admin = await AdminInfo.findOne({ _id: adminId, createdBy: superAdminId });
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found or not authorized' });
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

    res.status(200).json({ success: true, message: 'Admin updated successfully', admin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// In your superadmin controller file

exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Collection.find(); // Fetch all admins

    if (!admins) {
      return res.status(404).json({
        success: false,
        message: "No admins found",
      });
    }

    res.status(200).json({
      success: true,
      admins, // Send all admins
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch admins due to an error",
      error: error.message,
    });
  }
};

// In your admin controller
exports.getAdminBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    // Find admin by slug (case-insensitive)
    const admin = await Admin.findOne({ 
      slug: { $regex: new RegExp(`^${slug}$`, 'i') } 
    });
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    res.status(200).json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Other ThirdParty Functions (Updated from Original)
exports.getAllThirdPartyUsers = async (req, res) => {
  try {
    const { superAdminId } = req.params; // Restrict to SuperAdmin
    const thirdPartyUsers = await ThirdPartyUser.find({ createdBy: superAdminId });
    res.status(200).json({ success: true, thirdPartyUsers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get One Third-Party User
exports.getThirdPartyUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const thirdPartyUser = await ThirdPartyUser.findOne({ userId });

    if (!thirdPartyUser) {
      return res.status(404).json({
        success: false,
        message: 'Third-party user not found',
      });
    }

    res.status(200).json({
      success: true,
      thirdPartyUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateThirdPartyUser = async (req, res) => {
  try {
    const { userId, superAdminId } = req.params;
    const { name, email, password, assignedSchools, session } = req.body;
    const file = req.file;

    const thirdPartyUser = await ThirdPartyUser.findOne({ userId, createdBy: superAdminId });
    if (!thirdPartyUser) {
      return res.status(404).json({ success: false, message: 'ThirdParty user not found or not authorized' });
    }

    if (name) thirdPartyUser.name = name;
    if (email) thirdPartyUser.email = email;
    if (password) thirdPartyUser.password = await hashPassword(password);
    if (session) thirdPartyUser.session = session; // Update session if provided
    if (assignedSchools) {
      try {
        const parsedAssignedSchools = JSON.parse(assignedSchools);
        if (!Array.isArray(parsedAssignedSchools)) {
          throw new Error('assignedSchools must be an array');
        }
        thirdPartyUser.assignedSchools = parsedAssignedSchools;
      } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid format for assignedSchools: ' + error.message });
      }
    }

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

exports.deleteThirdPartyUser = async (req, res) => {
  try {
    const { userId, superAdminId } = req.params;
    const deletedUser = await ThirdPartyUser.findOneAndDelete({ userId, createdBy: superAdminId });
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: 'ThirdParty user not found or not authorized' });
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



// RECEPTIONIST CONTROLLER FLOW
// Create Receptionist
exports.createReceptionist = async (req, res) => {
  try {
    const { name, email, password, assignedSchools, superAdminId } = req.body;
    const file = req.file;

    if (!name || !email || !password || !assignedSchools || !superAdminId) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const userExists = await ReceptionistModel.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const hashedPassword = await hashPassword(password);
    const userId = uuidv4();
    let imageObj = {};
    if (file) {
      const fileKey = `receptionists/${Date.now()}-${file.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };
      const minioData = await s3.upload(params).promise();
      imageObj = { public_id: fileKey, url: minioData.Location };
    }

    let parsedAssignedSchools;
    try {
      parsedAssignedSchools = JSON.parse(assignedSchools);
      if (!Array.isArray(parsedAssignedSchools)) {
        throw new Error('assignedSchools must be an array');
      }
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid format for assignedSchools: ' + error.message });
    }

    const receptionist = await ReceptionistModel.create({
      userId,
      name,
      email,
      password: hashedPassword,
      assignedSchools: parsedAssignedSchools,
      image: imageObj,
      createdBy: superAdminId,
    });

    const softwareLogoUrl = 'https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png';
    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receptionist Account Created</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Comic Sans MS', Arial, sans-serif; background-color: #e0f7fa; color: #000000;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
              <img src="${softwareLogoUrl}" alt="Digital Vidya Saarthi" style="max-width: 120px; height: auto; margin-bottom: 10px;" onerror="this.src='https://via.placeholder.com/150?text=Digital+Vidya+Saarthi';">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Welcome, Receptionist!</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Your Registration Role Begins</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, ${name}!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Your Receptionist account has been created to manage registrations.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Credentials</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>User ID:</strong> ${userId}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Assigned Schools:</strong></p>
                ${receptionist.assignedSchools.map((school) => `<p style="margin: 5px 0 0 20px; font-size: 16px;">- ${school.schoolName}</p>`).join('')}
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Log in to start assisting with school registrations!</p>
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
    await sendEmail(email, 'Receptionist Account Credentials', emailContent);

    const userResponse = receptionist.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'Receptionist created successfully',
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Receptionists
exports.getAllReceptionists = async (req, res) => {
  try {
    const { superAdminId } = req.params;
    const receptionists = await ReceptionistModel.find({ createdBy: superAdminId });
    res.status(200).json({ success: true, receptionists });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Receptionist
exports.updateReceptionist = async (req, res) => {
  try {
    const { userId, superAdminId } = req.params;
    const { name, email, password, assignedSchools } = req.body;
    const file = req.file;

    const receptionist = await ReceptionistModel.findOne({ userId, createdBy: superAdminId });
    if (!receptionist) {
      return res.status(404).json({ success: false, message: 'Receptionist not found or not authorized' });
    }

    if (name) receptionist.name = name;
    if (email) receptionist.email = email;
    if (password) receptionist.password = await hashPassword(password);
    if (assignedSchools) {
      try {
        const parsedAssignedSchools = JSON.parse(assignedSchools);
        if (!Array.isArray(parsedAssignedSchools)) {
          throw new Error('assignedSchools must be an array');
        }
        receptionist.assignedSchools = parsedAssignedSchools;
      } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid format for assignedSchools: ' + error.message });
      }
    }

    if (file) {
      if (receptionist.image && receptionist.image.public_id) {
        await s3.deleteObject({
          Bucket: process.env.MINIO_BUCKET,
          Key: receptionist.image.public_id,
        }).promise();
      }
      const fileKey = `receptionists/${Date.now()}-${file.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };
      const minioData = await s3.upload(params).promise();
      receptionist.image = { public_id: fileKey, url: minioData.Location };
    }

    await receptionist.save();

    res.status(200).json({
      success: true,
      message: 'Receptionist updated successfully',
      user: receptionist,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Receptionist
exports.deleteReceptionist = async (req, res) => {
  try {
    const { userId, superAdminId } = req.params;
    const deletedUser = await ReceptionistModel.findOneAndDelete({ userId, createdBy: superAdminId });
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: 'Receptionist not found or not authorized' });
    }
    if (deletedUser.image && deletedUser.image.public_id) {
      await s3.deleteObject({
        Bucket: process.env.MINIO_BUCKET,
        Key: deletedUser.image.public_id,
      }).promise();
    }
    res.status(200).json({ success: true, message: 'Receptionist deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};