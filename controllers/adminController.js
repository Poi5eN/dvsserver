const Collection = require("../models/adminModel");
const FeeStructure = require("../models/feeStructureModel");
const Teacher = require("../models/teacherModel");
const cloudinary = require("cloudinary");
const getDataUri = require("../utils/dataUri");
const sendEmail = require("../utils/email");
const s3 = require("../config/minio");

const {
  setTokenCookie,
  hashPassword,
  createToken,
  verifyPassword,
  fetchTokenFromCookie,
} = require("./authController");
const { v4: uuidv4 } = require("uuid");
const xlsx = require("xlsx");
const mongoose = require("mongoose");
const teacherModel = require("../models/teacherModel");
const BookModel = require("../models/bookModel");
const ItemModel = require("../models/inventoryItemModel");
const NewRegistrationModel = require("../models/newRegistrationModel");
const NewStudentModel = require("../models/newStudentModel");
const ParentModel = require("../models/parentModel");
const EmployeeModel = require("../models/employeeModel");
const FeeStatus = require("../models/feeStatus");
// const classModel = require("../models/classModel");
const classModel = require("../models/classModel");
const NoticeModel = require("../models/noticeModel");
const Curriculum = require("../models/curriculumModel");
const Assignment = require("../models/assignmentModel");
const IssueBook = require("../models/issueBookModel");
const AdminInfo = require("../models/adminModel");
const Mark = require("../models/mark");
const Exam = require("../models/exam");
const { generateStructuredNumber } = require("../utils/numberGenerator");

// SCHOOL RELATED CONTROLLER FLOW

// Update Admin Controller
exports.updateAdmin = async (req, res) => {
  try {
    // Verify that AdminInfo is a valid Mongoose model
    if (!AdminInfo || typeof AdminInfo.findOne !== "function") {
      throw new Error("AdminInfo model is not properly initialized");
    }

    console.log("AdminInfo model loaded successfully:", AdminInfo.modelName);

    // Get schoolId from authenticated user (adjust based on your auth middleware)
    const schoolId = req.user.schoolId; // Assuming auth middleware sets req.user.schoolId
    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: "SchoolId not found in request. Authentication required.",
      });
    }

    // Fetch admin by schoolId
    const admin = await AdminInfo.findOne({ schoolId: schoolId }).select(
      "+password"
    );
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found for this schoolId",
      });
    }

    const {
      schoolName,
      email: newEmail, // New email if admin wants to update it
      fullName,
      contact,
      address,
      feeMessage,
      schoolState,
      schoolCity,
      admissionMessage,
      registrationMessage,
      pincode,
      newPassword,
      currentPassword,
    } = req.body;

    // Handle image uploads (logoImage and image)
    const files = req.files || [];

    const logoFile = files.find((f) => f.fieldname === "logoImage"); // If logoImage is uploaded
    const imageFile = files.find((f) => f.fieldname === "image"); // If image is uploaded

    // Validate new email if it's being updated
    if (newEmail && newEmail !== admin.email) {
      const emailExists = await AdminInfo.findOne({ email: newEmail });
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
      admin.email = newEmail;
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Please provide current password to change password",
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, admin.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      admin.password = await hashPassword(newPassword);
    }

    // Update basic fields if provided
    if (schoolName) {
      admin.schoolName = schoolName;
      admin.slug = schoolName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9-]/g, "");
    }
    if (fullName) admin.fullName = fullName;
    if (contact) admin.contact = contact;
    if (address) admin.address = address;

    // Update new fields if provided
    if (feeMessage) admin.feeMessage = feeMessage;
    if (schoolState) admin.schoolState = schoolState;
    if (schoolCity) admin.schoolCity = schoolCity;
    if (admissionMessage) admin.admissionMessage = admissionMessage;
    if (registrationMessage) admin.registrationMessage = registrationMessage;
    if (pincode) admin.pincode = pincode;

    // Handle logoImage upload (if file is provided)
    if (logoFile) {
      if (admin.logoImage.public_id) {
        await s3
          .deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: admin.logoImage.public_id,
          })
          .promise();
      }

      const logoFileKey = `admins/logos/${Date.now()}-${logoFile.originalname}`;
      const logoParams = {
        Bucket: process.env.MINIO_BUCKET,
        Key: logoFileKey,
        Body: logoFile.buffer,
        ContentType: logoFile.mimetype,
        ACL: "public-read",
      };

      const logoMinioData = await s3.upload(logoParams).promise();
      admin.logoImage = {
        public_id: logoFileKey,
        url: logoMinioData.Location,
      };
    }

    // Handle image upload (if file is provided)
    if (imageFile) {
      if (admin.image.public_id) {
        await s3
          .deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: admin.image.public_id,
          })
          .promise();
      }

      const imageFileKey = `admins/images/${Date.now()}-${
        imageFile.originalname
      }`;
      const imageParams = {
        Bucket: process.env.MINIO_BUCKET,
        Key: imageFileKey,
        Body: imageFile.buffer,
        ContentType: imageFile.mimetype,
        ACL: "public-read",
      };

      const imageMinioData = await s3.upload(imageParams).promise();
      admin.image = {
        public_id: imageFileKey,
        url: imageMinioData.Location,
      };
    }

    // Save the updated admin profile
    await admin.save();

    res.status(200).json({
      success: true,
      message: "Admin profile updated successfully",
      admin: {
        schoolId: admin.schoolId,
        schoolName: admin.schoolName,
        slug: admin.slug,
        email: admin.email,
        fullName: admin.fullName,
        contact: admin.contact,
        address: admin.address,
        feeMessage: admin.feeMessage,
        schoolState: admin.schoolState,
        schoolCity: admin.schoolCity,
        logoImage: admin.logoImage,
        image: admin.image,
        admissionMessage: admin.admissionMessage,
        registrationMessage: admin.registrationMessage,
        pincode: admin.pincode,
        role: admin.role,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error("Update Admin Error:", error.stack);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Admin controller
exports.getAdminInfo = async (req, res) => {
  try {
    const admin = await AdminInfo.findOne({ schoolId: req.user.schoolId });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "school Id is not correct",
      });
    }

    res.status(200).json({
      success: true,
      message: "Admin details fetched is successfully",
      admin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Admin Details is not get Successfully Due to error",
      error: error.message,
    });
  }
};





// START OF TEACHER RELATED FLOW
function generateEmployeeId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let employeeId = "";

  for (let i = 0; i < 3; i++) {
    employeeId += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  for (let i = 0; i < 3; i++) {
    employeeId += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return employeeId;
}

// Create a new teacher
exports.createTeacher = async (req, res) => {
  try {
    const { email, password, ...userFields } = req.body;
    const file = req.file;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill the required fields",
      });
    }

    // Check if teacher already exists by email, school, and session
    const userExist = await Teacher.findOne({
      email,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });

    if (userExist) {
      return res.status(400).send({
        success: false,
        message:
          "Teacher already exists with this email for the current session",
      });
    }

    const hashedPassword = await hashPassword(password);

    let fileData = {};
    if (file) {
      const fileUri = getDataUri(file);
      const mycloud = await cloudinary.v2.uploader.upload(fileUri.content);
      fileData = {
        public_id: mycloud.public_id,
        url: mycloud.secure_url,
      };
    }

    // Generate unique teacherId and employeeId
    const teacherId = uuidv4();
    const employeeId = generateEmployeeId();

    const teacherData = await Teacher.create({
      teacherId,
      schoolId: req.user.schoolId,
      session: req.user.session, // attach session from logged-in admin
      email: email,
      password: hashedPassword,
      employeeId,
      image: fileData,
      ...userFields,
    });

    // If teacher created successfully, send email using template
    if (teacherData) {
      // Fetch school details for email branding
      const schoolDetails = await AdminInfo.findOne({
        schoolId: req.user.schoolId,
      }).select("schoolName image.url");
      const schoolName = schoolDetails?.schoolName || "Your School";
      const schoolImageUrl =
        schoolDetails?.image?.url ||
        "https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg";
      const softwareLogoUrl =
        "https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png";

      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Teacher Account Created</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Comic Sans MS', Arial, sans-serif; background-color: #e0f7fa; color: #000000;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
                <img src="${schoolImageUrl}" alt="${schoolName}" style="max-width: 120px; height: auto; border-radius: 50%; border: 3px solid #fff; margin-bottom: 10px;" onerror="this.src='https://i.ibb.co/1Y1qz1g/school.webp';">
                <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">${schoolName}</h1>
                <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Welcome to Our Faculty!</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding: 30px; background-color: #ffffff;">
                <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, Teacher!</h2>
                <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">We’re thrilled to have you join ${schoolName} as a teacher.</p>
                <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                  <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Credentials</h3>
                  <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
                  <p style="margin: 5px 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
                  <p style="margin: 5px 0; font-size: 16px;"><strong>Employee ID:</strong> ${employeeId}</p>
                  <p style="margin: 5px 0; font-size: 16px;"><strong>Teacher ID:</strong> ${teacherId}</p>
                </div>
                <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Log in to start shaping young minds with us!</p>
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

      sendEmail(email, "Teacher Login Credentials", emailContent)
        .then(() => {
          console.log("Teacher created and message sent to teacher email ID");
        })
        .catch((error) => {
          return res.status(500).json({
            success: false,
            message: "Error sending email to teacher email ID",
          });
        });
    } else {
      return res
        .status(500)
        .json({ success: false, message: "Teacher is not created" });
    }

    // Send back the full teacher data in the response
    res.status(201).send({
      success: true,
      message: "Teacher created successfully",
      teacher: teacherData, // Return the entire teacher object
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Deactivate a teacher using teacherId
exports.deactivateTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body; // Now using teacherId instead of email

    const deactivateTeacher = await Teacher.findOneAndUpdate(
      {
        teacherId,
        schoolId: req.user.schoolId,
        session: req.user.session,
      },
      { $set: { status: "deactivated" } },
      { new: true }
    );

    if (deactivateTeacher) {
      return res.json({
        success: true,
        message: "Teacher has been deactivated",
        teacher: deactivateTeacher,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Toggle teacher status
exports.toggleTeacherStatus = async (req, res) => {
  try {
    const { teacherId } = req.body; // Using teacherId to identify the teacher

    // Find the teacher by teacherId, schoolId, and session
    const teacher = await Teacher.findOne({
      teacherId,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });

    // Check if the teacher exists
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // Toggle the status based on the current status
    const newStatus = teacher.status === "active" ? "deactivated" : "active";

    // Update the teacher's status
    const updatedTeacher = await Teacher.findOneAndUpdate(
      { teacherId, schoolId: req.user.schoolId, session: req.user.session },
      { $set: { status: newStatus } },
      { new: true }
    );

    // Send appropriate message based on the new status
    const message =
      newStatus === "active"
        ? "Teacher has been reactivated"
        : "Teacher has been deactivated";

    res.json({
      success: true,
      message,
      teacher: updatedTeacher, // Return the updated teacher data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update a teacher using teacherId
exports.updateTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params; // Get teacherId from the URL parameter
    const updateFields = req.body; // Get update fields from the request body
    const file = req.file; // Handle file upload if any

    // Find the teacher by teacherId, schoolId, and session
    const existingTeacher = await Teacher.findOne({
      teacherId,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });

    if (!existingTeacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    // If a file (image) is provided, upload it to Cloudinary and update the teacher's image
    if (file) {
      const fileUri = getDataUri(file);
      const mycloud = await cloudinary.v2.uploader.upload(fileUri.content);
      existingTeacher.image = {
        public_id: mycloud.public_id,
        url: mycloud.secure_url,
      };
    }

    // Update the fields provided in the request body
    for (const key in updateFields) {
      // Prevent overwriting sensitive fields like password
      if (key !== "password") {
        existingTeacher[key] = updateFields[key];
      }
    }

    // Save the updated teacher data
    const updatedTeacher = await existingTeacher.save();

    // Respond with the updated teacher data
    res.json({
      success: true,
      message: "Teacher updated successfully",
      teacher: updatedTeacher,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all active teachers for the logged-in session
exports.getAllTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({
      schoolId: req.user.schoolId,
      session: req.user.session,
      status: "active",
    });

    res.status(200).json({ success: true, data: teachers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// END OF TEACHER RELATED FLOW

// --------------------------------Fee Controller--------------------------------------\\

// Create a student-specific fee structure
exports.createStudentSpecificFee = async (req, res) => {
  try {
    const { studentId, feeType, amount, name } = req.body; // Removed schoolId, session from body
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID (UUID) is required for student-specific fees.",
      });
    }
    if (!feeType) {
      return res.status(400).json({
        success: false,
        message: "Fee type is required.",
      });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid fee amount is required.",
      });
    }

    const student = await NewStudentModel.findOne({ studentId, schoolId, session });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student with ID ${studentId} not found in this school and session.`,
      });
    }

    const feesExist = await FeeStructure.findOne({
      schoolId,
      session,
      studentId,
      feeType,
      additional: !!name,
      ...(name ? { name } : {}),
    });

    if (feesExist) {
      return res.status(400).json({
        success: false,
        message: `Student-specific fee for ${feeType}${name ? ` (${name})` : ""} already exists for this student.`,
      });
    }

    const feeStructure = new FeeStructure({
      schoolId,
      session,
      className: student.class,
      name: name || undefined,
      feeType,
      amount,
      additional: !!name,
      studentId,
      updatedBy,
    });

    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: "Student-specific fee structure created successfully.",
      data: feeStructure,
    });
  } catch (error) {
    console.error("Error in createStudentSpecificFee:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create student-specific fee structure.",
      error: error.message,
    });
  }
};

// Create a fee structure for a class (Regular Fee)
exports.createFeeStructure = async (req, res) => {
  try {
    const { className, feeType, amount } = req.body; // Removed schoolId, session from body
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!className) {
      return res.status(400).json({
        success: false,
        message: "Class name is required.",
      });
    }
    if (!feeType || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Fee type and valid amount are required.",
      });
    }

    const feesExist = await FeeStructure.findOne({
      schoolId,
      session,
      className,
      feeType,
      additional: false,
    });

    if (feesExist) {
      return res.status(400).json({
        success: false,
        message: "Regular fee already exists for this class and fee type",
      });
    }

    const feeStructure = new FeeStructure({
      schoolId,
      session,
      className,
      feeType,
      amount,
      additional: false,
      updatedBy,
    });

    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: "Fee structure created successfully",
      data: feeStructure,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Create an additional fee structure for a class
exports.createAdditionalFee = async (req, res) => {
  try {
    const { className, name, feeType, amount } = req.body; // Removed schoolId, session from body
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!className || !name || !feeType || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Class name, fee name, fee type, and valid amount are required.",
      });
    }

    const feesExist = await FeeStructure.findOne({
      schoolId,
      session,
      className,
      name,
      feeType,
      additional: true,
    });

    if (feesExist) {
      return res.status(400).json({
        success: false,
        message: "Additional fee already exists for this class, fee type, and name",
      });
    }

    const feeStructure = new FeeStructure({
      schoolId,
      session,
      className,
      name,
      feeType,
      amount,
      additional: true,
      updatedBy,
    });

    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: "Additional fee structure created successfully",
      data: feeStructure,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Get fee structures for all classes in a school (Regular Fees)
exports.getAllFeeStructures = async (req, res) => {
  try {
    const { className } = req.query;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const filter = {
      schoolId,
      session,
      additional: false,
      ...(className ? { className } : {}),
    };

    const feeStructures = await FeeStructure.find(filter).lean();

    res.status(200).json({
      success: true,
      message: "Regular fee structures fetched successfully",
      data: feeStructures,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all fee structures (Regular + Additional) for a school
exports.getAllFees = async (req, res) => {
  try {
    const { className } = req.query;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const filter = {
      schoolId,
      session,
      ...(className ? { className } : {}),
    };

    const regularFees = await FeeStructure.find({ ...filter, additional: false }).lean();
    const additionalFees = await FeeStructure.find({ ...filter, additional: true }).lean();

    const allFees = [...regularFees, ...additionalFees];

    res.status(200).json({
      success: true,
      message: "All fee structures fetched successfully",
      data: allFees,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update a fee structure using feeStructureId
exports.updateFees = async (req, res) => {
  try {
    const { feeStructureId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    const updateData = req.body; // No schoolId or session in body

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!feeStructureId) {
      return res.status(400).json({
        success: false,
        message: "Fee structure ID is required in the URL parameter.",
      });
    }

    const feeStructure = await FeeStructure.findOneAndUpdate(
      { feeStructureId, schoolId, session },
      { $set: { ...updateData, updatedBy, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: "Fee structure not found or does not belong to this school and session.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Fee structure updated successfully",
      data: feeStructure,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Delete a fee structure using feeStructureId
exports.deleteFees = async (req, res) => {
  try {
    const { feeStructureId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!feeStructureId) {
      return res.status(400).json({
        success: false,
        message: "Fee structure ID is required in the URL parameter.",
      });
    }

    const feeStructure = await FeeStructure.findOne({ feeStructureId, schoolId, session });
    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: "Fee structure not found or does not belong to this school and session.",
      });
    }

    await FeeStructure.deleteOne({ feeStructureId, schoolId, session });

    res.status(200).json({
      success: true,
      message: "Fee structure deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all additional fees for a school
exports.getAllAdditionalFee = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const feeStructures = await FeeStructure.find({
      schoolId,
      session,
      additional: true,
    }).lean();

    res.status(200).json({
      success: true,
      message: "Additional fee structures fetched successfully",
      data: feeStructures,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.getFeeStructures = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const {
      feeStructureId,
      className,
      feeType,
      studentId,
      additional, // Boolean: true, false, or undefined (all)
      name,
    } = req.query; // No schoolId or session in query

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const query = {
      schoolId,
      session,
    };

    if (feeStructureId) query.feeStructureId = feeStructureId;
    if (className) query.className = className;
    if (feeType) query.feeType = feeType;
    if (studentId) query.studentId = studentId;
    if (additional !== undefined) query.additional = additional === 'true';
    if (name) query.name = name;

    const feeStructures = await FeeStructure.find(query).lean();

    if (feeStructures.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No fee structures found matching the criteria.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Fee structures fetched successfully",
      data: feeStructures,
    });
  } catch (error) {
    console.error("Error in getFeeStructures:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch fee structures",
      error: error.message,
    });
  }
};


// Create a late fine fee structure
exports.createLateFineFee = async (req, res) => {
  try {
    const { className, amount, lateFineDueDay } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!className) {
      return res.status(400).json({
        success: false,
        message: "Class name is required.",
      });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid late fine amount is required.",
      });
    }
    if (!lateFineDueDay || lateFineDueDay < 1 || lateFineDueDay > 31) {
      return res.status(400).json({
        success: false,
        message: "Late fine due day must be between 1 and 31.",
      });
    }

    const existingLateFine = await FeeStructure.findOne({
      schoolId,
      session,
      className,
      feeType: "LateFine",
      additional: true,
    });

    if (existingLateFine) {
      return res.status(400).json({
        success: false,
        message: "Late fine fee already exists for this class.",
      });
    }

    const feeStructure = new FeeStructure({
      schoolId,
      session,
      className,
      name: "Late Fine",
      feeType: "LateFine",
      amount,
      additional: true,
      lateFineDueDay,
      updatedBy,
    });

    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: "Late fine fee structure created successfully",
      data: feeStructure,
    });
  } catch (error) {
    console.error("Error in createLateFineFee:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create late fine fee structure",
      error: error.message,
    });
  }
};

// --------------------------------Book Controller

// Create a Book Details for a class

exports.createBookDetails = async (req, res) => {
  try {
    const { bookName, authorName, quantity, category, className, subject } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const existBook = await BookModel.findOne({ schoolId, session, bookName });
    if (existBook) {
      return res.status(400).json({
        success: false,
        message: "This book already exists in this school and session.",
      });
    }

    const bookDetails = new BookModel({
      schoolId,
      session,
      bookName,
      authorName,
      quantity,
      category,
      className,
      subject,
      updatedBy,
    });
    await bookDetails.save();

    res.status(201).json({
      success: true,
      message: "Book details created successfully",
      bookDetails,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get List of all books
exports.getAllBooks = async (req, res) => {
  try {
    const { _id } = req.query;
    console.log("REq.Body", req.query);

    const filter = {
      ...(_id ? { _id: _id } : {}),
      ...req.sessionFilter,
    };

    const listOfAllBooks = await BookModel.find({
      ...filter,
      schoolId: req.user.schoolId,
    });

    res.status(200).json({
      success: true,
      message: "All Book fetch successfully",
      listOfAllBooks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Book not fetched due to error",
      error: error.message,
    });
  }
};

exports.getBooks = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const { bookId, bookName, authorName, category, className, subject } = req.query;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const query = { schoolId, session };

    if (bookId) query.bookId = bookId;
    if (bookName) query.bookName = { $regex: bookName, $options: "i" }; // Case-insensitive
    if (authorName) query.authorName = { $regex: authorName, $options: "i" };
    if (category) query.category = category;
    if (className) query.className = className;
    if (subject) query.subject = subject;

    const books = await BookModel.find(query).lean();

    if (books.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No books found matching the criteria.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Books fetched successfully",
      books,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch books",
      error: error.message,
    });
  }
};

// Delete Book
exports.deleteBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: "Book ID is required in the URL parameter.",
      });
    }

    const book = await BookModel.findOne({ bookId, schoolId, session });
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found or does not belong to this school and session.",
      });
    }

    await BookModel.deleteOne({ bookId, schoolId, session });

    res.status(200).json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Book not deleted due to error",
      error: error.message,
    });
  }
};

// update Book
exports.updateBook = async (req, res) => {
  try {
    const { bookId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    const updateData = req.body;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: "Book ID is required in the URL parameter.",
      });
    }

    const book = await BookModel.findOneAndUpdate(
      { bookId, schoolId, session },
      { $set: { ...updateData, updatedBy, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found or does not belong to this school and session.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Book details updated successfully",
      book,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Book details not updated due to error",
      error: error.message,
    });
  }
};

// --------------------------------Inventory Item Controller

// Create a Item Details for a class
exports.createItemDetails = async (req, res) => {
  try {
    const { itemName, category, quantity, price } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!itemName || !category || !quantity || !price) {
      return res.status(400).json({
        success: false,
        message: "Item name, category, quantity, and price are required.",
      });
    }

    const itemExist = await ItemModel.findOne({ schoolId, session, itemName, category });
    if (itemExist) {
      return res.status(400).json({
        success: false,
        message: "Item already exists in this school and session.",
      });
    }

    const data = new ItemModel({
      schoolId,
      session,
      itemName,
      category,
      quantity,
      price,
      updatedBy,
    });

    await data.save();

    res.status(201).json({
      success: true,
      message: "Item details created successfully",
      data,
    });
  } catch (error) {
    console.error("Error in createItemDetails:", error);
    res.status(500).json({
      success: false,
      message: "Item not created due to error",
      error: error.message,
    });
  }
};

exports.getItems = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const { itemId, itemName, category, minQuantity, maxPrice } = req.query;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const query = { schoolId, session };

    if (itemId) query.itemId = itemId;
    if (itemName) query.itemName = { $regex: itemName, $options: "i" }; // Case-insensitive search
    if (category) query.category = category;
    if (minQuantity) query.quantity = { $gte: parseInt(minQuantity) };
    if (maxPrice) query.price = { $lte: parseFloat(maxPrice) };

    const items = await ItemModel.find(query).lean();

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No items found matching the criteria.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Items fetched successfully",
      items,
    });
  } catch (error) {
    console.error("Error in getItems:", error);
    res.status(500).json({
      success: false,
      message: "Items not fetched due to error",
      error: error.message,
    });
  }
};

// Get List of all books
exports.getAllItems = async (req, res) => {
  try {
    const { _id } = req.query;
    const filter = {
      ...(_id ? { _id: _id } : {}),
      ...req.sessionFilter,
    };

    const listOfAllItems = await ItemModel.find({
      ...filter,
      schoolId: req.user.schoolId,
    });

    res.status(200).json({
      success: true,
      message: "All Items fetch successfully",
      listOfAllItems,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Item not fetched due to error",
      error: error.message,
    });
  }
};

exports.sellItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantitySold } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required in the URL parameter.",
      });
    }
    if (!quantitySold || quantitySold <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid quantity sold is required.",
      });
    }

    const item = await ItemModel.findOne({ itemId, schoolId, session });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found or does not belong to this school and session.",
      });
    }

    if (item.quantity < quantitySold) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock to sell.",
      });
    }

    item.quantity -= quantitySold;
    item.sellQuantity += quantitySold;
    item.sellAmount += quantitySold * item.price;
    item.updatedBy = updatedBy;
    item.updatedAt = new Date();

    await item.save();

    res.status(200).json({
      success: true,
      message: "Item sold successfully",
      item,
    });
  } catch (error) {
    console.error("Error in sellItem:", error);
    res.status(500).json({
      success: false,
      message: "Item not sold due to error",
      error: error.message,
    });
  }
};

// Delete Item
exports.deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required in the URL parameter.",
      });
    }

    const item = await ItemModel.findOne({ itemId, schoolId, session });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found or does not belong to this school and session.",
      });
    }

    await ItemModel.deleteOne({ itemId, schoolId, session });

    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteItem:", error);
    res.status(500).json({
      success: false,
      message: "Item not deleted due to error",
      error: error.message,
    });
  }
};

// update Item

exports.updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    const updateData = req.body;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required in the URL parameter.",
      });
    }

    const item = await ItemModel.findOneAndUpdate(
      { itemId, schoolId, session },
      { $set: { ...updateData, updatedBy, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found or does not belong to this school and session.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Item details updated successfully",
      item,
    });
  } catch (error) {
    console.error("Error in updateItem:", error);
    res.status(500).json({
      success: false,
      message: "Item details not updated due to error",
      error: error.message,
    });
  }
};

//creating Subjects

exports.createSubject = async (req, res) => {
  try {
    const { subject, className, classTeacher } = req.body;

    const existingClass = await Subject.findOne({ className });

    if (existingClass) {
      return res.status(400).json({ message: "Class already exists" });
    }

    const newSubject = await Subject.create({
      schoolID: req.user.schoolId,
      subject,
      className,
      classTeacher,
    });

    res
      .status(201)
      .json({ message: "Subject created successfully", subject: newSubject });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ schoolId: req.user.schoolId });
    res.json({ success: true, subjects: subjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const subjectId = req.params.subjectId;
    const { className, classTeacher, subject } = req.body;

    const existingClass = await Subject.findOne({
      schoolId: req.user.schoolId,
      className,
      subjectId,
    });

    if (!existingClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    if (classTeacher) {
      existingClass.classTeacher = classTeacher;
    }

    if (subject) {
      existingClass.subject = subject;
    }

    const updatedSubject = await existingClass.save();

    res.json({
      message: "Subject updated successfully",
      subject: updatedSubject,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//for admissionUser and adminUser both

// START OF THE REGISTRATION

// Function to generate unique registration number
// Function to generate unique registration number
// Fallback implementation if generateStructuredNumber is undefined
// const generateStructuredNumber = async (schoolId, Model, fieldName) => {
//   const generate = () => {
//     const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
//     return `${schoolId}-${fieldName.slice(0, 3).toUpperCase()}${randomNum}`; // e.g., SCH-ADM1234
//   };

//   let number;
//   let unique = false;
//   while (!unique) {
//     number = generate();
//     const exists = await Model.findOne({ [fieldName]: number });
//     if (!exists) unique = true;
//   }
//   return number;
// };

const generateRegistrationNumber = async (schoolId) => {
  return generateStructuredNumber(
    schoolId,
    NewRegistrationModel,
    "registrationNumber"
  );
};

const generateAdmission = async (schoolId) => {
  return generateStructuredNumber(
    schoolId,
    NewRegistrationModel,
    "admissionNo"
  );
};



function generateRandomPassword(length = 8) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

exports.createRegistration = async (req, res) => {
  try {
    const {
      studentFullName,
      guardianName,
      registerClass,
      studentAddress,
      mobileNumber,
      studentEmail,
      gender,
      amount,
      admissionNo,
      fatherName,
      parentEmail,
      motherName,
      remarks,
      transport,
    } = req.body;

    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const createdBy = req.user._id;

    // Validation
    if (!schoolId || !session) {
      return res.status(400).json({ success: false, message: "School ID and session are required." });
    }
    if (!studentFullName) {
      return res.status(400).json({ success: false, message: "Student full name is required." });
    }
    if (!mobileNumber) {
      return res.status(400).json({ success: false, message: "Mobile number is required." });
    }

    const files = req.files || [];
    const studentPhoto = files.find((f) => f.fieldname === "studentPhoto");
    const fatherPhoto = files.find((f) => f.fieldname === "fatherPhoto");
    const motherPhoto = files.find((f) => f.fieldname === "motherPhoto");
    const guardianPhoto = files.find((f) => f.fieldname === "guardianPhoto");

    // Check for existing registration
    if (studentEmail) {
      const registrationExist = await NewRegistrationModel.findOne({
        studentEmail,
        schoolId,
        session,
      });
      if (registrationExist) {
        return res.status(400).json({
          success: false,
          message: "Already registered with this email in this school and session!",
        });
      }
    }

    // Generate admissionNo and registrationNumber
    const finalAdmissionNo = admissionNo && admissionNo.trim() !== ""
      ? admissionNo
      : await generateAdmission(schoolId); // Assumes this function exists
    const registrationNumber = await generateRegistrationNumber(schoolId); // Assumes this function exists

    // Handle file uploads
    let studentPhotoResult = {}, fatherPhotoResult = {}, motherPhotoResult = {}, guardianPhotoResult = {};
    if (studentPhoto) {
      const fileKey = `registrations/student/${Date.now()}-${studentPhoto.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: studentPhoto.buffer,
        ContentType: studentPhoto.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      studentPhotoResult = { public_id: fileKey, url: minioData.Location };
    }
    if (fatherPhoto) {
      const fileKey = `registrations/father/${Date.now()}-${fatherPhoto.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: fatherPhoto.buffer,
        ContentType: fatherPhoto.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      fatherPhotoResult = { public_id: fileKey, url: minioData.Location };
    }
    if (motherPhoto) {
      const fileKey = `registrations/mother/${Date.now()}-${motherPhoto.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: motherPhoto.buffer,
        ContentType: motherPhoto.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      motherPhotoResult = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianPhoto) {
      const fileKey = `registrations/guardian/${Date.now()}-${guardianPhoto.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: guardianPhoto.buffer,
        ContentType: guardianPhoto.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      guardianPhotoResult = { public_id: fileKey, url: minioData.Location };
    }

    // Create registration
    const registrationData = await NewRegistrationModel.create({
      schoolId,
      session,
      studentFullName,
      guardianName,
      registerClass,
      studentAddress,
      mobileNumber,
      studentEmail,
      gender,
      amount,
      admissionNo: finalAdmissionNo,
      fatherName,
      parentEmail,
      motherName,
      remarks,
      transport,
      registrationNumber,
      createdBy,
      approvalStatus: "pending", // Default to pending
      studentPhoto: studentPhotoResult.url ? studentPhotoResult : undefined,
      fatherPhoto: fatherPhotoResult.url ? fatherPhotoResult : undefined,
      motherPhoto: motherPhotoResult.url ? motherPhotoResult : undefined,
      guardianPhoto: guardianPhotoResult.url ? guardianPhotoResult : undefined,
    });

    // Send confirmation email (reusing your design)
    const schoolDetails = await AdminInfo.findOne({ schoolId }).select("schoolName image.url");
    const schoolName = schoolDetails?.schoolName || "Your School";
    const schoolImageUrl = schoolDetails?.image?.url || "https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg";
    const softwareLogoUrl = "https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png";

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
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
              <img src="${schoolImageUrl}" alt="${schoolName}" style="max-width: 120px; height: auto; border-radius: 50%; border: 3px solid #fff; margin-bottom: 10px;" onerror="this.src='https://i.ibb.co/1Y1qz1g/school.webp';">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">${schoolName}</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Welcome to Your Learning Journey!</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, ${studentFullName}!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">We’re thrilled you’ve chosen ${schoolName}! Your registration is ready to kick off an amazing adventure.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Registration Details</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Student Name:</strong> ${studentFullName}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Registration ID:</strong> ${registrationData.registrationId}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Class:</strong> ${registerClass || 'N/A'}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Registration Number:</strong> ${registrationNumber}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Status:</strong> <span style="color: #ff5600; font-weight: bold;">Pending Approval</span></p>
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Hang tight! We’re reviewing your details and will get back to you soon with the next steps.</p>
            </td>
          </tr>
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
    if (studentEmail) {
      await sendEmail(studentEmail, "Registration Confirmation", emailContent);
    }

    return res.status(201).json({
      success: true,
      message: "Registration created successfully and confirmation email sent.",
      registration: registrationData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create registration",
      error: error.message,
    });
  }
};

exports.createBulkRegistrations = async (req, res) => {
  try {
    const registrations = req.body.registrations;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const createdBy = req.user._id;

    if (!registrations || !Array.isArray(registrations)) {
      return res.status(400).json({
        success: false,
        message: "Invalid data format. Expected an array of registrations.",
      });
    }
    if (!schoolId || !session) {
      return res.status(400).json({ success: false, message: "School ID and session are required." });
    }
    if (!createdBy) {
      return res.status(400).json({ success: false, message: "User ID is required." });
    }

    const createdRegistrations = [];
    const errors = [];

    for (const registration of registrations) {
      const {
        studentFullName,
        guardianName,
        registerClass,
        studentAddress,
        mobileNumber,
        studentEmail,
        gender,
        amount,
        admissionNo,
        fatherName,
        parentEmail,
        motherName,
        remarks,
        transport,
      } = registration;

      try {
        if (!studentFullName) throw new Error("Student full name is required.");
        if (!mobileNumber) throw new Error("Mobile number is required.");

        if (studentEmail) {
          const registrationExist = await NewRegistrationModel.findOne({
            studentEmail,
            schoolId,
            session,
          });
          if (registrationExist) {
            throw new Error(`Already registered with email: ${studentEmail} in this school and session`);
          }
        }

        const finalAdmissionNo = admissionNo && admissionNo.trim() !== ""
          ? admissionNo
          : await generateAdmission(schoolId);
        const registrationNumber = await generateRegistrationNumber(schoolId);

        const registrationData = {
          schoolId,
          session,
          studentFullName,
          guardianName,
          registerClass,
          studentAddress,
          mobileNumber,
          studentEmail,
          gender,
          amount,
          admissionNo: finalAdmissionNo,
          fatherName,
          parentEmail,
          motherName,
          remarks,
          transport,
          registrationNumber,
          createdBy,
          approvalStatus: "pending",
        };

        createdRegistrations.push(registrationData);
      } catch (error) {
        errors.push({
          studentEmail: studentEmail || mobileNumber || "unknown",
          error: error.message,
        });
      }
    }

    if (createdRegistrations.length > 0) {
      const insertedRegistrations = await NewRegistrationModel.insertMany(createdRegistrations);
      // Optionally send emails here for each registration
      res.status(201).json({
        success: true,
        message: "Bulk registrations processed successfully.",
        createdRegistrations: insertedRegistrations,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "No valid registrations to process.",
        errors,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process bulk registrations",
      error: error.message,
    });
  }
};

// Controller for fetching all registrations (GET)
exports.getRegistrations = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({ success: false, message: "School ID and session are required." });
    }

    const {
      registrationId,
      registrationNumber,
      studentEmail,
      parentEmail,
      mobileNumber,
      class: registerClass,
      gender,
      status, // approvalStatus
      fetchAll,
      limit = 10,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    let query = { schoolId, session };

    if (registrationId) query.registrationId = registrationId;
    if (registrationNumber) query.registrationNumber = registrationNumber;
    if (studentEmail) query.studentEmail = studentEmail;
    if (parentEmail) query.parentEmail = parentEmail;
    if (mobileNumber) query.mobileNumber = Number(mobileNumber);
    if (registerClass) query.registerClass = registerClass;
    if (gender) query.gender = gender;
    if (status) query.approvalStatus = status;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    if (registrationId) {
      const registration = await NewRegistrationModel.findOne(query).lean();
      if (!registration) {
        return res.status(404).json({ success: false, message: "Registration not found." });
      }
      return res.status(200).json({
        success: true,
        data: registration,
      });
    }

    const registrations = await NewRegistrationModel.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await NewRegistrationModel.countDocuments(query);

    res.status(200).json({
      success: true,
      data: registrations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch registrations",
      error: error.message,
    });
  }
};


exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { status } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({ success: false, message: "School ID and session are required." });
    }
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value. Use 'pending', 'approved', or 'rejected'." });
    }

    const registration = await NewRegistrationModel.findOneAndUpdate(
      { registrationId, schoolId, session },
      { approvalStatus: status },
      { new: true }
    );

    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found." });
    }

    res.status(200).json({
      success: true,
      message: "Registration status updated successfully.",
      data: registration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update registration status",
      error: error.message,
    });
  }
};


exports.admitRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const createdBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({ success: false, message: "School ID and session are required." });
    }

    const registration = await NewRegistrationModel.findOne({ registrationId, schoolId, session });
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found." });
    }
    if (registration.approvalStatus !== 'approved') {
      return res.status(400).json({ success: false, message: "Registration must be approved to admit." });
    }

    // Check if student already exists
    if (registration.studentEmail) {
      const studentExist = await NewStudentModel.findOne({
        email: registration.studentEmail,
        schoolId,
        session,
      });
      if (studentExist) {
        return res.status(400).json({
          success: false,
          message: "Student with this email already exists in this school and session.",
        });
      }
    }

    // Generate passwords
    const studentPassword = generateRandomPassword(); // Assumes this function exists
    const parentPassword = generateRandomPassword();
    const studentHashPassword = await hashPassword(studentPassword); // Assumes this function exists
    const parentHashPassword = await hashPassword(parentPassword);

    // Generate a unique admission number
    const studentAdmissionNumber = await generateAdmissionNumber(schoolId, NewStudentModel);
    const parentAdmissionNumber = await generateAdmissionNumber(schoolId, ParentModel);

    // Create student
    const studentData = await NewStudentModel.create({
      schoolId,
      session,
      studentName: registration.studentFullName,
      email: registration.studentEmail,
      password: studentHashPassword,
      gender: registration.gender,
      address: registration.studentAddress,
      contact: registration.mobileNumber,
      class: registration.registerClass,
      fatherName: registration.fatherName,
      motherName: registration.motherName,
      guardianName: registration.guardianName,
      remarks: registration.remarks,
      transport: registration.transport,
      admissionNumber: studentAdmissionNumber,
      studentImage: registration.studentPhoto,
      fatherImage: registration.fatherPhoto,
      motherImage: registration.motherPhoto,
      guardianImage: registration.guardianPhoto,
      approvalStatus: "approved",
      createdBy,
      joiningDate: new Date().toISOString().split('T')[0], // Current date
      rollNo: registration.rollNo || ((await NewStudentModel.countDocuments({ schoolId, class: registration.registerClass })) + 1).toString(),
      // Default or null fields
      dateOfBirth: null,
      section: null,
      country: null,
      subject: [],
      religion: null,
      caste: null,
      nationality: null,
      pincode: null,
      state: null,
      city: null,
    });

    // Create parent
    const parentData = await ParentModel.create({
      schoolId,
      session,
      studentIds: [studentData.studentId], // Using studentId (UUID) instead of _id
      studentNames: [registration.studentFullName],
      fatherName: registration.fatherName,
      motherName: registration.motherName,
      guardianName: registration.guardianName,
      email: registration.parentEmail,
      password: parentHashPassword,
      contact: registration.mobileNumber ? registration.mobileNumber.toString() : null,
      admissionNumber: parentAdmissionNumber,
      createdBy,
      parentImage: registration.fatherPhoto || registration.motherPhoto || registration.guardianPhoto,
      fatherImage: registration.fatherPhoto,
      motherImage: registration.motherPhoto,
      guardianImage: registration.guardianPhoto,
      // Default or null fields
      income: null,
      qualification: null,
    });

    // Link parent to student
    studentData.parentId = parentData.parentId;
    studentData.parentAdmissionNumber = parentData.admissionNumber;
    await studentData.save();

    // Send emails (simplified; reuse your email logic)
    if (registration.studentEmail) {
      await sendEmail(
        registration.studentEmail,
        "Admission Confirmation",
        `Your admission is confirmed. Student ID: ${studentData.studentId}, Password: ${studentPassword}`
      );
    }
    if (registration.parentEmail) {
      await sendEmail(
        registration.parentEmail,
        "Parent Account Created",
        `Your parent account is created. Parent ID: ${parentData.parentId}, Password: ${parentPassword}`
      );
    }

    res.status(201).json({
      success: true,
      message: "Student and parent created successfully from registration.",
      student: studentData,
      parent: parentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to admit registration",
      error: error.message,
    });
  }
};

// Controller for fetching a specific registration by ID (GET)
exports.getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await NewRegistrationModel.findOne({
      _id: id,
      schoolId: req.user.schoolId,
    });

    if (!registration) {
      return res
        .status(404)
        .json({ success: false, message: "Registration not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Registration fetched successfully.",
      data: registration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch registration due to an error.",
      error: error.message,
    });
  }
};

// Controller for fetching a specific registration by registration number (GET)
exports.getRegistrationByNumber = async (req, res) => {
  try {
    const { registrationNumber } = req.params;
    const registration = await NewRegistrationModel.findOne({
      registrationNumber,
      schoolId: req.user.schoolId,
      ...req.sessionFilter,
    });

    if (!registration) {
      return res
        .status(404)
        .json({ success: false, message: "Registration not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Registration fetched successfully.",
      data: registration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch registration due to an error.",
      error: error.message,
    });
  }
};

// EDIT REGISTRATION CODE
exports.editRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const updateData = req.body;
    const files = req.files || [];
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({ success: false, message: "School ID and session are required." });
    }

    const registration = await NewRegistrationModel.findOne({
      registrationId,
      schoolId,
      session,
    });
    if (!registration) {
      return res.status(404).json({ success: false, message: "Registration not found." });
    }

    // Handle file uploads
    const studentPhoto = files.find((f) => f.fieldname === "studentPhoto");
    const fatherPhoto = files.find((f) => f.fieldname === "fatherPhoto");
    const motherPhoto = files.find((f) => f.fieldname === "motherPhoto");
    const guardianPhoto = files.find((f) => f.fieldname === "guardianPhoto");

    if (studentPhoto) {
      const fileKey = `registrations/student/${Date.now()}-${studentPhoto.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: studentPhoto.buffer,
        ContentType: studentPhoto.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      updateData.studentPhoto = { public_id: fileKey, url: minioData.Location };
    }
    if (fatherPhoto) {
      const fileKey = `registrations/father/${Date.now()}-${fatherPhoto.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: fatherPhoto.buffer,
        ContentType: fatherPhoto.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      updateData.fatherPhoto = { public_id: fileKey, url: minioData.Location };
    }
    if (motherPhoto) {
      const fileKey = `registrations/mother/${Date.now()}-${motherPhoto.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: motherPhoto.buffer,
        ContentType: motherPhoto.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      updateData.motherPhoto = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianPhoto) {
      const fileKey = `registrations/guardian/${Date.now()}-${guardianPhoto.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: guardianPhoto.buffer,
        ContentType: guardianPhoto.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      updateData.guardianPhoto = { public_id: fileKey, url: minioData.Location };
    }

    const updatedRegistration = await NewRegistrationModel.findOneAndUpdate(
      { registrationId, schoolId, session },
      { ...updateData, updatedBy: req.user._id },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Registration updated successfully.",
      data: updatedRegistration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update registration",
      error: error.message,
    });
  }
};

// DELETE REGISTRATION CODE
exports.deleteRegistration = async (req, res) => {
  try {
    const { registrationNumber } = req.params;
    const registration = await NewRegistrationModel.findOneAndDelete({
      registrationNumber,
      schoolId: req.user.schoolId,
    });

    if (!registration) {
      return res
        .status(404)
        .json({ success: false, message: "Registration not found." });
    }

    res.status(200).json({
      success: true,
      message: "Registration deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete registration due to an error.",
      error: error.message,
    });
  }
};

// END OF THE REGISTRATION

// START OF ADMISSION

// Generate Admission Number
const generateAdmissionNumber = async (schoolId, Model) => {
  return generateStructuredNumber(schoolId, Model, "admissionNumber");
};

exports.createStudentParent = async (req, res) => {
  try {
    const {
      studentFullName,
      studentEmail,
      studentPassword,
      studentDateOfBirth,
      studentGender,
      studentJoiningDate,
      studentAddress,
      studentContact,
      studentClass,
      studentSection,
      studentCountry,
      studentSubject,
      fatherName,
      motherName,
      guardianName,
      remarks,
      transport,
      parentEmail,
      parentPassword,
      parentContact,
      parentIncome,
      parentQualification,
      religion,
      caste,
      nationality,
      pincode,
      state,
      city,
      admissionNumber,
      parentAdmissionNumber,
      // UDISE+ fields
      stu_id,
      class: studentUdiseClass,
      section: studentUdiseSection,
      roll_no,
      student_name,
      gender: studentUdiseGender,
      DOB,
      mother_name,
      father_name,
      guardian_name,
      aadhar_no,
      aadhar_name,
      paddress,
      pincode: udisePlusPincode,
      mobile_no,
      alt_mobile_no,
      email_id,
      mothere_tougue,
      category,
      minority,
      is_bpl,
      is_aay,
      ews_aged_group,
      is_cwsn,
      cwsn_imp_type,
      ind_national,
      mainstramed_child,
      adm_no,
      adm_date,
      stu_stream,
      pre_year_schl_status,
      pre_year_class,
      stu_ward,
      pre_class_exam_app,
      result_pre_exam,
      perc_pre_class,
      att_pre_class,
      fac_free_uniform,
      fac_free_textbook,
      received_central_scholarship,
      name_central_scholarship,
      received_state_scholarship,
      received_other_scholarship,
      scholarship_amount,
      fac_provided_cwsn,
      SLD_type,
      aut_spec_disorder,
      ADHD,
      inv_ext_curr_activity,
      vocational_course,
      trade_sector_id,
      job_role_id,
      pre_app_exam_vocationalsubject,
      bpl_card_no,
      ann_card_no,
    } = req.body;

    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const createdBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: "User ID is required from authenticated admin.",
      });
    }

    if (!studentFullName) {
      return res.status(400).json({ success: false, message: "Student full name is required." });
    }
    if (!studentEmail) {
      return res.status(400).json({ success: false, message: "Student email is required." });
    }
    if (!studentPassword) {
      return res.status(400).json({ success: false, message: "Student password is required." });
    }
    if (!fatherName) {
      return res.status(400).json({ success: false, message: "Father's name is required." });
    }
    if (!studentJoiningDate) {
      return res.status(400).json({ success: false, message: "Student joining date is required." });
    }
    if (!studentClass) {
      return res.status(400).json({ success: false, message: "Student class is required." });
    }
    if (!parentEmail && !parentAdmissionNumber) {
      return res.status(400).json({
        success: false,
        message: "Parent email or admission number is required.",
      });
    }
    if (!parentPassword && !parentAdmissionNumber) {
      return res.status(400).json({
        success: false,
        message: "Parent password is required when creating a new parent.",
      });
    }

    const files = req.files || [];
    const studentFile = files.find((f) => f.fieldname === "studentImage");
    const fatherFile = files.find((f) => f.fieldname === "fatherImage");
    const motherFile = files.find((f) => f.fieldname === "motherImage");
    const guardianFile = files.find((f) => f.fieldname === "guardianImage");

    const studentExist = await NewStudentModel.findOne({
      email: studentEmail,
      schoolId,
      session,
    });
    if (studentExist) {
      return res.status(400).json({
        success: false,
        message: `Student with email ${studentEmail} already exists in this school and session.`,
      });
    }

    const parentExist = parentAdmissionNumber
      ? await ParentModel.findOne({ admissionNumber: parentAdmissionNumber, schoolId, session })
      : parentEmail
      ? await ParentModel.findOne({ email: parentEmail, schoolId, session })
      : null;

    if (parentAdmissionNumber && !parentExist) {
      return res.status(400).json({
        success: false,
        message: `Parent with admission number ${parentAdmissionNumber} does not exist in this school and session.`,
      });
    }
    if (!parentAdmissionNumber && parentEmail && parentExist) {
      return res.status(400).json({
        success: false,
        message: `Parent with email ${parentEmail} already exists in this school and session.`,
      });
    }

    const studentHashPassword = await hashPassword(studentPassword);
    const parentHashPassword = parentPassword ? await hashPassword(parentPassword) : undefined;

    let studentImageResult = {},
      fatherImageResult = {},
      motherImageResult = {},
      guardianImageResult = {};
    if (studentFile) {
      const fileKey = `students/${Date.now()}-${studentFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: studentFile.buffer,
        ContentType: studentFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      studentImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (fatherFile) {
      const fileKey = `students/father/${Date.now()}-${fatherFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: fatherFile.buffer,
        ContentType: fatherFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      fatherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (motherFile) {
      const fileKey = `students/mother/${Date.now()}-${motherFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: motherFile.buffer,
        ContentType: motherFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      motherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianFile) {
      const fileKey = `students/guardian/${Date.now()}-${guardianFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: guardianFile.buffer,
        ContentType: guardianFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      guardianImageResult = { public_id: fileKey, url: minioData.Location };
    }

    const studentAdmissionNumberToUse =
      admissionNumber && admissionNumber.trim() !== ""
        ? admissionNumber
        : await generateAdmissionNumber(schoolId, NewStudentModel);

    const studentData = await NewStudentModel.create({
      schoolId,
      session,
      studentName: studentFullName,
      email: studentEmail,
      password: studentHashPassword,
      dateOfBirth: studentDateOfBirth,
      rollNo: (
        (await NewStudentModel.countDocuments({ schoolId, class: studentClass, section: studentSection })) + 1
      ).toString(),
      gender: studentGender,
      joiningDate: studentJoiningDate,
      address: studentAddress,
      contact: studentContact,
      class: studentClass,
      fatherName,
      motherName,
      guardianName,
      remarks,
      transport,
      section: studentSection,
      country: studentCountry,
      subject: studentSubject,
      admissionNumber: studentAdmissionNumberToUse,
      religion,
      caste,
      nationality,
      pincode,
      state,
      city,
      createdBy,
      studentImage: studentImageResult.url ? studentImageResult : undefined,
      fatherImage: fatherImageResult.url ? fatherImageResult : undefined,
      motherImage: motherImageResult.url ? motherImageResult : undefined,
      guardianImage: guardianImageResult.url ? guardianImageResult : undefined,
      approvalStatus: "approved",
      assignedThirdParty: null,
      udisePlusDetails: {
        stu_id,
        class: studentUdiseClass,
        section: studentUdiseSection,
        roll_no,
        student_name,
        gender: studentUdiseGender,
        DOB,
        mother_name,
        father_name,
        guardian_name,
        aadhar_no,
        aadhar_name,
        paddress,
        pincode: udisePlusPincode,
        mobile_no,
        alt_mobile_no,
        email_id,
        mothere_tougue,
        category,
        minority,
        is_bpl,
        is_aay,
        ews_aged_group,
        is_cwsn,
        cwsn_imp_type,
        ind_national,
        mainstramed_child,
        adm_no,
        adm_date,
        stu_stream,
        pre_year_schl_status,
        pre_year_class,
        stu_ward,
        pre_class_exam_app,
        result_pre_exam,
        perc_pre_class,
        att_pre_class,
        fac_free_uniform,
        fac_free_textbook,
        received_central_scholarship,
        name_central_scholarship,
        received_state_scholarship,
        received_other_scholarship,
        scholarship_amount,
        fac_provided_cwsn,
        SLD_type,
        aut_spec_disorder,
        ADHD,
        inv_ext_curr_activity,
        vocational_course,
        trade_sector_id,
        job_role_id,
        pre_app_exam_vocationalsubject,
        bpl_card_no,
        ann_card_no,
      },
    });

    let parentData = null;
    if (parentAdmissionNumber) {
      parentData = await ParentModel.findOneAndUpdate(
        { admissionNumber: parentAdmissionNumber, schoolId, session },
        {
          $push: { studentIds: studentData.studentId },
          studentNames: studentFullName,
        },
        { new: true }
      );
    } else if (parentEmail && parentPassword) {
      const parentImageResult =
        files.find((f) => f.fieldname === "parentImage") || fatherFile || motherFile || guardianFile;
      let parentImageData = {};
      if (parentImageResult) {
        const fileKey = `parents/${Date.now()}-${parentImageResult.originalname}`;
        const params = {
          Bucket: process.env.MINIO_BUCKET,
          Key: fileKey,
          Body: parentImageResult.buffer,
          ContentType: parentImageResult.mimetype,
          ACL: "public-read",
        };
        const minioData = await s3.upload(params).promise();
        parentImageData = { public_id: fileKey, url: minioData.Location };
      }
      parentData = await ParentModel.create({
        schoolId,
        session,
        studentIds: [studentData.studentId], // Using studentId instead of _id
        studentNames: [studentFullName],
        fatherName: fatherName,
        motherName,
        guardianName,
        email: parentEmail,
        password: parentHashPassword,
        contact: parentContact,
        admissionNumber: await generateAdmissionNumber(schoolId, ParentModel),
        income: parentIncome,
        qualification: parentQualification,
        createdBy,
        parentImage: parentImageData.url ? parentImageData : undefined,
        fatherImage: fatherImageResult.url ? fatherImageResult : undefined,
        motherImage: motherImageResult.url ? motherImageResult : undefined,
        guardianImage: guardianImageResult.url ? guardianImageResult : undefined,
      });

      const parentEmailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Parent Account Created</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Comic Sans MS', Arial, sans-serif; background-color: #e0f7fa; color: #000000;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <tr>
              <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
                <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">Welcome, Parent!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px; background-color: #ffffff;">
                <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Your Credentials</h2>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> ${parentEmail}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Password:</strong> ${parentPassword}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Parent ID:</strong> ${parentData.parentId}</p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
      await sendEmail(parentEmail, "Parent Login Credentials", parentEmailContent);
    } else {
      return res.status(400).json({
        success: false,
        message: "Parent details are required when creating a new parent.",
      });
    }

    if (parentData) {
      // Change this line:
      studentData.parentId = parentData.parentId || parentExist.parentId;
      studentData.parentAdmissionNumber = parentAdmissionNumber || parentData.admissionNumber;
      await studentData.save();
      
    } else {
      return res.status(500).json({
        success: false,
        message: "Parent creation failed due to an error.",
      });
    }
    

    const schoolDetails = await AdminInfo.findOne({ schoolId }).select("schoolName image.url");
    const schoolName = schoolDetails?.schoolName || "Your School";
    const schoolImageUrl =
      schoolDetails?.image?.url ||
      "https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg";
    const softwareLogoUrl =
      "https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png";

    const studentEmailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admission Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Comic Sans MS', Arial, sans-serif; background-color: #e0f7fa; color: #000000;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
              <img src="${schoolImageUrl}" alt="${schoolName}" style="max-width: 120px; height: auto; border-radius: 50%; border: 3px solid #fff; margin-bottom: 10px;" onerror="this.src='https://i.ibb.co/1Y1qz1g/school.webp';">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">${schoolName}</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Welcome to Your Learning Journey!</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, ${studentFullName}!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">We’re thrilled to welcome you to ${schoolName}! Your admission has been successfully created.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Admission Details</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Student Name:</strong> ${studentFullName}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Student ID:</strong> ${studentData.studentId}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Class:</strong> ${studentClass}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Admission Number:</strong> ${studentAdmissionNumberToUse}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Status:</strong> <span style="color: #ff5600; font-weight: bold;">Approved</span></p>
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Get ready for an amazing adventure with us! Your journey starts on ${studentJoiningDate}.</p>
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
    await sendEmail(studentEmail, "Admission Confirmation", studentEmailContent);

    res.status(201).json({
      success: true,
      message: "Student and parent created successfully, emails sent.",
      student: studentData,
      parent: parentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Student and parent registration failed due to an error.",
      error: error.message,
    });
  }
};

exports.createBulkStudentParent = async (req, res) => {
  try {
    if (!req.body || !req.body.students || !Array.isArray(req.body.students)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid request format. Please provide an array of students in the 'students' field.",
      });
    }

    const studentsData = req.body.students;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const createdBy = req.user._id;
    const createdStudents = [];
    const errors = [];

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message:
          "School ID and session are required from authenticated admin.",
      });
    }
    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: "User ID is required from authenticated admin.",
      });
    }

    // Process each student record in bulk
    for (const student of studentsData) {
      const {
        studentFullName,
        studentEmail,
        studentPassword,
        studentDateOfBirth,
        studentGender,
        studentJoiningDate,
        studentAddress,
        studentContact,
        studentClass,
        studentSection,
        studentCountry,
        studentSubject,
        fatherName,
        motherName,
        guardianName,
        remarks,
        transport,
        parentEmail,
        parentPassword,
        parentContact,
        parentIncome,
        parentQualification,
        religion,
        caste,
        nationality,
        pincode,
        state,
        city,
        admissionNumber,
        parentAdmissionNumber,
        // UDISE+ fields
        stu_id,
        class: studentUdiseClass,
        section: studentUdiseSection,
        roll_no,
        student_name,
        gender: studentUdiseGender,
        DOB,
        mother_name,
        father_name: udiseFatherName,
        guardian_name: udiseGuardianName,
        aadhar_no,
        aadhar_name,
        paddress,
        pincode: udisePlusPincode,
        mobile_no,
        alt_mobile_no,
        email_id,
        mothere_tougue,
        category,
        minority,
        is_bpl,
        is_aay,
        ews_aged_group,
        is_cwsn,
        cwsn_imp_type,
        ind_national,
        mainstramed_child,
        adm_no,
        adm_date,
        stu_stream,
        pre_year_schl_status,
        pre_year_class,
        stu_ward,
        pre_class_exam_app,
        result_pre_exam,
        perc_pre_class,
        att_pre_class,
        fac_free_uniform,
        fac_free_textbook,
        received_central_scholarship,
        name_central_scholarship,
        received_state_scholarship,
        received_other_scholarship,
        scholarship_amount,
        fac_provided_cwsn,
        SLD_type,
        aut_spec_disorder,
        ADHD,
        inv_ext_curr_activity,
        vocational_course,
        trade_sector_id,
        job_role_id,
        pre_app_exam_vocationalsubject,
        bpl_card_no,
        ann_card_no,
      } = student;

      try {
        // Validate only the required fields as per your schema
        if (!studentFullName)
          throw new Error("Student full name is required.");
        if (!studentEmail)
          throw new Error("Student email is required.");
        if (!studentPassword)
          throw new Error("Student password is required.");
        if (!fatherName)
          throw new Error("Father's name is required.");
        if (!studentJoiningDate)
          throw new Error("Student joining date is required.");
        if (!studentClass)
          throw new Error("Student class is required.");
        if (!parentEmail && !parentAdmissionNumber)
          throw new Error("Parent email or admission number is required.");
        if (!parentPassword && !parentAdmissionNumber)
          throw new Error(
            "Parent password is required when creating a new parent."
          );

        // Check for duplicate student record in same school/session
        const studentExist = await NewStudentModel.findOne({
          email: studentEmail,
          schoolId,
          session,
        });
        if (studentExist)
          throw new Error(
            `Student with email ${studentEmail} already exists in this school and session.`
          );

        // Find parent if exists based on parentAdmissionNumber or parentEmail
        const parentExist = parentAdmissionNumber
          ? await ParentModel.findOne({
              admissionNumber: parentAdmissionNumber,
              schoolId,
              session,
            })
          : parentEmail
          ? await ParentModel.findOne({ email: parentEmail, schoolId, session })
          : null;

        if (parentAdmissionNumber && !parentExist)
          throw new Error(
            `Parent with admission number ${parentAdmissionNumber} does not exist in this school and session.`
          );
        if (!parentAdmissionNumber && parentEmail && parentExist)
          throw new Error(
            `Parent with email ${parentEmail} already exists in this school and session.`
          );

        const studentHashPassword = await hashPassword(studentPassword);
        const parentHashPassword = parentPassword
          ? await hashPassword(parentPassword)
          : undefined;

        const studentAdmissionNumberToUse =
          admissionNumber && admissionNumber.trim() !== ""
            ? admissionNumber
            : await generateAdmissionNumber(schoolId, NewStudentModel);

        // Create the student record
        const studentData = await NewStudentModel.create({
          schoolId,
          session,
          studentName: studentFullName,
          email: studentEmail,
          password: studentHashPassword,
          dateOfBirth: studentDateOfBirth,
          rollNo: (
            (await NewStudentModel.countDocuments({
              schoolId,
              class: studentClass,
              section: studentSection,
            })) + 1
          ).toString(),
          gender: studentGender,
          joiningDate: studentJoiningDate,
          address: studentAddress,
          contact: studentContact,
          class: studentClass,
          fatherName,
          motherName,
          guardianName,
          remarks,
          transport,
          section: studentSection,
          country: studentCountry,
          subject: studentSubject,
          admissionNumber: studentAdmissionNumberToUse,
          religion,
          caste,
          nationality,
          pincode,
          state,
          city,
          createdBy,
          approvalStatus: "approved",
          assignedThirdParty: null,
          udisePlusDetails: {
            stu_id,
            class: studentUdiseClass,
            section: studentUdiseSection,
            roll_no,
            student_name,
            gender: studentUdiseGender,
            DOB,
            mother_name,
            father_name: udiseFatherName,
            guardian_name: udiseGuardianName,
            aadhar_no,
            aadhar_name,
            paddress,
            pincode: udisePlusPincode,
            mobile_no,
            alt_mobile_no,
            email_id,
            mothere_tougue,
            category,
            minority,
            is_bpl,
            is_aay,
            ews_aged_group,
            is_cwsn,
            cwsn_imp_type,
            ind_national,
            mainstramed_child,
            adm_no,
            adm_date,
            stu_stream,
            pre_year_schl_status,
            pre_year_class,
            stu_ward,
            pre_class_exam_app,
            result_pre_exam,
            perc_pre_class,
            att_pre_class,
            fac_free_uniform,
            fac_free_textbook,
            received_central_scholarship,
            name_central_scholarship,
            received_state_scholarship,
            received_other_scholarship,
            scholarship_amount,
            fac_provided_cwsn,
            SLD_type,
            aut_spec_disorder,
            ADHD,
            inv_ext_curr_activity,
            vocational_course,
            trade_sector_id,
            job_role_id,
            pre_app_exam_vocationalsubject,
            bpl_card_no,
            ann_card_no,
          },
        });

        let parentData = null;
        if (parentAdmissionNumber) {
          // Update existing parent with the new student record
          parentData = await ParentModel.findOneAndUpdate(
            { admissionNumber: parentAdmissionNumber, schoolId, session },
            {
              $push: { studentIds: studentData.studentId },
              $addToSet: { studentNames: studentFullName },
            },
            { new: true }
          );
        } else if (parentEmail && parentPassword) {
          // Create a new parent record
          parentData = await ParentModel.create({
            schoolId,
            session,
            studentIds: [studentData.studentId],
            studentNames: [studentFullName],
            fatherName,
            motherName,
            guardianName,
            email: parentEmail,
            password: parentHashPassword,
            contact: parentContact,
            admissionNumber: await generateAdmissionNumber(schoolId, ParentModel),
            income: parentIncome,
            qualification: parentQualification,
            createdBy,
          });

          // Optionally, send parent email credentials
          const parentEmailContent = `<p>Your EmailID: ${parentEmail}</p><p>Your Password: ${parentPassword}</p><p>Your Parent ID: ${parentData.parentId}</p>`;
          await sendEmail(parentEmail, "Parent Login Credentials", parentEmailContent);
        } else {
          throw new Error("Parent details are required when creating a new parent.");
        }

        if (parentData) {
          studentData.parentId = parentData.parentId || (parentExist && parentExist.parentId);
          studentData.parentAdmissionNumber = parentAdmissionNumber || parentData.admissionNumber;
          await studentData.save();
        } else {
          throw new Error("Parent creation failed due to an error.");
        }

        createdStudents.push(studentData);
      } catch (error) {
        errors.push({
          studentEmail: studentEmail || "unknown",
          error: error.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Bulk student and parent creation process completed successfully.",
      createdStudents,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        "Bulk student and parent creation failed due to an unexpected error.",
      error: error.message,
    });
  }
};


// editStudentParent controller
exports.editStudentParent = async (req, res) => {
  try {
    const studentId = req.params.studentId; // Now using UUID
    const formData = req.body;
    const files = req.files || [];
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    console.log("Input Data:", { studentId, schoolId, session });

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID (UUID) is required in the URL parameter.",
      });
    }

    const student = await NewStudentModel.findOne({ studentId, schoolId, session });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or does not belong to this school and session.",
      });
    }

    if (formData.studentName !== undefined && !formData.studentName) {
      return res.status(400).json({
        success: false,
        message: "Student full name is required and cannot be empty.",
      });
    }
    if (formData.email !== undefined) {
      if (!formData.email) {
        return res.status(400).json({
          success: false,
          message: "Student email is required and cannot be empty.",
        });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        return res.status(400).json({ success: false, message: "Invalid email format." });
      }
    }
    if (formData.fatherName !== undefined && !formData.fatherName) {
      return res.status(400).json({
        success: false,
        message: "Father's name is required and cannot be empty.",
      });
    }
    if (formData.joiningDate !== undefined && !formData.joiningDate) {
      return res.status(400).json({
        success: false,
        message: "Joining date is required and cannot be empty.",
      });
    }
    if (formData.class !== undefined && !formData.class) {
      return res.status(400).json({
        success: false,
        message: "Class is required and cannot be empty.",
      });
    }
    if (formData.dateOfBirth !== undefined) {
      if (!formData.dateOfBirth) {
        return res.status(400).json({ success: false, message: "Date of birth cannot be empty." });
      }
      const dob = new Date(formData.dateOfBirth);
      if (dob > new Date()) {
        return res.status(400).json({
          success: false,
          message: "Date of birth cannot be in the future.",
        });
      }
    }
    if (
      formData.transport !== undefined &&
      !["yes", "no", "school_bus", "private"].includes(formData.transport)
    ) {
      return res.status(400).json({
        success: false,
        message: "Transport must be one of: 'yes', 'no', 'school_bus', 'private'.",
      });
    }
    if (formData.admissionNumber !== undefined) {
      if (!formData.admissionNumber) {
        return res.status(400).json({
          success: false,
          message: "Admission number is required and cannot be empty.",
        });
      }
      if (!/^[A-Z]{2}\d{4}$/.test(formData.admissionNumber)) {
        return res.status(400).json({
          success: false,
          message:
            "Admission number must follow the pattern: 2 uppercase letters followed by 4 digits (e.g., DI1000).",
        });
      }
    }

    let studentHashPassword = student.password;
    if (formData.password) {
      if (formData.password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Student password must be at least 8 characters long.",
        });
      }
      studentHashPassword = await hashPassword(formData.password);
    }

    let studentImageResult = student.studentImage;
    let fatherImageResult = student.fatherImage;
    let motherImageResult = student.motherImage;
    let guardianImageResult = student.guardianImage;

    const studentFile = files.find((f) => f.fieldname === "studentImage");
    const fatherFile = files.find((f) => f.fieldname === "fatherImage");
    const motherFile = files.find((f) => f.fieldname === "motherImage");
    const guardianFile = files.find((f) => f.fieldname === "guardianImage");

    if (studentFile) {
      if (student.studentImage.public_id) {
        await s3.deleteObject({
          Bucket: process.env.MINIO_BUCKET,
          Key: student.studentImage.public_id,
        }).promise();
      }
      const fileKey = `students/${Date.now()}-${studentFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: studentFile.buffer,
        ContentType: studentFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      studentImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (fatherFile) {
      if (student.fatherImage.public_id) {
        await s3.deleteObject({
          Bucket: process.env.MINIO_BUCKET,
          Key: student.fatherImage.public_id,
        }).promise();
      }
      const fileKey = `students/father/${Date.now()}-${fatherFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: fatherFile.buffer,
        ContentType: fatherFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      fatherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (motherFile) {
      if (student.motherImage.public_id) {
        await s3.deleteObject({
          Bucket: process.env.MINIO_BUCKET,
          Key: student.motherImage.public_id,
        }).promise();
      }
      const fileKey = `students/mother/${Date.now()}-${motherFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: motherFile.buffer,
        ContentType: motherFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      motherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianFile) {
      if (student.guardianImage.public_id) {
        await s3.deleteObject({
          Bucket: process.env.MINIO_BUCKET,
          Key: student.guardianImage.public_id,
        }).promise();
      }
      const fileKey = `students/guardian/${Date.now()}-${guardianFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: guardianFile.buffer,
        ContentType: guardianFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      guardianImageResult = { public_id: fileKey, url: minioData.Location };
    }

    const updateStudentFields = {
      studentName: formData.studentName || student.studentName,
      email: formData.email || student.email,
      password: studentHashPassword,
      dateOfBirth: formData.dateOfBirth || student.dateOfBirth,
      motherName: formData.motherName || student.motherName,
      fatherName: formData.fatherName || student.fatherName,
      guardianName: formData.guardianName || student.guardianName,
      remarks: formData.remarks || student.remarks,
      transport: formData.transport || student.transport,
      parentContact: formData.parentContact || student.parentContact,
      rollNo: formData.rollNo || student.rollNo,
      parentId: formData.parentId || student.parentId,
      parentAdmissionNumber: formData.parentAdmissionNumber || student.parentAdmissionNumber,
      gender: formData.gender || student.gender,
      joiningDate: formData.joiningDate || student.joiningDate,
      address: formData.address || student.address,
      contact: formData.contact || student.contact,
      class: formData.class || student.class,
      section: formData.section || student.section,
      country: formData.country || student.country,
      subject: formData.subject || student.subject,
      studentImage: studentImageResult.url ? studentImageResult : student.studentImage,
      fatherImage: fatherImageResult.url ? fatherImageResult : student.fatherImage,
      motherImage: motherImageResult.url ? motherImageResult : student.motherImage,
      guardianImage: guardianImageResult.url ? guardianImageResult : student.guardianImage,
      admissionNumber: formData.admissionNumber || student.admissionNumber,
      religion: formData.religion || student.religion,
      caste: formData.caste || student.caste,
      nationality: formData.nationality || student.nationality,
      pincode: formData.pincode || student.pincode,
      state: formData.state || student.state,
      city: formData.city || student.city,
      udisePlusDetails: {
        stu_id: formData.stu_id || student.udisePlusDetails?.stu_id,
        class: formData.studentUdiseClass || student.udisePlusDetails?.class,
        section: formData.studentUdiseSection || student.udisePlusDetails?.section,
        roll_no: formData.roll_no || student.udisePlusDetails?.roll_no,
        student_name: formData.student_name || student.udisePlusDetails?.student_name,
        gender: formData.studentUdiseGender || student.udisePlusDetails?.gender,
        DOB: formData.DOB || student.udisePlusDetails?.DOB,
        mother_name: formData.mother_name || student.udisePlusDetails?.mother_name,
        father_name: formData.father_name || student.udisePlusDetails?.father_name,
        guardian_name: formData.guardian_name || student.udisePlusDetails?.guardian_name,
        aadhar_no: formData.aadhar_no || student.udisePlusDetails?.aadhar_no,
        aadhar_name: formData.aadhar_name || student.udisePlusDetails?.aadhar_name,
        paddress: formData.paddress || student.udisePlusDetails?.paddress,
        pincode: formData.udisePlusPincode || student.udisePlusDetails?.pincode,
        mobile_no: formData.mobile_no || student.udisePlusDetails?.mobile_no,
        alt_mobile_no: formData.alt_mobile_no || student.udisePlusDetails?.alt_mobile_no,
        email_id: formData.email_id || student.udisePlusDetails?.email_id,
        mothere_tougue: formData.mothere_tougue || student.udisePlusDetails?.mothere_tougue,
        category: formData.category || student.udisePlusDetails?.category,
        minority: formData.minority || student.udisePlusDetails?.minority,
        is_bpl: formData.is_bpl || student.udisePlusDetails?.is_bpl,
        is_aay: formData.is_aay || student.udisePlusDetails?.is_aay,
        ews_aged_group: formData.ews_aged_group || student.udisePlusDetails?.ews_aged_group,
        is_cwsn: formData.is_cwsn || student.udisePlusDetails?.is_cwsn,
        cwsn_imp_type: formData.cwsn_imp_type || student.udisePlusDetails?.cwsn_imp_type,
        ind_national: formData.ind_national || student.udisePlusDetails?.ind_national,
        mainstramed_child: formData.mainstramed_child || student.udisePlusDetails?.mainstramed_child,
        adm_no: formData.adm_no || student.udisePlusDetails?.adm_no,
        adm_date: formData.adm_date || student.udisePlusDetails?.adm_date,
        stu_stream: formData.stu_stream || student.udisePlusDetails?.stu_stream,
        pre_year_schl_status: formData.pre_year_schl_status || student.udisePlusDetails?.pre_year_schl_status,
        pre_year_class: formData.pre_year_class || student.udisePlusDetails?.pre_year_class,
        stu_ward: formData.stu_ward || student.udisePlusDetails?.stu_ward,
        pre_class_exam_app: formData.pre_class_exam_app || student.udisePlusDetails?.pre_class_exam_app,
        result_pre_exam: formData.result_pre_exam || student.udisePlusDetails?.result_pre_exam,
        perc_pre_class: formData.perc_pre_class || student.udisePlusDetails?.perc_pre_class,
        att_pre_class: formData.att_pre_class || student.udisePlusDetails?.att_pre_class,
        fac_free_uniform: formData.fac_free_uniform || student.udisePlusDetails?.fac_free_uniform,
        fac_free_textbook: formData.fac_free_textbook || student.udisePlusDetails?.fac_free_textbook,
        received_central_scholarship: formData.received_central_scholarship || student.udisePlusDetails?.received_central_scholarship,
        name_central_scholarship: formData.name_central_scholarship || student.udisePlusDetails?.name_central_scholarship,
        received_state_scholarship: formData.received_state_scholarship || student.udisePlusDetails?.received_state_scholarship,
        received_other_scholarship: formData.received_other_scholarship || student.udisePlusDetails?.received_other_scholarship,
        scholarship_amount: formData.scholarship_amount || student.udisePlusDetails?.scholarship_amount,
        fac_provided_cwsn: formData.fac_provided_cwsn || student.udisePlusDetails?.fac_provided_cwsn,
        SLD_type: formData.SLD_type || student.udisePlusDetails?.SLD_type,
        aut_spec_disorder: formData.aut_spec_disorder || student.udisePlusDetails?.aut_spec_disorder,
        ADHD: formData.ADHD || student.udisePlusDetails?.ADHD,
        inv_ext_curr_activity: formData.inv_ext_curr_activity || student.udisePlusDetails?.inv_ext_curr_activity,
        vocational_course: formData.vocational_course || student.udisePlusDetails?.vocational_course,
        trade_sector_id: formData.trade_sector_id || student.udisePlusDetails?.trade_sector_id,
        job_role_id: formData.job_role_id || student.udisePlusDetails?.job_role_id,
        pre_app_exam_vocationalsubject: formData.pre_app_exam_vocationalsubject || student.udisePlusDetails?.pre_app_exam_vocationalsubject,
        bpl_card_no: formData.bpl_card_no || student.udisePlusDetails?.bpl_card_no,
        ann_card_no: formData.ann_card_no || student.udisePlusDetails?.ann_card_no,
      },
    };

    const updatedStudent = await NewStudentModel.findOneAndUpdate(
      { studentId, schoolId, session },
      updateStudentFields,
      { new: true, runValidators: true }
    );

    if (formData.parentId) {
      const parent = await ParentModel.findOne({ parentId: formData.parentId, schoolId, session });
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent not found or does not belong to this school and session.",
        });
      }

      if (formData.fatherName !== undefined && !formData.fatherName) {
        return res.status(400).json({
          success: false,
          message: "Parent's father name is required and cannot be empty.",
        });
      }
      if (formData.email !== undefined) {
        if (!formData.email) {
          return res.status(400).json({
            success: false,
            message: "Parent's email is required and cannot be empty.",
          });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          return res.status(400).json({ success: false, message: "Invalid parent email format." });
        }
      }
      if (formData.contact !== undefined && !formData.contact) {
        return res.status(400).json({
          success: false,
          message: "Parent contact is required and cannot be empty.",
        });
      }
      if (formData.admissionNumber !== undefined) {
        if (!formData.admissionNumber) {
          return res.status(400).json({
            success: false,
            message: "Parent admission number is required and cannot be empty.",
          });
        }
        if (!/^[A-Z]{2}\d{4}$/.test(formData.admissionNumber)) {
          return res.status(400).json({
            success: false,
            message:
              "Parent admission number must follow the pattern: 2 uppercase letters followed by 4 digits (e.g., DI1000).",
          });
        }
      }

      let parentHashPassword = parent.password;
      if (formData.parentPassword) {
        if (formData.parentPassword.length < 8) {
          return res.status(400).json({
            success: false,
            message: "Parent password must be at least 8 characters long.",
          });
        }
        parentHashPassword = await hashPassword(formData.parentPassword);
      }

      let parentImageResult = parent.parentImage;
      let pFatherImageResult = parent.fatherImage;
      let pMotherImageResult = parent.motherImage;
      let pGuardianImageResult = parent.guardianImage;

      const parentFile = files.find((f) => f.fieldname === "parentImage");

      if (parentFile) {
        if (parent.parentImage.public_id) {
          await s3.deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: parent.parentImage.public_id,
          }).promise();
        }
        const fileKey = `parents/${Date.now()}-${parentFile.originalname}`;
        const params = {
          Bucket: process.env.MINIO_BUCKET,
          Key: fileKey,
          Body: parentFile.buffer,
          ContentType: parentFile.mimetype,
          ACL: "public-read",
        };
        const minioData = await s3.upload(params).promise();
        parentImageResult = { public_id: fileKey, url: minioData.Location };
      }
      if (fatherFile) {
        if (parent.fatherImage.public_id) {
          await s3.deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: parent.fatherImage.public_id,
          }).promise();
        }
        const fileKey = `parents/father/${Date.now()}-${fatherFile.originalname}`;
        const params = {
          Bucket: process.env.MINIO_BUCKET,
          Key: fileKey,
          Body: fatherFile.buffer,
          ContentType: fatherFile.mimetype,
          ACL: "public-read",
        };
        const minioData = await s3.upload(params).promise();
        pFatherImageResult = { public_id: fileKey, url: minioData.Location };
      }
      if (motherFile) {
        if (parent.motherImage.public_id) {
          await s3.deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: parent.motherImage.public_id,
          }).promise();
        }
        const fileKey = `parents/mother/${Date.now()}-${motherFile.originalname}`;
        const params = {
          Bucket: process.env.MINIO_BUCKET,
          Key: fileKey,
          Body: motherFile.buffer,
          ContentType: motherFile.mimetype,
          ACL: "public-read",
        };
        const minioData = await s3.upload(params).promise();
        pMotherImageResult = { public_id: fileKey, url: minioData.Location };
      }
      if (guardianFile) {
        if (parent.guardianImage.public_id) {
          await s3.deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: parent.guardianImage.public_id,
          }).promise();
        }
        const fileKey = `parents/guardian/${Date.now()}-${guardianFile.originalname}`;
        const params = {
          Bucket: process.env.MINIO_BUCKET,
          Key: fileKey,
          Body: guardianFile.buffer,
          ContentType: guardianFile.mimetype,
          ACL: "public-read",
        };
        const minioData = await s3.upload(params).promise();
        pGuardianImageResult = { public_id: fileKey, url: minioData.Location };
      }

      const updateParentFields = {
        fatherName: formData.fatherName || parent.fatherName,
        motherName: formData.motherName || parent.motherName,
        guardianName: formData.guardianName || parent.guardianName,
        email: formData.email || parent.email,
        password: parentHashPassword,
        contact: formData.contact || parent.contact,
        income: formData.income || parent.income,
        qualification: formData.qualification || parent.qualification,
        parentImage: parentImageResult.url ? parentImageResult : parent.parentImage,
        fatherImage: pFatherImageResult.url ? pFatherImageResult : parent.fatherImage,
        motherImage: pMotherImageResult.url ? pMotherImageResult : parent.motherImage,
        guardianImage: pGuardianImageResult.url ? pGuardianImageResult : parent.guardianImage,
        admissionNumber: formData.admissionNumber || parent.admissionNumber,
      };

      await ParentModel.findOneAndUpdate(
        { parentId: formData.parentId, schoolId, session },
        updateParentFields,
        { new: true, runValidators: true }
      );
    }

    res.status(200).json({
      success: true,
      message: "Student and parent details updated successfully.",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Error in editStudentParent:", error);
    res.status(500).json({
      success: false,
      message: "Error updating student and parent details.",
      error: error.message,
    });
  }
};

exports.getStudentParent = async (req, res) => {
  try {
    // Get schoolId and session from authenticated user
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    // Extract query parameters
    const {
      studentId,
      parentId,
      admissionNumber,
      parentAdmissionNumber,
      email,
      class: studentClass,
      section,
      gender,
      status, // New parameter for filtering by status (active or deactivated)
      fetchAllStudents,
      fetchAllParents,
      fetchParentsWithMultipleChildren,
      limit = 10,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Base query objects
    let studentQuery = { schoolId, session };
    let parentQuery = { schoolId, session };

    // Build student query - use studentId field instead of _id
    if (studentId) studentQuery.studentId = studentId;
    if (admissionNumber) studentQuery.admissionNumber = admissionNumber;
    if (email) studentQuery.email = email;
    if (studentClass) studentQuery.class = studentClass;
    if (section) studentQuery.section = section;
    if (gender) studentQuery.gender = gender;
    if (status) studentQuery.status = status; // Add status filter for students

    // Build parent query - use parentId field instead of _id
    if (parentId) parentQuery.parentId = parentId;
    if (parentAdmissionNumber) parentQuery.admissionNumber = parentAdmissionNumber;
    if (email) parentQuery.email = email;
    if (status) parentQuery.status = status; // Add status filter for parents

    // Pagination
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Execute queries based on what's requested
    let responseData = {};

    // If specific studentId is provided, fetch only that student
    if (studentId) {
      const student = await NewStudentModel.findOne(studentQuery).lean();
      
      if (!student) {
        return res.status(404).json({
          success: false,
          message: `Student with ID ${studentId} not found`,
        });
      }
      
      let parentData = null;
      if (student.parentId) {
        parentData = await ParentModel.findOne({ 
          parentId: student.parentId, 
          schoolId, 
          session,
          ...(status ? { status } : {}) // Apply status filter if provided
        }).lean();
      }
      
      responseData.student = {
        ...student,
        parentDetails: parentData
      };
    }
    // If specific parentId is provided, fetch that parent with all children
    else if (parentId) {
      const parent = await ParentModel.findOne(parentQuery).lean();
      
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: `Parent with ID ${parentId} not found`,
        });
      }
      
      const students = await NewStudentModel.find({
        parentId: parent.parentId,
        schoolId,
        session,
        ...(status ? { status } : {}) // Apply status filter if provided
      }).lean();
      
      // Check if parent has multiple children
      const hasMultipleChildren = students.length > 1;
      
      responseData.parent = {
        ...parent,
        studentDetails: students,
        hasMultipleChildren: hasMultipleChildren,
        totalChildren: students.length
      };
    }
    // Fetch all parents with multiple children
    else if (fetchParentsWithMultipleChildren === 'true') {
      const parents = await ParentModel.find({ schoolId, session, ...(status ? { status } : {}) })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Filter parents with multiple children and fetch their students
      const parentsWithMultipleChildren = [];
      for (const parent of parents) {
        const students = await NewStudentModel.find({
          parentId: parent.parentId,
          schoolId,
          session,
          ...(status ? { status } : {}) // Apply status filter if provided
        }).lean();
        
        if (students.length > 1) {
          parentsWithMultipleChildren.push({
            ...parent,
            studentDetails: students,
            totalChildren: students.length
          });
        }
      }

      const totalParentsWithMultiple = parentsWithMultipleChildren.length;

      responseData.parentsWithMultipleChildren = {
        data: parentsWithMultipleChildren.slice(skip, skip + parseInt(limit)),
        pagination: {
          total: totalParentsWithMultiple,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalParentsWithMultiple / limit),
        },
      };
    }
    // Fetch all students only (no filters)
    else if (fetchAllStudents === 'true') {
      const students = await NewStudentModel.find({ schoolId, session, ...(status ? { status } : {}) })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalStudents = await NewStudentModel.countDocuments({ schoolId, session, ...(status ? { status } : {}) });

      responseData.students = {
        data: students,
        pagination: {
          total: totalStudents,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalStudents / limit),
        },
      };
    }
    // Fetch all parents only (no filters)
    else if (fetchAllParents === 'true') {
      const parents = await ParentModel.find({ schoolId, session, ...(status ? { status } : {}) })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalParents = await ParentModel.countDocuments({ schoolId, session, ...(status ? { status } : {}) });

      responseData.parents = {
        data: parents,
        pagination: {
          total: totalParents,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalParents / limit),
        },
      };
    }
    // Fetch all students with filters
    else if (Object.keys(studentQuery).length > 2 || studentClass || section || gender) {
      const students = await NewStudentModel.find(studentQuery)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalStudents = await NewStudentModel.countDocuments(studentQuery);

      responseData.students = {
        data: students,
        pagination: {
          total: totalStudents,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalStudents / limit),
        },
      };
    }
    // Fetch all parents with filters
    else if (parentAdmissionNumber || (Object.keys(parentQuery).length > 2)) {
      const parents = await ParentModel.find(parentQuery)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalParents = await ParentModel.countDocuments(parentQuery);

      responseData.parents = {
        data: parents,
        pagination: {
          total: totalParents,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalParents / limit),
        },
      };
    }
    // Default: fetch both students and parents
    else {
      const [students, parents] = await Promise.all([
        NewStudentModel.find(studentQuery)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        ParentModel.find(parentQuery)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
      ]);

      const [totalStudents, totalParents] = await Promise.all([
        NewStudentModel.countDocuments(studentQuery),
        ParentModel.countDocuments(parentQuery),
      ]);

      responseData = {
        students: {
          data: students,
          pagination: {
            total: totalStudents,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalStudents / limit),
          },
        },
        parents: {
          data: parents,
          pagination: {
            total: totalParents,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalParents / limit),
          },
        },
      };
    }

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      data: responseData,
    });

  } catch (error) {
    console.error("Error in getStudentParent:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch data",
      error: error.message,
    });
  }
};

exports.getStudentAndParent = async (req, res) => {
  try {
    const studentId = req.params.studentId; // Now using UUID

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID (UUID) is required",
      });
    }

    const schoolId = req.user.schoolId;
    const session = req.user.session;

    // Remove the populate call since parentId is a string (UUID), not an ObjectId reference
    const studentData = await NewStudentModel.findOne({
      studentId,
      schoolId,
      session,
    });

    if (!studentData) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Fetch parent data separately using the parentId string
    const parentData = studentData.parentId
      ? await ParentModel.findOne({ parentId: studentData.parentId, schoolId, session })
      : null;

    res.status(200).json({
      success: true,
      student: studentData,
      parent: parentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving Student and Parent details",
      error: error.message,
    });
  }
};


exports.toggleStudentParentStatus = async (req, res) => {
  try {
    const studentId = req.params.studentId; // Using UUID as per your structure
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID (UUID) is required in the URL parameter.",
      });
    }

    // Find the student
    const student = await NewStudentModel.findOne({ studentId, schoolId, session });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or does not belong to this school and session.",
      });
    }

    // Toggle student status
    const newStudentStatus = student.status === "active" ? "deactivated" : "active";

    // Update student
    const updatedStudent = await NewStudentModel.findOneAndUpdate(
      { studentId, schoolId, session },
      {
        $set: {
          status: newStudentStatus,
          updatedBy,
          updatedAt: new Date(),
        },
      },
      { new: true, runValidators: true }
    );

    // If student has a parent, toggle parent's status as well
    let updatedParent = null;
    if (student.parentId) {
      const parent = await ParentModel.findOne({ parentId: student.parentId, schoolId, session });
      if (parent) {
        const newParentStatus = parent.status === "active" ? "deactivated" : "active";
        updatedParent = await ParentModel.findOneAndUpdate(
          { parentId: student.parentId, schoolId, session },
          {
            $set: {
              status: newParentStatus,
              updatedBy,
              updatedAt: new Date(),
            },
          },
          { new: true, runValidators: true }
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Student and parent status toggled successfully to ${newStudentStatus}`,
      student: updatedStudent,
      parent: updatedParent || "No parent associated",
    });
  } catch (error) {
    console.error("Error in toggleStudentParentStatus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle student and parent status",
      error: error.message,
    });
  }
};

/**
 * Approve Admission
 * PATCH /approveAdmission/:studentId
 * Sets the student's approvalStatus to "approved".
 */
// exports.approveAdmission = async (req, res) => {
//   try {
//     const { studentId } = req.params;
//     const student = await NewStudentModel.findById(studentId);
//     if (!student) {
//       return res.status(404).json({
//         success: false,
//         message: "Student not found"
//       });
//     }
//     student.approvalStatus = "approved";
//     await student.save();
//     return res.status(200).json({
//       success: true,
//       message: "Admission approved successfully",
//       student
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

/**
 * Get Pending Admissions
 * GET /pendingAdmissions
 * Retrieves all student records with approvalStatus "pending".
 */
// exports.getPendingAdmissions = async (req, res) => {
//   try {
//     const pendingAdmissions = await NewStudentModel.find({ approvalStatus: "pending" });
//     return res.status(200).json({
//       success: true,
//       message: "Pending admissions fetched successfully",
//       data: pendingAdmissions
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// PENDING ADMISSION
// exports.approveAdmission = async (req, res) => {
//   try {
//     const { studentId } = req.params;
//     const student = await Student.findById(studentId);

//     if (!student) {
//       return res.status(404).json({
//         success: false,
//         message: "Student not found"
//       });
//     }

//     if (student.approvalStatus === 'approved') {
//       return res.status(400).json({
//         success: false,
//         message: "Admission already approved"
//       });
//     }

//     student.approvalStatus = 'approved';
//     await student.save();

//     res.status(200).json({
//       success: true,
//       message: "Admission approved successfully",
//       student
//     });

//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

// exports.getPendingAdmissions = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const query = { approvalStatus: 'pending' };

//     const students = await Student.find(query)
//       .skip(skip)
//       .limit(limit)
//       .sort({ createdAt: -1 });

//     const total = await Student.countDocuments(query);

//     res.status(200).json({
//       success: true,
//       students,
//       pagination: {
//         currentPage: page,
//         totalPages: Math.ceil(total / limit),
//         totalStudents: total
//       }
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

/**
 * Approve Admission
 * PATCH /approveAdmission/:studentId
 * Sets the student's approvalStatus to "approved".
 */
exports.approveAdmission = async (req, res) => {
  try {
    const studentId = req.params.studentId; // Using UUID
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID (UUID) is required in the URL parameter.",
      });
    }

    const student = await NewStudentModel.findOne({ studentId, schoolId, session });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or does not belong to this school and session.",
      });
    }

    const updatedStudent = await NewStudentModel.findOneAndUpdate(
      { studentId, schoolId, session },
      {
        $set: {
          approvalStatus: "approved",
          updatedBy,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Admission approved successfully",
      student: updatedStudent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.approveMultipleAdmissions = async (req, res) => {
  try {
    const { studentIds } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of student IDs",
      });
    }

    const result = await NewStudentModel.updateMany(
      { studentId: { $in: studentIds }, schoolId, session, approvalStatus: "pending" },
      {
        $set: {
          approvalStatus: "approved",
          updatedBy,
          updatedAt: new Date(),
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} admissions approved successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Pending Admissions
 * GET /pendingAdmissions
 * Retrieves all student records with approvalStatus "pending".
 */
exports.getPendingAdmissions = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const pendingAdmissions = await NewStudentModel.find({
      schoolId,
      session,
      approvalStatus: "pending",
    }).lean();

    res.status(200).json({
      success: true,
      message: "Pending admissions fetched successfully",
      data: pendingAdmissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * getStudentsByClassSectionAdmin
 *
 * Fetches student records filtered by school, class, and section.
 * This version is for admin users who have full access.
 *
 * Query parameters:
 *  - schoolId (optional)
 *  - studentClass (optional)
 *  - studentSection (optional)
 *  - page (optional, default: 1)
 *  - limit (optional, default: 10)
 */
exports.getStudentsByClassSectionAdmin = async (req, res) => {
  try {
    const { schoolId, studentClass, studentSection } = req.query;
    // Convert page and limit to numbers, with defaults:
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build the query object based on provided filters
    const query = {};
    if (schoolId) query.schoolId = schoolId;
    if (studentClass) query.class = studentClass;
    if (studentSection) query.section = studentSection;

    // Query the student collection
    const students = await NewStudentModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalStudents = await NewStudentModel.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: students,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalStudents / limit),
        totalStudents,
      },
    });
  } catch (error) {
    console.error("Error in getStudentsByClassSectionAdmin:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.linkStudentToParent = async (req, res) => {
  try {
    const studentId = req.params.studentId; // Using UUID from URL params
    const { parentAdmissionNumber } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id; // Track who made the update

    // Validation
    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID (UUID) is required in the URL parameter.",
      });
    }
    if (!parentAdmissionNumber) {
      return res.status(400).json({
        success: false,
        message: "Parent admission number is required in the request body.",
      });
    }

    // Find the student using studentId (UUID)
    const student = await NewStudentModel.findOne({ studentId, schoolId, session });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or does not belong to this school and session.",
      });
    }

    // Find the new parent using parentAdmissionNumber
    const newParent = await ParentModel.findOne({
      admissionNumber: parentAdmissionNumber,
      schoolId,
      session,
    });
    if (!newParent) {
      return res.status(404).json({
        success: false,
        message: `Parent with admission number ${parentAdmissionNumber} not found in this school and session.`,
      });
    }

    // Check if the student is already linked to this parent
    if (student.parentId && student.parentId.toString() === newParent.parentId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Student is already linked to this parent.",
      });
    }

    // If the student was previously linked to another parent, update the old parent's student list
    if (student.parentId) {
      const oldParent = await ParentModel.findOne({ parentId: student.parentId, schoolId, session });
      if (oldParent) {
        oldParent.studentIds = oldParent.studentIds.filter(
          (id) => id.toString() !== student._id.toString()
        );
        oldParent.studentNames = oldParent.studentNames.filter(
          (name) => name !== student.studentName
        );
        await oldParent.save();
      }
    }

    // Update the new parent's student list
    newParent.studentIds.push(student._id);
    if (!newParent.studentNames.includes(student.studentName)) {
      newParent.studentNames.push(student.studentName);
    }
    newParent.updatedBy = updatedBy;
    newParent.updatedAt = new Date();
    await newParent.save();

    // Update the student's parent details
    student.parentId = newParent.parentId;
    student.parentAdmissionNumber = parentAdmissionNumber;
    student.updatedBy = updatedBy;
    student.updatedAt = new Date();
    await student.save();

    res.status(200).json({
      success: true,
      message: "Student successfully linked to the new parent.",
      student: {
        studentId: student.studentId,
        studentName: student.studentName,
        admissionNumber: student.admissionNumber,
        parentId: student.parentId,
        parentAdmissionNumber: student.parentAdmissionNumber,
        updatedBy: student.updatedBy,
        updatedAt: student.updatedAt,
      },
      parent: {
        parentId: newParent.parentId,
        fatherName: newParent.fatherName,
        admissionNumber: newParent.admissionNumber,
        studentIds: newParent.studentIds,
        studentNames: newParent.studentNames,
        updatedBy: newParent.updatedBy,
        updatedAt: newParent.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error in linkStudentToParent:", error);
    res.status(500).json({
      success: false,
      message: "Error linking student to parent.",
      error: error.message,
    });
  }
};

exports.addSibling = async (req, res) => {
  try {
    const {
      studentFullName,
      studentEmail,
      studentPassword,
      studentDateOfBirth,
      studentGender,
      studentJoiningDate,
      studentAddress,
      studentContact,
      studentClass,
      studentSection,
      studentCountry,
      studentSubject,
      parentAdmissionNumber, // Changed from parentId
      religion,
      caste,
      nationality,
      pincode,
      state,
      city,
    } = req.body;

    if (!studentEmail || !studentPassword || !parentAdmissionNumber) {
      return res.status(400).json({
        success: false,
        message: "Please Enter All required Data",
      });
    }

    const schoolId = req.user.schoolId;
    const studentExist = await NewStudentModel.findOne({
      email: studentEmail,
      schoolId,
    });
    const parentData = await ParentModel.findOne({
      admissionNumber: parentAdmissionNumber,
      schoolId,
    }); // Find parent using admissionNumber

    if (studentExist) {
      return res.status(400).json({
        success: false,
        message: "Student already exists with this email in the same school",
      });
    }

    if (!parentData) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    const studentHashPassword = await hashPassword(studentPassword);
    const studentAdmissionNumber = await generateAdmissionNumber(
      NewStudentModel
    );

    const studentData = await NewStudentModel.create({
      schoolId: req.user.schoolId,
      fullName: studentFullName,
      email: studentEmail,
      password: studentHashPassword,
      dateOfBirth: studentDateOfBirth,
      rollNo:
        (await NewStudentModel.countDocuments({
          schoolId,
          class: studentClass,
          section: studentSection,
        })) + 1,
      gender: studentGender,
      joiningDate: studentJoiningDate,
      address: studentAddress,
      contact: studentContact,
      class: studentClass,
      section: studentSection,
      country: studentCountry,
      subject: studentSubject,
      admissionNumber: studentAdmissionNumber,
      religion,
      caste,
      nationality,
      pincode,
      state,
      city,
      parentId: parentData._id,
      image: null, // Set image if available
    });

    // Add the new student's ID to the parent's studentIds array
    parentData.studentIds.push(studentData._id);
    await parentData.save();

    const studentEmailContent = `
      <p>Your EmailID: ${studentEmail}</p>
      <p>Your Password: ${studentPassword}</p>
    `;
    await sendEmail(
      studentEmail,
      "Student Login Credentials",
      studentEmailContent
    );

    res.status(201).json({
      success: true,
      message: "Sibling added successfully",
      studentData,
      parentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding sibling",
      error: error.message,
    });
  }
};

// exports.getParentWithChildren = async (req, res) => {
//   try {
//     const parentAdmissionNumber = req.params.parentAdmissionNumber;

//     if (!parentAdmissionNumber) {
//       return res.status(400).json({
//         success: false,
//         message: "Parent admission number is required",
//       });
//     }

//     // Find the parent and populate student details
//     const parent = await ParentModel.findOne({
//       admissionNumber: parentAdmissionNumber,
//     }).populate("studentIds"); // Ensure that studentIds field is populated with student details

//     if (!parent) {
//       return res.status(404).json({
//         success: false,
//         message: "Parent not found",
//       });
//     }

//     // Get dues for each child based on their admission number
//     const childrenWithDues = await Promise.all(
//       parent.studentIds.map(async (student) => {
//         const feeStatus = await FeeStatus.findOne({
//           admissionNumber: student.admissionNumber,
//         });
//         const totalDues = feeStatus ? feeStatus.dues : 0; // If no fee record, dues are 0 by default

//         return {
//           schoolId: student.schoolId,
//           fullName: student.fullName,
//           email: student.email,
//           dateOfBirth: student.dateOfBirth,
//           rollNo: student.rollNo,
//           parentId: student.parentId,
//           status: student.status,
//           gender: student.gender,
//           joiningDate: student.joiningDate,
//           address: student.address,
//           contact: student.contact,
//           class: student.class,
//           section: student.section,
//           country: student.country,
//           subject: student.subject,
//           admissionNumber: student.admissionNumber,
//           image: student.image,
//           createdAt: student.createdAt,
//           dues: totalDues, // Add the dues for the student
//         };
//       })
//     );

//     // Format the response
//     res.status(200).json({
//       success: true,
//       parent: {
//         schoolId: parent.schoolId,
//         studentIds: parent.studentIds.map((student) => student._id.toString()), // Return student IDs
//         studentName: parent.studentName,
//         fullName: parent.fullName,
//         motherName: parent.motherName,
//         email: parent.email,
//         contact: parent.contact,
//         admissionNumber: parent.admissionNumber,
//         income: parent.income,
//         qualification: parent.qualification,
//         image: parent.image,
//         status: parent.status,
//         role: parent.role,
//         createdAt: parent.createdAt,
//       },
//       children: childrenWithDues, // Return children with dues included
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error retrieving parent with children",
//       error: error.message,
//     });
//   }
// };

exports.getDataByAdmissionNumber = async (req, res) => {
  try {
    const { admissionNumber } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const studentData = await NewStudentModel.findOne({ admissionNumber, schoolId, session });
    const parentData = await ParentModel.findOne({ admissionNumber, schoolId, session });
    const feeStatusData = await FeeStatus.findOne({ admissionNumber, schoolId, session });

    if (!studentData && !parentData && !feeStatusData) {
      return res.status(404).json({
        success: false,
        message: "No data found with this admission number for this school and session",
      });
    }

    res.status(200).json({
      success: true,
      studentData,
      parentData,
      feeStatusData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving data",
      error: error.message,
    });
  }
};

exports.getParentWithChildren = async (req, res) => {
  try {
    // Use parentId from request params
    const { parentId } = req.params;
    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: "Parent id is required",
      });
    }

    // Find the parent by parentId (no populate needed)
    const parent = await ParentModel.findOne({ parentId });
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    // Query the NewStudentModel to find children with the matching parentId
    const children = await NewStudentModel.find({ parentId });

    // Get dues for each child based on their admission number
    const childrenWithDues = await Promise.all(
      children.map(async (student) => {
        const feeStatus = await FeeStatus.findOne({
          admissionNumber: student.admissionNumber,
        });
        const totalDues = feeStatus ? feeStatus.dues : 0; // defaults to 0 if no fee record

        return {
          studentId: student.studentId,
          schoolId: student.schoolId,
          session: student.session,
          studentName: student.studentName,
          email: student.email,
          dateOfBirth: student.dateOfBirth,
          motherName: student.motherName,
          fatherName: student.fatherName,
          parentContact: student.parentContact,
          role: student.role,
          rollNo: student.rollNo,
          parentId: student.parentId,
          parentAdmissionNumber: student.parentAdmissionNumber,
          status: student.status,
          gender: student.gender,
          joiningDate: student.joiningDate,
          address: student.address,
          contact: student.contact,
          class: student.class,
          section: student.section,
          country: student.country,
          subject: student.subject,
          guardianName: student.guardianName,
          remarks: student.remarks,
          transport: student.transport,
          admissionNumber: student.admissionNumber,
          isGenerated: student.isGenerated,
          religion: student.religion,
          caste: student.caste,
          nationality: student.nationality,
          pincode: student.pincode,
          state: student.state,
          city: student.city,
          approvalStatus: student.approvalStatus,
          assignedThirdParty: student.assignedThirdParty,
          createdAt: student.createdAt,
          studentImage: student.studentImage,
          fatherImage: student.fatherImage,
          motherImage: student.motherImage,
          guardianImage: student.guardianImage,
          udisePlusDetails: student.udisePlusDetails,
          dues: totalDues,
        };
      })
    );

    // Format the parent response
    res.status(200).json({
      success: true,
      parent: {
        parentId: parent.parentId,
        schoolId: parent.schoolId,
        session: parent.session,
        studentIds: parent.studentIds,
        studentNames: parent.studentNames,
        fatherName: parent.fatherName,
        motherName: parent.motherName,
        email: parent.email,
        contact: parent.contact,
        admissionNumber: parent.admissionNumber,
        income: parent.income,
        qualification: parent.qualification,
        parentImage: parent.parentImage,
        fatherImage: parent.fatherImage,
        motherImage: parent.motherImage,
        guardianImage: parent.guardianImage,
        base64: parent.base64,
        createdBy: parent.createdBy,
        createdAt: parent.createdAt,
        status: parent.status,
        role: parent.role,
      },
      children: childrenWithDues,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving parent with children",
      error: error.message,
    });
  }
};



exports.getAllParentsWithChildren = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const parents = await ParentModel.find({
      schoolId,
      session,
      status: "active",
    }).populate({
      path: "studentIds",
      match: { schoolId, session, status: "active" },
    });

    if (parents.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active parents found for this school and session",
      });
    }

    const parentsWithChildren = parents.map((parent) => {
      const children = parent.studentIds.map((student) => ({
        studentId: student.studentId,
        schoolId: student.schoolId,
        session: student.session,
        fullName: student.fullName,
        email: student.email,
        dateOfBirth: student.dateOfBirth,
        rollNo: student.rollNo,
        parentId: student.parentId,
        status: student.status,
        gender: student.gender,
        joiningDate: student.joiningDate,
        address: student.address,
        contact: student.contact,
        class: student.class,
        section: student.section,
        country: student.country,
        subject: student.subject,
        admissionNumber: student.admissionNumber,
        studentImage: student.studentImage,
        createdAt: student.createdAt,
      }));

      return {
        parent: {
          parentId: parent.parentId,
          schoolId: parent.schoolId,
          session: parent.session,
          studentIds: parent.studentIds.map((student) => student.studentId),
          studentNames: parent.studentNames.join(", "),
          fullName: parent.fullName,
          motherName: parent.motherName,
          email: parent.email,
          contact: parent.contact,
          admissionNumber: parent.admissionNumber,
          income: parent.income,
          qualification: parent.qualification,
          parentImage: parent.parentImage,
          status: parent.status,
          role: parent.role,
          createdAt: parent.createdAt,
          children,
        },
        children,
      };
    });

    res.status(200).json({
      success: true,
      message: "List of parents with their children",
      data: parentsWithChildren,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving parents with children",
      error: error.message,
    });
  }
};

exports.updateParent = async (req, res) => {
  try {
    // Get parentId from URL parameters
    const { parentId } = req.params;
    const { fatherName, motherName, parentEmail, parentContact } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const parentData = await ParentModel.findOne({ parentId, schoolId, session });
    if (!parentData) {
      return res.status(404).json({
        success: false,
        message: "Parent not found or does not belong to this school and session.",
      });
    }

    const parentImageFile = req.file;
    let parentImageResult = parentData.parentImage;

    if (parentImageFile) {
      if (parentData.parentImage.public_id) {
        await s3.deleteObject({
          Bucket: process.env.MINIO_BUCKET,
          Key: parentData.parentImage.public_id,
        }).promise();
      }
      const fileKey = `parents/${Date.now()}-${parentImageFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: parentImageFile.buffer,
        ContentType: parentImageFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      parentImageResult = { public_id: fileKey, url: minioData.Location };
    }

    const updateFields = {
      fatherName: fatherName || parentData.fatherName,
      motherName: motherName || parentData.motherName,
      contact: parentContact || parentData.contact,
      email: parentEmail || parentData.email,
      parentImage: parentImageResult.url ? parentImageResult : parentData.parentImage,
      updatedBy,
      updatedAt: new Date(),
    };

    const updatedParentData = await ParentModel.findOneAndUpdate(
      { parentId, schoolId, session },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Parent data updated successfully",
      updatedParentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Parent data not updated due to error",
      error: error.message,
    });
  }
};


exports.deactivateParent = async (req, res) => {
  try {
    // Get parentId from URL parameters
    const { parentId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const parent = await ParentModel.findOneAndUpdate(
      { parentId, schoolId, session },
      {
        $set: {
          status: "deactivated",
          updatedBy,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found or does not belong to this school and session.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Parent deactivated successfully",
      parent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Parent not deactivated due to error",
      error: error.message,
    });
  }
};

exports.toggleParentStatus = async (req, res) => {
  try {
    // Get parentId from URL parameters
    const { parentId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    // Find the parent based on parentId, schoolId, and session
    const parent = await ParentModel.findOne({ parentId, schoolId, session });
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found or does not belong to this school and session.",
      });
    }

    // Toggle the parent's status between 'active' and 'deactivated'
    const newStatus = parent.status === "active" ? "deactivated" : "active";

    // Update the parent's status
    const updatedParent = await ParentModel.findOneAndUpdate(
      { parentId, schoolId, session },
      {
        $set: {
          status: newStatus,
          updatedBy,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Parent status updated to ${newStatus}`,
      parent: updatedParent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Parent status toggle failed due to error",
      error: error.message,
    });
  }
};


exports.getAllParents = async (req, res) => {
  try {
    const { parentEmail } = req.query;

    const filter = {
      ...(parentEmail ? { email: parentEmail } : {}),
      ...req.sessionFilter,
    };

    const allParent = await ParentModel.find({
      ...filter,
      schoolId: req.user.schoolId,
      status: "active",
    });

    if (allParent.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Parent Record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "List of parents",
      allParent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "All Parent list is not found due to error",
      error: error.message,
    });
  }
};

exports.bulkUpdateStudents = async (req, res) => {
  try {
    const {
      studentIds, // Array of specific student UUIDs to update
      filters, // Filters like class, section, etc.
      updateFields, // Object containing fields to update
    } = req.body;
    
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    console.log("Bulk Update Request Body:", req.body);
    console.log("Authentication Details:", { schoolId, session, updatedBy });

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    if (!updateFields || Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No update fields provided",
      });
    }

    // Build the query
    let query = { schoolId, session, status: "active" };

    if (studentIds && studentIds.length > 0) {
      query.studentId = { $in: studentIds };
    }

    if (filters) {
      if (filters.class) query.class = filters.class;
      if (filters.section) query.section = filters.section;
      if (filters.gender) query.gender = filters.gender;
      // Add other filters as needed
    }

    console.log("Query to find students:", query);

    // Check if any students match the query
    const matchingStudents = await NewStudentModel.countDocuments(query);
    console.log("Matching students count:", matchingStudents);
    
    if (matchingStudents === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found matching the criteria",
      });
    }

    // Validate update fields
    const validUpdateFields = {};
    const studentSchema = NewStudentModel.schema;

    for (const [key, value] of Object.entries(updateFields)) {
      if (key.includes(".")) {
        const [parent, child] = key.split(".");
        if (studentSchema.path(`${parent}.${child}`)) {
          validUpdateFields[key] = value;
        }
      } else if (studentSchema.path(key)) {
        validUpdateFields[key] = value;
      }
    }

    if (Object.keys(validUpdateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    validUpdateFields.updatedBy = updatedBy;
    validUpdateFields.updatedAt = new Date();

    console.log("Valid fields to update:", validUpdateFields);

    const result = await NewStudentModel.updateMany(
      query,
      { $set: validUpdateFields },
      { runValidators: true }
    );

    console.log("Update result:", result);

    const updatedStudents = await NewStudentModel.find(query).lean();

    res.status(200).json({
      success: true,
      message: "Students updated successfully",
      updatedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      updatedStudents,
    });
  } catch (error) {
    console.error("Error in bulkUpdateStudents:", error);
    res.status(500).json({
      success: false,
      message: "Error updating students",
      error: error.message,
    });
  }
};

exports.getAllStudents = async (req, res) => {
  try {
    const { email, studentClass, section } = req.query;

    // Ensure req.sessionFilter is properly set to filter based on session-specific data
    console.log("Session Filter:", req.sessionFilter);
    console.log("SchoolId:", req.user.schoolId);
    
    // Construct the filter
    const filter = {
      ...(email ? { email: email } : {}),
      ...(studentClass ? { class: studentClass } : {}),
      ...(section ? { section: section } : {}),
      ...req.sessionFilter, // Assuming sessionFilter contains additional filters based on session
    };

    console.log("Filter applied:", filter);

    // Find all students with the constructed filter
    const allStudent = await NewStudentModel.find({
      schoolId: req.user.schoolId,  // Filter by schoolId from the authenticated user
      status: "active",  // Only active students
      ...filter,  // Apply the additional filters (including session-based ones)
    });

    // Send the response
    res.status(200).json({
      success: true,
      message: "List of all students",
      allStudent,
    });
  } catch (error) {
    // Error handling
    console.error("Error in fetching students:", error.stack);
    res.status(500).json({
      success: false,
      message: "All student list is not found due to an error",
      error: error.message,
    });
  }
};

exports.deactivateStudent = async (req, res) => {
  try {
    // Get studentId from URL parameters
    const { studentId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const student = await NewStudentModel.findOne({ studentId, schoolId, session });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or does not belong to this school and session.",
      });
    }

    const updatedStudent = await NewStudentModel.findOneAndUpdate(
      { studentId, schoolId, session },
      {
        $set: {
          status: "deactivated",
          updatedBy,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    let updatedParent = null;
    if (student.parentId) {
      updatedParent = await ParentModel.findOneAndUpdate(
        { parentId: student.parentId, schoolId, session },
        {
          $set: {
            status: "deactivated",
            updatedBy,
            updatedAt: new Date(),
          },
        },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      message: "Student and parent deactivated successfully",
      student: updatedStudent,
      parent: updatedParent || "No parent associated",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Student not deactivated due to error",
      error: error.message,
    });
  }
};


exports.toggleStudentStatus = async (req, res) => {
  try {
    // Get studentId from URL parameters
    const { studentId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    // Find the student based on studentId, schoolId, and session
    const student = await NewStudentModel.findOne({ studentId, schoolId, session });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or does not belong to this school and session.",
      });
    }

    // Toggle the student's status between 'active' and 'deactivated'
    const newStatus = student.status === "active" ? "deactivated" : "active";

    // Update the student's status
    const updatedStudent = await NewStudentModel.findOneAndUpdate(
      { studentId, schoolId, session },
      {
        $set: {
          status: newStatus,
          updatedBy,
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Student status updated to ${newStatus}`,
      student: updatedStudent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Student status toggle failed due to error",
      error: error.message,
    });
  }
};




exports.getDeactivatedStudents = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const { email, studentClass, section } = req.query;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const filter = {
      schoolId,
      session,
      status: "deactivated",
      ...(email ? { email } : {}),
      ...(studentClass ? { class: studentClass } : {}),
      ...(section ? { section } : {}),
    };

    const deactivatedStudents = await NewStudentModel.find(filter).lean();

    if (deactivatedStudents.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No deactivated students found",
      });
    }

    res.status(200).json({
      success: true,
      message: "List of all deactivated students",
      deactivatedStudents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Unable to retrieve deactivated students due to an error",
      error: error.message,
    });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { email } = req.body;

    const student = await NewStudentModel.findOne({
      schoolId: req.user.schoolId,
      email: email,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Remove student from the parent's studentIds array
    const parent = await ParentModel.findByIdAndUpdate(
      student.parentId,
      { $pull: { studentIds: student._id } },
      { new: true }
    );

    // If the parent has no more children, delete the parent
    if (parent && parent.studentIds.length === 0) {
      await ParentModel.findByIdAndDelete(parent._id);
    }

    await NewStudentModel.findByIdAndDelete(student._id);

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Student deletion failed due to an error",
      error: error.message,
    });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const studentId = req.params.studentId; // Using UUID
    const { email, ...studentFields } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID (UUID) is required in the URL parameter.",
      });
    }

    const studentData = await NewStudentModel.findOne({ studentId, schoolId, session });
    if (!studentData) {
      return res.status(404).json({
        success: false,
        message: "Student not found or does not belong to this school and session.",
      });
    }

    const studentImageFile = req.file;
    let studentImageResult = studentData.studentImage;

    if (studentImageFile) {
      if (studentData.studentImage.public_id) {
        await s3.deleteObject({
          Bucket: process.env.MINIO_BUCKET,
          Key: studentData.studentImage.public_id,
        }).promise();
      }
      const fileKey = `students/${Date.now()}-${studentImageFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: studentImageFile.buffer,
        ContentType: studentImageFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      studentImageResult = { public_id: fileKey, url: minioData.Location };
    }

    const updateFields = {
      ...studentFields,
      email: email || studentData.email,
      studentImage: studentImageResult.url ? studentImageResult : studentData.studentImage,
      updatedBy,
      updatedAt: new Date(),
    };

    const updatedStudentData = await NewStudentModel.findOneAndUpdate(
      { studentId, schoolId, session },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Student data updated successfully",
      updatedStudentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Student data not updated due to error",
      error: error.message,
    });
  }
};

exports.getStudentsCreatedAfterAprilOfCurrentYear = async (req, res) => {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const cutoffMonth = 3; // April is month 3 (0-indexed)

    // Calculate the cutoff date based on the current year and April
    const cutoffDate = new Date(currentYear, cutoffMonth, 1);

    if (currentDate.getMonth() < cutoffMonth) {
      // If the current month is before April, subtract a year
      cutoffDate.setFullYear(currentYear - 1);
    }

    // Use the Mongoose 'find' method to query for students created after the cutoff date
    const allStudent = await NewStudentModel.find({
      schoolId: req.user.schoolId,
      status: "active",
      approvalStatus: "approved", // Only fetch approved records
      createdAt: { $gte: cutoffDate },
    });

    res.status(200).json({
      count: allStudent.length,
      success: true,

      message: "Get All Student Data Successfully",
      allStudent: allStudent,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// LATER TEST DELETE BY CLASSWISE/SCHOOLWISE CODE START

exports.deleteStudentsBySchool = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const result = await NewStudentModel.deleteMany({ schoolId });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} students deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete students by school",
      error: error.message,
    });
  }
};

exports.deleteStudentsByClass = async (req, res) => {
  try {
    const { studentClass } = req.body;
    const schoolId = req.user.schoolId;
    const result = await NewStudentModel.deleteMany({
      schoolId,
      class: studentClass,
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} students deleted successfully from class ${studentClass}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete students by class",
      error: error.message,
    });
  }
};




// LATER TEST DELETE BY CLASSWISE/SCHOOLWISE CODE START

exports.createEmployee = async (req, res) => {
  try {
    const { email, password, staffName, dateOfBirth, qualification, salary, gender, address, contact } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    if (!email || !password || !staffName) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    const employeeExist = await EmployeeModel.findOne({ schoolId, session, email });
    if (employeeExist) {
      return res.status(400).json({
        success: false,
        message: "Employee with this email already exists in this school and session.",
      });
    }

    // Check if file (image) is provided, if not, skip the image processing
    let employeeImage = null;
    if (req.file) {
      const fileUri = getDataUri(req.file);
      const uploadedImage = await cloudinary.v2.uploader.upload(fileUri.content);
      employeeImage = {
        public_id: uploadedImage.public_id,
        url: uploadedImage.url,
      };
    }

    const hashedPassword = await hashPassword(password);

    const employeeData = new EmployeeModel({
      schoolId,
      session,
      staffName,
      email,
      password: hashedPassword,
      dateOfBirth,
      qualification,
      salary,
      gender,
      address,
      contact,
      updatedBy,
      image: employeeImage,  // Image is optional now, can be null
    });

    await employeeData.save();

    // Fetch school details for email branding
    const schoolDetails = await AdminInfo.findOne({ schoolId }).select("schoolName image.url");
    const schoolName = schoolDetails?.schoolName || "Your School";
    const schoolImageUrl =
      schoolDetails?.image?.url || "https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg";
    const softwareLogoUrl =
      "https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png";

    const employeeEmailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Employee Account Created</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Comic Sans MS', Arial, sans-serif; background-color: #e0f7fa; color: #000000;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
              <img src="${schoolImageUrl}" alt="${schoolName}" style="max-width: 120px; height: auto; border-radius: 50%; border: 3px solid #fff; margin-bottom: 10px;" onerror="this.src='https://i.ibb.co/1Y1qz1g/school.webp';">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">${schoolName}</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Welcome to Our Team!</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, ${staffName}!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">We’re excited to have you join ${schoolName} as an employee.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Credentials</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Log in to start contributing to our school’s success!</p>
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

    await sendEmail(email, "Employee Login Credentials", employeeEmailContent);

    res.status(201).json({
      success: true,
      message: "Employee data created successfully",
      employeeData,
    });
  } catch (error) {
    console.error("Error in createEmployee:", error);
    res.status(500).json({
      success: false,
      message: "Employee data not created due to error",
      error: error.message,
    });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const { staffId, staffName, email, status, minSalary } = req.query;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    const query = { schoolId, session };

    if (staffId) query.staffId = staffId;
    if (staffName) query.staffName = { $regex: staffName, $options: "i" }; // Case-insensitive
    if (email) query.email = { $regex: email, $options: "i" };
    if (status) query.status = status;
    if (minSalary) query.salary = { $gte: parseFloat(minSalary) };

    const employees = await EmployeeModel.find(query).select("-password").lean();

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No employees found matching the criteria.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employees fetched successfully",
      employees,
    });
  } catch (error) {
    console.error("Error in getEmployees:", error);
    res.status(500).json({
      success: false,
      message: "Employees not fetched due to error",
      error: error.message,
    });
  }
};

exports.getAllEmployees = async (req, res) => {
  try {
    const { email } = req.query;
    const filter = {
      ...(email ? { email: email } : {}),
    };
    const allEmployee = await EmployeeModel.find({
      ...filter,
      schoolId: req.user.schoolId,
      status: "active",
    });

    res.status(200).json({
      success: true,
      message: "List of all Employee",
      allEmployee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "All Employee list is not found due to error",
      error: error.message,
    });
  }
};

exports.deactivateEmployee = async (req, res) => {
  try {
    const { staffId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff ID is required in the URL parameter.",
      });
    }

    const employee = await EmployeeModel.findOneAndUpdate(
      { staffId, schoolId, session },
      { $set: { status: "deactivated", updatedBy, updatedAt: new Date() } },
      { new: true }
    ).select("-password");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found or does not belong to this school and session.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee deactivated successfully",
      employee,
    });
  } catch (error) {
    console.error("Error in deactivateEmployee:", error);
    res.status(500).json({
      success: false,
      message: "Employee not deactivated due to error",
      error: error.message,
    });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { staffId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    const updateData = req.body;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff ID is required in the URL parameter.",
      });
    }

    const file = req.file;
    if (file) {
      const fileUri = getDataUri(file);
      const employeeImageResult = await cloudinary.v2.uploader.upload(fileUri.content);
      updateData.image = {
        public_id: employeeImageResult.public_id,
        url: employeeImageResult.url,
      };
    }

    const employee = await EmployeeModel.findOneAndUpdate(
      { staffId, schoolId, session },
      { $set: { ...updateData, updatedBy, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).select("-password");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found or does not belong to this school and session.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee data updated successfully",
      employee,
    });
  } catch (error) {
    console.error("Error in updateEmployee:", error);
    res.status(500).json({
      success: false,
      message: "Employee data not updated due to error",
      error: error.message,
    });
  }
};

exports.toggleEmployeeStatus = async (req, res) => {
  try {
    const { staffId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    if (!staffId) {
      return res.status(400).json({
        success: false,
        message: "Staff ID is required in the URL parameter.",
      });
    }

    // Find the employee based on the staffId, schoolId, and session
    const employee = await EmployeeModel.findOne({ staffId, schoolId, session });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found or does not belong to this school and session.",
      });
    }

    // Toggle the employee's status between 'active' and 'deactivated'
    const newStatus = employee.status === "active" ? "deactivated" : "active";

    // Update the employee's status
    const updatedEmployee = await EmployeeModel.findOneAndUpdate(
      { staffId, schoolId, session },
      {
        $set: {
          status: newStatus,
          updatedBy,
          updatedAt: new Date(),
        },
      },
      { new: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      message: `Employee status updated to ${newStatus}`,
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error("Error in toggleEmployeeStatus:", error);
    res.status(500).json({
      success: false,
      message: "Employee status toggle failed due to error",
      error: error.message,
    });
  }
};


// CLASS CONTROLLERS FOR THE SCHOOL

// Create a new class
exports.createClass = async (req, res) => {
  try {
    let { className, sections, subjects } = req.body;

    sections = sections ? sections.split(",").map((s) => s.trim()) : [];
    subjects = subjects ? subjects.split(",").map((s) => s.trim()) : [];

    const classId = uuidv4();

    const existClass = await classModel.findOne({
      schoolId: req.user.schoolId,
      className,
      session: req.user.session,
    });

    if (existClass) {
      return res.status(400).json({
        success: false,
        message: "This class already exists for this session.",
      });
    }

    const newClass = await classModel.create({
      classId,
      schoolId: req.user.schoolId,
      session: req.user.session,
      className,
      sections,
      subjects,
    });

    res.status(201).json({
      success: true,
      message: "Class created successfully",
      class: newClass,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating class",
      error: error.message,
    });
  }
};

// Get all classes for the logged-in session
exports.getAllClasses = async (req, res) => {
  try {
    const classes = await classModel.find({
      schoolId: req.user.schoolId,
      session: req.user.session,
    });

    res.status(200).json({
      success: true,
      message: "Class list fetched successfully",
      classes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching class list",
      error: error.message,
    });
  }
};

// Get a class by classId
exports.getClassById = async (req, res) => {
  try {
    const { classId } = req.params;
    const classItem = await classModel.findOne({
      classId,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });

    if (!classItem) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Class fetched successfully",
      class: classItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching class",
      error: error.message,
    });
  }
};

// Update a class
// Update a class
exports.updateClass = async (req, res) => {
  try {
    const { classId } = req.params; // Get classId from URL params
    let { className, sections, subjects } = req.body;

    sections = sections ? sections.split(",").map((s) => s.trim()) : [];
    subjects = subjects ? subjects.split(",").map((s) => s.trim()) : [];

    const classToUpdate = await classModel.findOne({
      classId,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });

    if (!classToUpdate) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Update class fields
    if (className) classToUpdate.className = className;
    if (sections.length > 0) classToUpdate.sections = sections;
    if (subjects.length > 0) classToUpdate.subjects = subjects;

    const updatedClass = await classToUpdate.save();

    res.status(200).json({
      success: true,
      message: "Class updated successfully",
      class: updatedClass,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating class",
      error: error.message,
    });
  }
};

// Delete a class
exports.deleteClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const classToDelete = await classModel.findOneAndDelete({
      classId,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });

    if (!classToDelete) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Class deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting class",
      error: error.message,
    });
  }
};

// END OF CLASS CONTROLLER

exports.getAllStudentStatus = async (req, res) => {
  try {
    const { email } = req.query;

    console.log("here", req.query);

    const filter = {
      ...(email ? { email: email } : {}),
      ...req.sessionFilter,
    };

    const allStudent = await NewStudentModel.find({
      schoolId: req.user.schoolId,
      // studentStatus: "active",
      ...filter,
    });

    res.status(200).json({
      success: true,
      message: "List of all students",
      allStudent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "All Student list is not found due to error",
      error: error.message,
    });
  }
};

exports.createNotice = async (req, res) => {
  try {
    // Debug logs to help troubleshoot
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);
    console.log("Request files:", req.files);
    
    const { title, content, class: className, section, role } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    
    // Check for file in both req.file (single file) and req.files (multiple files)
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    
    // Validate title and content
    if (!title || title.trim() === '' || !content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Title and content are required.",
      });
    }

    const existNotice = await NoticeModel.findOne({ schoolId, session, title });
    if (existNotice) {
      return res.status(400).json({
        success: false,
        message: "Notice with this title already exists.",
      });
    }

    let noticeFile;
    if (file) {
      console.log("Processing file:", file.mimetype, file.originalname);
      try {
        const fileDataUri = getDataUri(file);
        noticeFile = await cloudinary.v2.uploader.upload(fileDataUri.content, {
          resource_type: "auto", // Important for PDFs - allows any file type
          folder: "notices",
        });
        console.log("File uploaded successfully:", noticeFile.public_id);
      } catch (uploadError) {
        console.error("File upload error:", uploadError);
        return res.status(400).json({
          success: false,
          message: "File upload failed",
          error: uploadError.message,
        });
      }
    } else {
      console.log("No file was provided with the request");
    }

    const notice = new NoticeModel({
      schoolId,
      session,
      title,
      content,
      class: className,
      section,
      role,
      updatedBy,
      ...(noticeFile && {
        file: { public_id: noticeFile.public_id, url: noticeFile.secure_url },
      }),
    });

    await notice.save();

    res.status(201).json({
      success: true,
      message: "Notice created successfully",
      notice,
    });
  } catch (error) {
    console.error("Error in createNotice:", error);
    res.status(500).json({
      success: false,
      message: "Notice not created due to error",
      error: error.message,
    });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const { noticeId, title, class: className, section, role } = req.query;

    const query = { schoolId, session };
    if (noticeId) query.noticeId = noticeId;
    if (title) query.title = { $regex: title, $options: "i" };
    if (className) query.class = className;
    if (section) query.section = section;
    if (role) query.role = role;

    const notices = await NoticeModel.find(query).lean();

    if (notices.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No notices found matching the criteria.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notices fetched successfully",
      notices,
    });
  } catch (error) {
    console.error("Error in getNotices:", error);
    res.status(500).json({
      success: false,
      message: "Notices not fetched due to error",
      error: error.message,
    });
  }
};

exports.updateNotice = async (req, res) => {
  try {
    const { noticeId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    const updateData = req.body;
    const file = req.file;

    let noticeFile;
    if (file) {
      const fileDataUri = getDataUri(file);
      noticeFile = await cloudinary.v2.uploader.upload(fileDataUri.content);
      updateData.file = { public_id: noticeFile.public_id, url: noticeFile.secure_url };
    }

    const notice = await NoticeModel.findOneAndUpdate(
      { noticeId, schoolId, session },
      { $set: { ...updateData, updatedBy, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notice updated successfully",
      notice,
    });
  } catch (error) {
    console.error("Error in updateNotice:", error);
    res.status(500).json({
      success: false,
      message: "Notice not updated due to error",
      error: error.message,
    });
  }
};

exports.deleteNotice = async (req, res) => {
  try {
    const { noticeId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    const notice = await NoticeModel.findOneAndDelete({ noticeId, schoolId, session });
    if (!notice) {
      return res.status(404).json({
        success: false,
        message: "Notice not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notice deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteNotice:", error);
    res.status(500).json({
      success: false,
      message: "Notice not deleted due to error",
      error: error.message,
    });
  }
};





exports.promotionOfStudent = async (req, res) => {
  try {
    const { students, promotedClass, promotedSection } = req.body;
    console.log("students", students, promotedClass, promotedSection);
    if (!students || !promotedClass || !promotedSection) {
      return res.status(400).json({
        success: false,
        message: "Missing Parameters",
      });
    }

    for (const student of students) {
      const updatedStudent = await NewStudentModel.findByIdAndUpdate(
        student,
        {
          class: promotedClass,
          section: promotedSection,
        },
        { new: true }
      );

      if (!updatedStudent) {
        return res.status(404).json({
          success: false,
          message: `Student Id ${student._id} is not found`,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Selected Student is Promoted Successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Promotion Of Student not done successfully",
      error: error.message,
    });
  }
};

exports.createCurriculum = async (req, res) => {
  try {
    const { className, academicYear } = req.body;
    const file = req.file;
    const fileDataUri = getDataUri(file);

    const existCurriculum = await CurriculumModel.findOne({
      className: className,
      academicYear: academicYear,
    });

    if (existCurriculum) {
      return res.status(400).json({
        success: false,
        message: "Curriculum of that Class is already exist",
      });
    }

    const curriculumFile = await cloudinary.v2.uploader.upload(
      fileDataUri.content
    );

    const curriculum = await CurriculumModel.create({
      schoolId: req.user.schoolId,
      className,
      academicYear,
      file: {
        public_id: curriculumFile.public_id,
        url: curriculumFile.secure_url,
      },
    });

    res.status(201).json({
      success: true,
      message: "Curriculum of That Class is successfully created",
      curriculum,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Curriculum of that class is not created due to error",
      error: error.message,
    });
  }
};

exports.deleteCurriculum = async (req, res) => {
  try {
    const { curriculumId } = req.params;

    const existCurriculum = await CurriculumModel.findById(curriculumId);

    if (!existCurriculum) {
      return res.status(400).json({
        success: false,
        message: "Curriculum of that class does not exist",
      });
    }

    const deletedCurriculum = await existCurriculum.deleteOne();

    res.status(200).json({
      success: true,
      message: "Curriculum of that class deleted successfully",
      deletedCurriculum,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Curriculum of that class is not deleted due to error",
      error: error.message,
    });
  }
};

exports.updateCurriculum = async (req, res) => {
  try {
    const { curriculumId } = req.params;
    const { ...curriculumFields } = req.body;
    const file = req.file;

    const existCurriculum = await CurriculumModel.findById(curriculumId);

    if (!existCurriculum) {
      return res.status(404).json({
        success: false,
        message: "Curriculum of that Class does not exist",
      });
    }

    if (file) {
      const fileDataUri = getDataUri(file);

      const curriculumFile = await cloudinary.v2.uploader.upload(
        fileDataUri.content
      );

      existCurriculum.file = {
        public_id: curriculumFile.public_id,
        url: curriculumFile.secure_url,
      };
    }

    for (let key in curriculumFields) {
      existCurriculum[key] = curriculumFields[key];
    }

    const updatedCurriculum = await existCurriculum.save();

    res.status(200).json({
      success: true,
      message: "Curriculum of that class is updated successfully",
      updatedCurriculum,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Curriculum of that class is not updated due to Error",
      error: error.message,
    });
  }
};

exports.getAllCurriculum = async (req, res) => {
  try {
    const { curriculumId, className } = req.query;

    const filter = {
      ...(curriculumId ? { _id: curriculumId } : {}),
      ...(className ? { className: className } : {}),
      ...req.sessionFilter,
    };

    const allCurriculum = await CurriculumModel.find({
      ...filter,
      schoolId: req.user.schoolId,
    });

    res.status(200).json({
      success: true,
      message: "Curriculum of that class is fetch is successfully",
      allCurriculum,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Curriculum of that class is not get due to error",
      error: error.message,
    });
  }
};




exports.createSyllabus = async (req, res) => {
  try {
    const { className, academicYear } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    // Support both single and multiple file uploads
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "File is required.",
      });
    }

    console.log("Processing file:", file.mimetype, file.originalname);

    let syllabusFile;
    try {
      const fileDataUri = getDataUri(file);
      syllabusFile = await cloudinary.v2.uploader.upload(fileDataUri.content, {
        resource_type: "auto", // ensures support for PDFs and other file types
        folder: "syllabi",      // adjust folder name if needed
      });
      console.log("File uploaded successfully:", syllabusFile.public_id);
    } catch (uploadError) {
      console.error("File upload error:", uploadError);
      return res.status(400).json({
        success: false,
        message: "File upload failed",
        error: uploadError.message,
      });
    }

    const existSyllabus = await Curriculum.findOne({ schoolId, session, className, academicYear });
    if (existSyllabus) {
      return res.status(400).json({
        success: false,
        message: "Syllabus for this class and academic year already exists.",
      });
    }

    const syllabus = new Curriculum({
      schoolId,
      session,
      className,
      academicYear,
      updatedBy,
      file: { public_id: syllabusFile.public_id, url: syllabusFile.secure_url },
    });

    await syllabus.save();

    res.status(201).json({
      success: true,
      message: "Syllabus created successfully",
      syllabus,
    });
  } catch (error) {
    console.error("Error in createSyllabus:", error);
    res.status(500).json({
      success: false,
      message: "Syllabus not created due to error",
      error: error.message,
    });
  }
};


exports.getSyllabuses = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const { syllabusId, className, academicYear } = req.query;

    const query = { schoolId, session };
    if (syllabusId) query.syllabusId = syllabusId;
    if (className) query.className = className;
    if (academicYear) query.academicYear = academicYear;

    const syllabuses = await Curriculum.find(query).lean();

    if (syllabuses.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No syllabuses found matching the criteria.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Syllabuses fetched successfully",
      syllabuses,
    });
  } catch (error) {
    console.error("Error in getSyllabuses:", error);
    res.status(500).json({
      success: false,
      message: "Syllabuses not fetched due to error",
      error: error.message,
    });
  }
};

exports.updateSyllabus = async (req, res) => {
  try {
    const { syllabusId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    const updateData = req.body;
    // Support both single and multiple file uploads
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    if (file) {
      console.log("Processing file:", file.mimetype, file.originalname);
      try {
        const fileDataUri = getDataUri(file);
        const syllabusFile = await cloudinary.v2.uploader.upload(fileDataUri.content, {
          resource_type: "auto",
          folder: "syllabi",
        });
        updateData.file = { public_id: syllabusFile.public_id, url: syllabusFile.secure_url };
      } catch (uploadError) {
        console.error("File upload error:", uploadError);
        return res.status(400).json({
          success: false,
          message: "File upload failed",
          error: uploadError.message,
        });
      }
    }

    const syllabus = await Curriculum.findOneAndUpdate(
      { syllabusId: syllabusId, schoolId, session },
      { $set: { ...updateData, updatedBy, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: "Syllabus not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Syllabus updated successfully",
      syllabus,
    });
  } catch (error) {
    console.error("Error in updateSyllabus:", error);
    res.status(500).json({
      success: false,
      message: "Syllabus not updated due to error",
      error: error.message,
    });
  }
};


exports.deleteSyllabus = async (req, res) => {
  try {
    const { syllabusId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    const syllabus = await Curriculum.findOneAndDelete({ syllabusId, schoolId, session });
    if (!syllabus) {
      return res.status(404).json({
        success: false,
        message: "Syllabus not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Syllabus deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteSyllabus:", error);
    res.status(500).json({
      success: false,
      message: "Syllabus not deleted due to error",
      error: error.message,
    });
  }
};




exports.createTask = async (req, res) => {
  try {
    const { className, section, title, description, dueDate, subject } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    // Support both single and multiple file uploads
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "File is required.",
      });
    }

    console.log("Processing file:", file.mimetype, file.originalname);
    let taskFile;
    try {
      const fileDataUri = getDataUri(file);
      taskFile = await cloudinary.v2.uploader.upload(fileDataUri.content, {
        resource_type: "auto",
        folder: "tasks", // adjust folder name if needed
      });
      console.log("File uploaded successfully:", taskFile.public_id);
    } catch (uploadError) {
      console.error("File upload error:", uploadError);
      return res.status(400).json({
        success: false,
        message: "File upload failed",
        error: uploadError.message,
      });
    }

    const existTask = await Assignment.findOne({ schoolId, session, className, section, title });
    if (existTask) {
      return res.status(400).json({
        success: false,
        message: "Task with this title for this class and section already exists.",
      });
    }

    const task = new Assignment({
      schoolId,
      session,
      className,
      section,
      title,
      description,
      dueDate,
      subject,
      updatedBy,
      file: { public_id: taskFile.public_id, url: taskFile.secure_url },
    });

    await task.save();

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("Error in createTask:", error);
    res.status(500).json({
      success: false,
      message: "Task not created due to error",
      error: error.message,
    });
  }
};


exports.getTasks = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const { taskId, className, section, subject, dueDate } = req.query;

    const query = { schoolId, session };
    if (taskId) query.taskId = taskId;
    if (className) query.className = className;
    if (section) query.section = section;
    if (subject) query.subject = { $regex: subject, $options: "i" };
    if (dueDate) query.dueDate = { $gte: new Date(dueDate) };

    const tasks = await Assignment.find(query).lean();

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No tasks found matching the criteria.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Tasks fetched successfully",
      tasks,
    });
  } catch (error) {
    console.error("Error in getTasks:", error);
    res.status(500).json({
      success: false,
      message: "Tasks not fetched due to error",
      error: error.message,
    });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    const updateData = req.body;
    // Support both single and multiple file uploads
    const file = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    if (file) {
      console.log("Processing file:", file.mimetype, file.originalname);
      try {
        const fileDataUri = getDataUri(file);
        const taskFile = await cloudinary.v2.uploader.upload(fileDataUri.content, {
          resource_type: "auto",
          folder: "tasks",
        });
        updateData.file = { public_id: taskFile.public_id, url: taskFile.secure_url };
      } catch (uploadError) {
        console.error("File upload error:", uploadError);
        return res.status(400).json({
          success: false,
          message: "File upload failed",
          error: uploadError.message,
        });
      }
    }

    const task = await Assignment.findOneAndUpdate(
      { taskId: taskId, schoolId, session },
      { $set: { ...updateData, updatedBy, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("Error in updateTask:", error);
    res.status(500).json({
      success: false,
      message: "Task not updated due to error",
      error: error.message,
    });
  }
};


exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    const task = await Assignment.findOneAndDelete({ taskId, schoolId, session });
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteTask:", error);
    res.status(500).json({
      success: false,
      message: "Task not deleted due to error",
      error: error.message,
    });
  }
};




exports.createAssignment = async (req, res) => {
  try {
    const { className, section, title, description, dueDate, subject } =
      req.body;
    const file = req.file;

    console.log("P2 file", req.file);
    console.log("P2 req.body", req.body);

    const fileDataUri = getDataUri(file);

    const existAssignment = await AssignmentModel.findOne({
      className: className,
      section: section,
      title: title,
    });

    if (existAssignment) {
      return res.status(400).json({
        success: false,
        message: "Assignment of that Class is already exist",
      });
    }

    const assignmentFile = await cloudinary.v2.uploader.upload(
      fileDataUri.content
    );

    const assignment = await AssignmentModel.create({
      schoolId: req.user.schoolId,
      className,
      section,
      title,
      description,
      dueDate,
      subject,
      file: {
        public_id: assignmentFile.public_id,
        url: assignmentFile.secure_url,
      },
    });

    res.status(201).json({
      success: true,
      message: "Assignment of That Class is successfully created",
      assignment,
    });
  } catch (error) {
    console.error("Error occurred at--->>>>>>:", error.stack);
    console.log("AJAYARJ---", error);
    res.status(500).json({
      success: false,
      message: "Assignment of that class is not created due to error",
      error: error.message,
    });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const existAssignment = await AssignmentModel.findById(assignmentId);

    if (!existAssignment) {
      return res.status(400).json({
        success: false,
        message: "Assignment of that class does not exist",
      });
    }

    const deletedAssignment = await existAssignment.deleteOne();

    res.status(200).json({
      success: true,
      message: "Assignment of that class deleted successfully",
      deletedAssignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Assignment of that class is not deleted due to error",
      error: error.message,
    });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { ...assignmentFields } = req.body;
    const file = req.file;

    const existAssignment = await AssignmentModel.findById(assignmentId);

    if (!existAssignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment of that Class does not exist",
      });
    }

    if (file) {
      const fileDataUri = getDataUri(file);

      const assignmentFile = await cloudinary.v2.uploader.upload(
        fileDataUri.content
      );

      // const mycloud = await cloudinary.uploader.upload(fileUri.content);

      existAssignment.file = {
        public_id: assignmentFile.public_id,
        url: assignmentFile.secure_url,
      };
    }

    for (let key in assignmentFields) {
      existAssignment[key] = assignmentFields[key];
    }

    const updatedAssignment = await existAssignment.save();

    res.status(200).json({
      success: true,
      message: "Assignment of that class is updated successfully",
      updatedAssignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Assignement of that class is not updated due to Error",
      error: error.message,
    });
  }
};

exports.getAllAssignment = async (req, res) => {
  try {
    const { assignmentId, className, section } = req.query;

    const filter = {
      ...(assignmentId ? { _id: assignmentId } : {}),
      ...(className ? { className: className } : {}),
      ...(section ? { section: section } : {}),
      ...req.sessionFilter,
    };

    const allAssignment = await AssignmentModel.find({
      ...filter,
      schoolId: req.user.schoolId,
    });

    res.status(200).json({
      success: true,
      message: "Assignment of that class is fetch is successfully",
      allAssignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Assignment of that class is not get due to error",
      error: error.message,
    });
  }
};

exports.issueBook = async (req, res) => {
  try {
    const { studentId, bookId } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!studentId || !bookId) {
      return res.status(400).json({
        success: false,
        message: "Student ID and Book ID are required.",
      });
    }

    const book = await BookModel.findOne({ bookId, schoolId, session });
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found or does not belong to this school and session.",
      });
    }

    const student = await NewStudentModel.findOne({ studentId, schoolId, session });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found or does not belong to this school and session.",
      });
    }

    const issuedData = await IssueBook.findOne({
      schoolId,
      session,
      bookId,
      studentId,
      status: "issued",
    });

    if (issuedData) {
      return res.status(400).json({
        success: false,
        message: "This book is already issued to this student.",
      });
    }

    if (book.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Book is out of stock.",
      });
    }

    const issueBookData = new IssueBook({
      schoolId,
      session,
      studentId,
      bookId,
      bookName: book.bookName,
      updatedBy,
    });

    await issueBookData.save();

    book.quantity -= 1;
    await book.save();

    res.status(201).json({
      success: true,
      message: "Book issued successfully",
      issueBookData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Book was not issued due to error",
      error: error.message,
    });
  }
};

exports.returnBook = async (req, res) => {
  try {
    const { issueId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!issueId) {
      return res.status(400).json({
        success: false,
        message: "Issue ID is required in the URL parameter.",
      });
    }

    const issueRecord = await IssueBook.findOne({ issueId, schoolId, session });
    if (!issueRecord) {
      return res.status(404).json({
        success: false,
        message: "Issue record not found or does not belong to this school and session.",
      });
    }

    if (issueRecord.status === "returned") {
      return res.status(400).json({
        success: false,
        message: "Book has already been returned.",
      });
    }

    issueRecord.status = "returned";
    issueRecord.returnDate = new Date();
    issueRecord.updatedBy = updatedBy;
    issueRecord.updatedAt = new Date();
    await issueRecord.save();

    const book = await BookModel.findOne({ bookId: issueRecord.bookId, schoolId, session });
    if (book) {
      book.quantity += 1;
      await book.save();
    }

    res.status(200).json({
      success: true,
      message: "Book returned successfully",
      issueRecord,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Book not returned due to error",
      error: error.message,
    });
  }
};

exports.getAllIssueBookToMe = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(400).json({
        success: false,
        message: "You are not Student",
      });
    }

    const listOfBook = await issueBookModel.find({
      schoolId: req.user.schoolId,
      studentId: req.user._id,
      status: "issued",
    });

    res.status(200).json({
      success: true,
      message: "List of Books issued is successfully fetched",
      listOfBook,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Not Fetch of list of issue book",
      error: error.message,
    });
  }
};

exports.getAllIssuedBookStudent = async (req, res) => {
  try {
    const { bookId } = req.query;

    const filter = {
      ...(bookId ? { bookId: bookId } : {}),
      ...req.sessionFilter,
    };

    const allStudent = await issueBookModel.find({
      status: "issued",
      schoolID: req.user.schoolID,
      ...filter,
    });

    res.status(200).json({
      success: true,
      message: "Issued Book Student data is successfully fetch",
      allStudent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Issued Book Student data is not get due to error",
      error: error.message,
    });
  }
};



exports.getMyKids = async (req, res) => {
  try {
    if (req.user.role !== "parent") {
      return res.status(400).json({
        success: false,
        message: "You are not Parent",
      });
    }

    const kids = await NewStudentModel.find({ parentId: req.user._id });

    res.status(200).json({
      success: true,
      message: "Kids details is successfully get",
      data: kids,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Kid Details is not get due to error",
      error: error.message,
    });
  }
};

// In your admin controller
exports.getAdminBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    // Convert slug back to schoolName (e.g., "balvaishali" -> "Bal Vaishali")
    const schoolName = slug
      .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())
      .replace(/-/g, " ");

    const admin = await Admin.findOne({ schoolName });
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }
    res.status(200).json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// API CONTROLLERS FOR THE ADMIN
exports.createAdminExam = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can create exams.",
      });
    }

    const { name, examType, className, section, subjects, startDate, endDate, resultPublishDate, gradeSystem } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const createdBy = req.user._id;
    const updatedBy = req.user._id;

    const examData = {
      schoolId,
      session,
      createdBy,
      name,
      examType,
      className,
      section,
      subjects,
      startDate,
      endDate,
      resultPublishDate,
      gradeSystem,
      updatedBy,
    };

    const existingExam = await Exam.findOne({
      schoolId,
      session,
      className,
      section,
      examType,
      startDate,
      endDate,
    });

    if (existingExam) {
      return res.status(400).json({
        success: false,
        message: "An exam with these details already exists.",
      });
    }

    const exam = new Exam(examData);
    await exam.save();

    res.status(201).json({
      success: true,
      message: "Exam created successfully",
      exam,
    });
  } catch (error) {
    console.error("Error in createAdminExam:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create exam",
      error: error.message,
    });
  }
};

exports.getAdminExams = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can access exams.",
      });
    }

    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const { examId, className, section, examType, startDate } = req.query;

    const query = { schoolId, session };
    if (examId) query.examId = examId;
    if (className) query.className = className;
    if (section) query.section = section;
    if (examType) query.examType = examType;
    if (startDate) query.startDate = { $gte: new Date(startDate) };

    const exams = await Exam.find(query).sort({ startDate: -1 }).lean();

    if (exams.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No exams found for the given criteria",
        exams: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Exams retrieved successfully",
      exams,
    });
  } catch (error) {
    console.error("Error in getAdminExams:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve exams",
      error: error.message,
    });
  }
};

exports.updateAdminExam = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can update exams.",
      });
    }

    const { examId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    const updateData = req.body;

    const exam = await Exam.findOneAndUpdate(
      { examId, schoolId, session },
      { $set: { ...updateData, updatedBy, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Exam updated successfully",
      exam,
    });
  } catch (error) {
    console.error("Error in updateAdminExam:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update exam",
      error: error.message,
    });
  }
};

exports.deleteAdminExam = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can delete exams.",
      });
    }

    const { examId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    const exam = await Exam.findOneAndDelete({ examId, schoolId, session });
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Exam deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteAdminExam:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete exam",
      error: error.message,
    });
  }
};

// GET SINGLE EXAM FOR ADMIN
exports.getAdminExamById = async (req, res) => {
  try {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const exam = await Exam.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Exam retrieved successfully",
      exam,
    });
  } catch (error) {
    console.error("Error in getAdminExamById:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve exam",
      error: error.message,
    });
  }
};

// Add these admin controllers to your markController.js file

// ADMIN ADD MARK
exports.addAdminMark = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const { studentId, examId, marks, coScholasticMarks } = req.body;

    // Verify the exam exists and belongs to the school
    const exam = await Exam.findOne({
      _id: examId,
      schoolId: req.user.schoolId,
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found or access denied",
      });
    }

    let studentMark = await Mark.findOne({
      studentId,
      examId,
      schoolId: req.user.schoolId,
    });

    if (studentMark) {
      // Update existing marks with validation
      marks.forEach((newSubjectMark) => {
        const examSubject = exam.subjects.find(
          (s) => s.name === newSubjectMark.subjectName
        );
        if (!examSubject) {
          throw new Error(
            `Subject ${newSubjectMark.subjectName} not found in exam configuration`
          );
        }
        if (newSubjectMark.marks > examSubject.totalMarks) {
          throw new Error(
            `Marks cannot exceed total marks for ${newSubjectMark.subjectName}`
          );
        }

        const existingSubjectIndex = studentMark.marks.findIndex(
          (m) => m.subjectName === newSubjectMark.subjectName
        );

        if (existingSubjectIndex !== -1) {
          studentMark.marks[existingSubjectIndex] = newSubjectMark;
        } else {
          studentMark.marks.push(newSubjectMark);
        }
      });

      if (coScholasticMarks?.length > 0) {
        studentMark.coScholasticMarks = coScholasticMarks;
      }
    } else {
      // Create new student mark
      studentMark = new Mark({
        studentId,
        examId,
        schoolId: req.user.schoolId,
        className: exam.className, // Get from exam instead of user
        section: exam.section, // Get from exam instead of user
        marks,
        coScholasticMarks: coScholasticMarks || [],
      });
    }

    await studentMark.save();
    res.status(201).json({
      success: true,
      message: "Mark added successfully",
      mark: studentMark,
    });
  } catch (error) {
    console.error("Error in addAdminMark:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ADMIN GET MARKS
exports.getAdminMarks = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can access marks.",
      });
    }

    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const { marksId, examId, studentId, className, section } = req.query;

    const query = { schoolId, session };
    if (marksId) query.marksId = marksId;
    if (examId) query.examId = examId;
    if (studentId) query.studentId = studentId;
    if (className) query.className = className;
    if (section) query.section = section;

    const marks = await Mark.find(query).lean();

    if (marks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No marks found matching the criteria.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Marks retrieved successfully",
      marks,
    });
  } catch (error) {
    console.error("Error in getAdminMarks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve marks",
      error: error.message,
    });
  }
};

// ADMIN UPDATE MARK
exports.updateAdminMark = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can update marks.",
      });
    }

    const { marksId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updateData = req.body;

    const mark = await Mark.findOneAndUpdate(
      { marksId, schoolId, session },
      { $set: { ...updateData, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!mark) {
      return res.status(404).json({
        success: false,
        message: "Mark record not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Mark record updated successfully",
      mark,
    });
  } catch (error) {
    console.error("Error in updateAdminMark:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update mark",
      error: error.message,
    });
  }
};

exports.deleteAdminMark = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can delete marks.",
      });
    }

    const { marksId } = req.params;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    const mark = await Mark.findOneAndDelete({ marksId, schoolId, session });
    if (!mark) {
      return res.status(404).json({
        success: false,
        message: "Mark record not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Mark record deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteAdminMark:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete mark",
      error: error.message,
    });
  }
};

// ADMIN GET STUDENT MARKS
exports.getAdminStudentMarks = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const studentId = req.params.studentId;
    const marks = await Mark.find({
      studentId,
      schoolId: req.user.schoolId,
    }).populate("examId", "name examType startDate endDate");

    if (!marks.length) {
      return res.status(404).json({
        success: false,
        message: "No marks found for this student",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student marks retrieved successfully",
      count: marks.length,
      marks,
    });
  } catch (error) {
    console.error("Error in getAdminStudentMarks:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ADMIN GET EXAM MARKS
exports.getAdminExamMarks = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const examId = req.params.examId;
    const marks = await Mark.find({
      examId,
      schoolId: req.user.schoolId,
    }).populate("studentId", "name rollNo");

    if (!marks.length) {
      return res.status(404).json({
        success: false,
        message: "No marks found for this exam",
      });
    }

    res.status(200).json({
      success: true,
      message: "Exam marks retrieved successfully",
      count: marks.length,
      marks,
    });
  } catch (error) {
    console.error("Error in getAdminExamMarks:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ADMIN GET CLASS PERFORMANCE
exports.getAdminClassPerformance = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const { className, section } = req.query;
    const query = { schoolId: req.user.schoolId };

    if (className) query.className = className;
    if (section) query.section = section;

    const marks = await Mark.find(query).populate("examId", "name examType");

    const performance = {
      totalStudents: marks.length,
      classAverage:
        marks.reduce((acc, curr) => acc + curr.percentage, 0) / marks.length ||
        0,
      passPercentage: marks.length
        ? (marks.filter((m) => m.isPassed).length / marks.length) * 100
        : 0,
      gradeDistribution: {
        "A+": marks.filter((m) => m.grade === "A+").length,
        A: marks.filter((m) => m.grade === "A").length,
        B: marks.filter((m) => m.grade === "B").length,
        C: marks.filter((m) => m.grade === "C").length,
        D: marks.filter((m) => m.grade === "D").length,
        F: marks.filter((m) => m.grade === "F").length,
      },
      subjectWisePerformance: {},
    };

    marks.forEach((mark) => {
      mark.marks.forEach((subject) => {
        if (!performance.subjectWisePerformance[subject.subjectName]) {
          performance.subjectWisePerformance[subject.subjectName] = {
            totalMarks: 0,
            totalStudents: 0,
            passCount: 0,
          };
        }
        const subjectData =
          performance.subjectWisePerformance[subject.subjectName];
        subjectData.totalMarks += subject.marks;
        subjectData.totalStudents += 1;
        if (subject.isPassed) subjectData.passCount += 1;
      });
    });

    Object.keys(performance.subjectWisePerformance).forEach((subject) => {
      const data = performance.subjectWisePerformance[subject];
      data.average = data.totalMarks / data.totalStudents || 0;
      data.passPercentage = (data.passCount / data.totalStudents) * 100 || 0;
    });

    res.status(200).json({
      success: true,
      message: "Class performance retrieved successfully",
      performance,
    });
  } catch (error) {
    console.error("Error in getAdminClassPerformance:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ADMIN BULK UPLOAD MARKS
exports.bulkUploadAdminMarks = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only admins can upload marks.",
      });
    }

    const { examId, studentsMarks } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    const exam = await Exam.findOne({ examId, schoolId, session });
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    const results = [];
    const errors = [];

    for (const studentData of studentsMarks) {
      try {
        let mark = await Mark.findOne({
          examId,
          studentId: studentData.studentId,
          schoolId,
          session,
        });

        const validatedMarks = studentData.marks.map((m) => {
          const examSubject = exam.subjects.find((s) => s.name === m.subjectName);
          if (!examSubject) throw new Error(`Subject ${m.subjectName} not found in exam.`);
          if (m.marks > examSubject.totalMarks) throw new Error(`Marks exceed total for ${m.subjectName}.`);
          return {
            subjectName: m.subjectName,
            marks: m.marks,
            totalMarks: examSubject.totalMarks,
            passingMarks: examSubject.passingMarks,
            isPassed: m.marks >= examSubject.passingMarks,
          };
        });

        if (mark) {
          mark.marks = validatedMarks;
          mark.coScholasticMarks = studentData.coScholasticMarks || [];
        } else {
          mark = new Mark({
            schoolId,
            session,
            examId,
            studentId: studentData.studentId,
            className: exam.className,
            section: exam.section,
            marks: validatedMarks,
            coScholasticMarks: studentData.coScholasticMarks || [],
          });
        }

        await mark.save();
        results.push(mark);
      } catch (error) {
        errors.push({ studentId: studentData.studentId, error: error.message });
      }
    }

    res.status(201).json({
      success: true,
      message: `Processed marks for ${results.length} students`,
      failedCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in bulkUploadAdminMarks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload marks",
      error: error.message,
    });
  }
};
