// controllers/receptionistRegistrationController.js
const NewRegistrationModel = require('../models/newRegistrationModel');
const classModel = require('../models/classModel');
const AdminInfo = require('../models/adminModel');
const sendEmail = require('../utils/email');
const s3 = require('../config/minio');
const { hashPassword } = require('./authController');
const { v4: uuidv4 } = require('uuid');
const { generateStructuredNumber } = require('../utils/numberGenerator');

// Generate Registration Number
const generateRegistrationNumber = async (schoolId) => {
  return generateStructuredNumber(schoolId, NewRegistrationModel, 'registrationNumber');
};

const generateAdmissionNumber = async (schoolId) => {
  return generateStructuredNumber(schoolId, NewRegistrationModel, 'admissionNo');
};

// Create Registration
exports.createRegistration = async (req, res) => {
  try {
    const { schoolId } = req.body;
    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to create registrations for this school.",
      });
    }

    const {
      studentFullName, guardianName, registerClass, studentAddress, mobileNumber, studentEmail, gender, amount,
      rollNo, admissionNo, fatherName, motherName, remarks, transport,
    } = req.body;

    if (!studentFullName || !guardianName || !registerClass || !studentAddress || !mobileNumber || !studentEmail || 
        !gender || !amount || !rollNo || !fatherName || !motherName || !remarks || !transport) {
      return res.status(400).json({ success: false, message: "All fields except admissionNo are required." });
    }

    const registrationExist = await NewRegistrationModel.findOne({ mobileNumber, schoolId });
    if (registrationExist) {
      return res.status(400).json({ success: false, message: "Already registered in this school!" });
    }

    const finalAdmissionNo = admissionNo && admissionNo.trim() !== "" 
      ? admissionNo 
      : await generateAdmissionNumber(schoolId);

    const registrationNumber = await generateRegistrationNumber(schoolId);
    const files = req.files || [];
    let studentPhotoResult = {}, fatherPhotoResult = {}, motherPhotoResult = {}, guardianPhotoResult = {};
    const studentPhoto = files.find(f => f.fieldname === 'studentPhoto');
    const fatherPhoto = files.find(f => f.fieldname === 'fatherPhoto');
    const motherPhoto = files.find(f => f.fieldname === 'motherPhoto');
    const guardianPhoto = files.find(f => f.fieldname === 'guardianPhoto');

    if (studentPhoto) {
      const fileKey = `registrations/student/${Date.now()}-${studentPhoto.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: studentPhoto.buffer, ContentType: studentPhoto.mimetype, ACL: 'public-read' };
      const minioData = await s3.upload(params).promise();
      studentPhotoResult = { public_id: fileKey, url: minioData.Location };
    }
    if (fatherPhoto) {
      const fileKey = `registrations/father/${Date.now()}-${fatherPhoto.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: fatherPhoto.buffer, ContentType: fatherPhoto.mimetype, ACL: 'public-read' };
      const minioData = await s3.upload(params).promise();
      fatherPhotoResult = { public_id: fileKey, url: minioData.Location };
    }
    if (motherPhoto) {
      const fileKey = `registrations/mother/${Date.now()}-${motherPhoto.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: motherPhoto.buffer, ContentType: motherPhoto.mimetype, ACL: 'public-read' };
      const minioData = await s3.upload(params).promise();
      motherPhotoResult = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianPhoto) {
      const fileKey = `registrations/guardian/${Date.now()}-${guardianPhoto.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: guardianPhoto.buffer, ContentType: guardianPhoto.mimetype, ACL: 'public-read' };
      const minioData = await s3.upload(params).promise();
      guardianPhotoResult = { public_id: fileKey, url: minioData.Location };
    }

    const registrationData = await NewRegistrationModel.create({
      schoolId,
      studentFullName,
      guardianName,
      registerClass,
      studentAddress,
      mobileNumber,
      studentEmail,
      gender,
      amount,
      rollNo,
      admissionNo: finalAdmissionNo,
      fatherName,
      motherName,
      remarks,
      transport,
      registrationNumber,
      createdBy: req.user.userId,
      studentPhoto: studentPhotoResult.url ? studentPhotoResult : undefined,
      fatherPhoto: fatherPhotoResult.url ? fatherPhotoResult : undefined,
      motherPhoto: motherPhotoResult.url ? motherPhotoResult : undefined,
      guardianPhoto: guardianPhotoResult.url ? guardianPhotoResult : undefined,
      approvalStatus: "pending",
    });

    // Fetch school details for email branding
    const schoolDetails = await AdminInfo.findOne({ schoolId }).select('schoolName image.url');
    const schoolName = schoolDetails?.schoolName || 'Your School';
    const schoolImageUrl = schoolDetails?.image?.url || 'https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg'; // Fallback image
    const softwareLogoUrl = 'https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png'; // Digital Vidya Saarthi logo URL

    // Log URLs for debugging
    console.log('School Image URL:', schoolImageUrl);
    console.log('Software Logo URL:', softwareLogoUrl);

    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Registration Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Comic Sans MS', Arial, sans-serif; background-color: #e0f7fa; color: #000000;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
              <img src="${schoolImageUrl}" alt="${schoolName}" style="max-width: 120px; height: auto; border-radius: 50%; border: 3px solid #fff; margin-bottom: 10px;" onerror="this.src='https://i.ibb.co/1Y1qz1g/school.webp';">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">${schoolName}</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Welcome to Your Learning Journey!</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, ${studentFullName}!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">We’re thrilled you’ve chosen ${schoolName}! Your registration is ready to kick off an amazing adventure.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Registration Details</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Student Name:</strong> ${studentFullName}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Class:</strong> ${registerClass}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Registration Number:</strong> ${registrationNumber}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Status:</strong> <span style="color: #ff5600; font-weight: bold;">Pending Approval</span></p>
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Hang tight! We’re reviewing your details and will get back to you soon with the next steps.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #e5e5e5; padding: 20px; text-align: center;">
              <img src="${softwareLogoUrl}" alt="Digital Vidya Saarthi | Vidyaalay ERP" style="max-width: 150px; height: auto; margin-bottom: 10px;" onerror="this.src='https://via.placeholder.com/150?text=Digital+Vidya+Saarthi';">
              <p style="margin: 0; font-size: 16px; color: #000000; font-weight: bold;">Digital Vidya Saarthi | Vidyaalay ERP</p>
              <p style="margin: 5px 0; font-size: 14px; color: #000000;">Empowering Education, Simplifying Administration</p>
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
    await sendEmail(studentEmail, "Registration Confirmation", emailContent);

    res.status(201).json({
      success: true,
      message: "Registration created successfully and confirmation email sent.",
      registration: registrationData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create registration due to an error.",
      error: error.message,
    });
  }
};

// Edit Registration
exports.editRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { schoolId } = req.body;

    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to edit registrations for this school.",
      });
    }

    const registration = await NewRegistrationModel.findById(registrationId);
    if (!registration || registration.schoolId !== schoolId) {
      return res.status(404).json({ success: false, message: "Registration not found or not authorized." });
    }

    const formData = req.body;
    const files = req.files || [];
    let studentPhotoResult = registration.studentPhoto || { public_id: "", url: "" };
    let fatherPhotoResult = registration.fatherPhoto || { public_id: "", url: "" };
    let motherPhotoResult = registration.motherPhoto || { public_id: "", url: "" };
    let guardianPhotoResult = registration.guardianPhoto || { public_id: "", url: "" };

    const studentPhoto = files.find(f => f.fieldname === 'studentPhoto');
    const fatherPhoto = files.find(f => f.fieldname === 'fatherPhoto');
    const motherPhoto = files.find(f => f.fieldname === 'motherPhoto');
    const guardianPhoto = files.find(f => f.fieldname === 'guardianPhoto');

    if (studentPhoto) {
      if (studentPhotoResult.public_id) {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: studentPhotoResult.public_id }).promise();
      }
      const fileKey = `registrations/student/${Date.now()}-${studentPhoto.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: studentPhoto.buffer, ContentType: studentPhoto.mimetype, ACL: 'public-read' };
      const minioData = await s3.upload(params).promise();
      studentPhotoResult = { public_id: fileKey, url: minioData.Location };
    }
    if (fatherPhoto) {
      if (fatherPhotoResult.public_id) {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: fatherPhotoResult.public_id }).promise();
      }
      const fileKey = `registrations/father/${Date.now()}-${fatherPhoto.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: fatherPhoto.buffer, ContentType: fatherPhoto.mimetype, ACL: 'public-read' };
      const minioData = await s3.upload(params).promise();
      fatherPhotoResult = { public_id: fileKey, url: minioData.Location };
    }
    if (motherPhoto) {
      if (motherPhotoResult.public_id) {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: motherPhotoResult.public_id }).promise();
      }
      const fileKey = `registrations/mother/${Date.now()}-${motherPhoto.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: motherPhoto.buffer, ContentType: motherPhoto.mimetype, ACL: 'public-read' };
      const minioData = await s3.upload(params).promise();
      motherPhotoResult = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianPhoto) {
      if (guardianPhotoResult.public_id) {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: guardianPhotoResult.public_id }).promise();
      }
      const fileKey = `registrations/guardian/${Date.now()}-${guardianPhoto.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: guardianPhoto.buffer, ContentType: guardianPhoto.mimetype, ACL: 'public-read' };
      const minioData = await s3.upload(params).promise();
      guardianPhotoResult = { public_id: fileKey, url: minioData.Location };
    }

    const updateData = {
      studentFullName: formData.studentFullName || registration.studentFullName,
      guardianName: formData.guardianName || registration.guardianName,
      registerClass: formData.registerClass || registration.registerClass,
      studentAddress: formData.studentAddress || registration.studentAddress,
      mobileNumber: formData.mobileNumber || registration.mobileNumber,
      studentEmail: formData.studentEmail || registration.studentEmail,
      gender: formData.gender || registration.gender,
      amount: formData.amount || registration.amount,
      rollNo: formData.rollNo || registration.rollNo,
      admissionNo: formData.admissionNo || registration.admissionNo,
      fatherName: formData.fatherName || registration.fatherName,
      motherName: formData.motherName || registration.motherName,
      remarks: formData.remarks || registration.remarks,
      transport: formData.transport || registration.transport,
      studentPhoto: studentPhotoResult,
      fatherPhoto: fatherPhotoResult,
      motherPhoto: motherPhotoResult,
      guardianPhoto: guardianPhotoResult,
    };

    const updatedRegistration = await NewRegistrationModel.findByIdAndUpdate(registrationId, updateData, { new: true });

    res.status(200).json({
      success: true,
      message: "Registration updated successfully.",
      registration: updatedRegistration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update registration due to an error.",
      error: error.message,
    });
  }
};

// Get All Registrations for Receptionist
exports.getAllRegistrationsForReceptionist = async (req, res) => {
  try {
    const assignedSchoolIds = req.user.assignedSchools.map(s => s.schoolId);
    const registrations = await NewRegistrationModel.find({ schoolId: { $in: assignedSchoolIds } });
    res.status(200).json({
      success: true,
      message: "Registrations fetched successfully.",
      data: registrations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch registrations due to an error.",
      error: error.message,
    });
  }
};

// Get Registrations by School
exports.getRegistrationsBySchool = async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) {
      return res.status(400).json({ success: false, message: "Please provide a schoolId" });
    }
    const assignedSchoolIds = req.user.assignedSchools.map(s => s.schoolId);
    if (!assignedSchoolIds.includes(schoolId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this school.",
      });
    }
    const registrations = await NewRegistrationModel.find({ schoolId });
    res.status(200).json({
      success: true,
      message: "Registrations fetched successfully.",
      data: registrations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch registrations due to an error.",
      error: error.message,
    });
  }
};

// Get Registrations by Class and Section
exports.getRegistrationsByClassSection = async (req, res) => {
  try {
    const { schoolId, registerClass, studentSection } = req.query;
    const query = {};
    if (schoolId) {
      const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this school.",
        });
      }
      query.schoolId = schoolId;
    } else {
      query.schoolId = { $in: req.user.assignedSchools.map(s => s.schoolId) };
    }
    if (registerClass) query.registerClass = registerClass;
    if (studentSection) query.studentSection = studentSection;

    const registrations = await NewRegistrationModel.find(query);
    res.status(200).json({
      success: true,
      message: "Registrations fetched successfully.",
      data: registrations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch registrations due to an error.",
      error: error.message,
    });
  }
};

// Get My Registrations
exports.getMyRegistrations = async (req, res) => {
  try {
    const assignedSchoolIds = req.user.assignedSchools.map(s => s.schoolId);
    const registrations = await NewRegistrationModel.find({
      schoolId: { $in: assignedSchoolIds },
      createdBy: req.user.userId,
    });
    res.status(200).json({
      success: true,
      message: "Your registrations fetched successfully.",
      data: registrations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch your registrations due to an error.",
      error: error.message,
    });
  }
};

// Get My Registrations by School
exports.getMyRegistrationsBySchool = async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) {
      return res.status(400).json({ success: false, message: "Please provide a schoolId" });
    }
    const assignedSchoolIds = req.user.assignedSchools.map(s => s.schoolId);
    if (!assignedSchoolIds.includes(schoolId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this school.",
      });
    }
    const registrations = await NewRegistrationModel.find({
      schoolId,
      createdBy: req.user.userId,
    });
    res.status(200).json({
      success: true,
      message: "Your registrations for the school fetched successfully.",
      data: registrations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch your registrations for the school due to an error.",
      error: error.message,
    });
  }
};

// Update My Registration
exports.updateMyRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const updateData = req.body;

    const registration = await NewRegistrationModel.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found." });
    }

    if (registration.createdBy !== req.user.userId || !req.user.assignedSchools.some(s => s.schoolId === registration.schoolId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this registration.",
      });
    }

    delete updateData.schoolId;
    delete updateData.createdBy;
    delete updateData.approvalStatus;

    Object.assign(registration, updateData);
    await registration.save();

    res.status(200).json({
      success: true,
      message: "Registration updated successfully.",
      registration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update registration due to an error.",
      error: error.message,
    });
  }
};

// Update Any Registration
exports.updateAnyRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const updateData = req.body;

    const registration = await NewRegistrationModel.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found." });
    }

    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === registration.schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to update registrations for this school.",
      });
    }

    delete updateData.schoolId;
    delete updateData.createdBy;
    delete updateData.approvalStatus;

    Object.assign(registration, updateData);
    await registration.save();

    res.status(200).json({
      success: true,
      message: "Registration updated successfully.",
      registration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update registration due to an error.",
      error: error.message,
    });
  }
};

// Get Classes for School
exports.getClassesForSchool = async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) {
      return res.status(400).json({ success: false, message: "Please provide a schoolId" });
    }
    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this school.",
      });
    }
    const classes = await classModel.find({ schoolId });
    res.status(200).json({
      success: true,
      message: "Classes fetched successfully.",
      data: classes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch classes due to an error.",
      error: error.message,
    });
  }
};

module.exports = {
  createRegistration: exports.createRegistration,
  editRegistration: exports.editRegistration,
  getAllRegistrationsForReceptionist: exports.getAllRegistrationsForReceptionist,
  getRegistrationsBySchool: exports.getRegistrationsBySchool,
  getRegistrationsByClassSection: exports.getRegistrationsByClassSection,
  getMyRegistrations: exports.getMyRegistrations,
  getMyRegistrationsBySchool: exports.getMyRegistrationsBySchool,
  updateMyRegistration: exports.updateMyRegistration,
  updateAnyRegistration: exports.updateAnyRegistration,
  getClassesForSchool: exports.getClassesForSchool,
};