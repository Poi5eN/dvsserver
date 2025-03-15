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
const CurriculumModel = require("../models/curriculumModel");
const AssignmentModel = require("../models/assignmentModel");
const issueBookModel = require("../models/issueBookModel");
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
    const { admissionNumber, feeType, amount, name, className } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    // Validation
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID is required from authenticated admin.",
      });
    }
    if (!admissionNumber) {
      return res.status(400).json({
        success: false,
        message: "Admission number is required for student-specific fees.",
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
    if (!className) {
      return res.status(400).json({
        success: false,
        message: "Class name is required to associate with the student.",
      });
    }

    // Check if the student exists
    const student = await NewStudentModel.findOne({
      admissionNumber,
      schoolId,
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student with admission number ${admissionNumber} not found in this school.`,
      });
    }

    // Check for an existing student-specific fee
    const feesExist = await FeeStructure.findOne({
      schoolId,
      admissionNumber,
      feeType,
      additional: !!name, // if 'name' is provided, treat it as additional
      ...(name ? { name } : {}),
      session,
    });

    if (feesExist) {
      return res.status(400).json({
        success: false,
        message: `Student-specific fee for ${feeType}${name ? ` (${name})` : ""} already exists for this student.`,
      });
    }

    // Create the student-specific fee structure with feeStructureId and session
    const feeStructure = new FeeStructure({
      feeStructureId: uuidv4(),
      schoolId,
      session,
      className: student.class, // Use student's class
      name: name || undefined,
      feeType,
      amount,
      additional: !!name,
      admissionNumber,
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
    const { className, feeType, amount } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    // Check if a regular fee already exists for this class and fee type
    const feesExist = await FeeStructure.findOne({
      schoolId,
      className,
      feeType,
      additional: false,
      session,
    });

    if (feesExist) {
      return res.status(400).json({
        success: false,
        message: "Regular fee already exists for this class and fee type",
      });
    }

    const feeStructure = new FeeStructure({
      feeStructureId: uuidv4(),
      schoolId,
      session,
      className,
      feeType,
      amount,
      additional: false,
    });

    await feeStructure.save();

    return res.status(201).json({
      success: true,
      message: "Fee structure created successfully",
      data: feeStructure,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Create an additional fee structure for a class
exports.createAdditionalFee = async (req, res) => {
  try {
    const { className, name, feeType, amount } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    // Check if an additional fee already exists for this class, fee type, and name
    const feesExist = await FeeStructure.findOne({
      schoolId,
      className,
      name,
      feeType,
      additional: true,
      session,
    });

    if (feesExist) {
      return res.status(400).json({
        success: false,
        message:
          "Additional fee already exists for this class, fee type, and name",
      });
    }

    const feeStructure = new FeeStructure({
      feeStructureId: uuidv4(),
      schoolId,
      session,
      className,
      name,
      feeType,
      amount,
      additional: true,
    });

    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: "Additional fee structure created successfully",
      data: feeStructure,
    });
  } catch (error) {
    console.error("Error in createAdditionalFee:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get fee structures for all classes in a school (Regular Fees)
exports.getAllFeeStructures = async (req, res) => {
  try {
    // Using req.sessionFilter from the middleware, but we ensure session here as well
    const filter = {
      ...req.sessionFilter,
      schoolId: req.user.schoolId,
      additional: false,
    };

    const feeStructures = await FeeStructure.find(filter);
    res.status(200).json({
      success: true,
      data: feeStructures
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
    const sessionFilter = {
      ...req.sessionFilter,
      schoolId: req.user.schoolId,
      ...(className ? { className } : {}),
    };

    const regularFees = await FeeStructure.find({
      ...sessionFilter,
      additional: false,
    });

    const additionalFees = await FeeStructure.find({
      ...sessionFilter,
      additional: true,
    });

    const allFees = [...regularFees, ...additionalFees];

    res.status(200).json({
      success: true,
      data: allFees
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
    const session = req.user.session;

    // Find fee structure by feeStructureId, schoolId, and session
    const feeStructure = await FeeStructure.findOneAndUpdate(
      {
        feeStructureId,
        schoolId: req.user.schoolId,
        session,
      },
      req.body,
      { new: true }
    );

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: "Fee structure not found",
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
    const session = req.user.session;

    // Find fee structure by feeStructureId, schoolId, and session
    const feeStructure = await FeeStructure.findOne({
      feeStructureId,
      schoolId: req.user.schoolId,
      session,
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: "Fee structure not found",
      });
    }

    await FeeStructure.deleteOne({
      feeStructureId,
      schoolId: req.user.schoolId,
      session,
    });

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
    const filter = {
      ...req.sessionFilter,
      schoolId: req.user.schoolId,
      additional: true,
    };

    const feeStructures = await FeeStructure.find(filter);
    res.status(200).json({
      success: true,
      data: feeStructures
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// --------------------------------Book Controller

// Create a Book Details for a class

exports.createBookDetails = async (req, res) => {
  try {
    const { bookName, authorName, quantity, category, className, subject } =
      req.body;

    const existBook = await BookModel.find({
      schoolId: req.user.schoolID,
      bookName,
    });
    console.log("existBook", existBook);
    if (existBook.length < 0) {
      return res.status(400).json({
        success: false,
        message: "This book is already created",
      });
    }

    const bookDetails = new BookModel({
      schoolId: req.user.schoolId,
      bookName,
      authorName,
      quantity,
      category,
      className,
      subject,
    });
    await bookDetails.save();

    res.status(201).json({
      success: true,
      message: "Book Details created successfully",
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

// Delete Book
exports.deleteBook = async (req, res) => {
  try {
    const { bookId } = req.params;

    const bookData = await BookModel.findById({ _id: bookId });

    if (!bookData) {
      return res.status(200).json({
        success: true,
        Message: "Book Not Exits Please Check",
      });
    }

    await BookModel.deleteOne({ _id: bookId });

    res.status(200).json({
      success: true,
      Message: "Book delete successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Book details not deleted due to error",
      error: error.message,
    });
  }
};

// update Book
exports.updateBook = async (req, res) => {
  try {
    const { ...updateFields } = req.body;

    const { bookId } = req.params;

    const bookData = await BookModel.findById({ _id: bookId });

    if (!bookData) {
      return res.status(404).json({
        success: true,
        Message: "Book Details is not found",
      });
    }

    for (const key in updateFields) {
      bookData[key] = updateFields[key];
    }

    const updatedBookData = await bookData.save();

    res.status(201).json({
      success: true,
      message: "Book Details is updated",
      updatedBookData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Book details is not update due to error Please fix first",
      error: error.message,
    });
  }
};

// --------------------------------Inventory Item Controller

// Create a Item Details for a class
exports.createItemDetails = async (req, res) => {
  try {
    const { itemName, category, quantity, price } = req.body;
    // console.log(req.body)

    const ItemExist = await ItemModel.findOne({
      schoolId: req.user.schoolId,
      itemName,
      category,
    });

    if (ItemExist) {
      return res.status(400).json({
        success: false,
        message: "Item already exist",
      });
    }

    const data = await ItemModel.create({
      schoolId: req.user.schoolId,
      itemName,
      category,
      quantity,
      price,
    });

    res.status(201).json({
      success: true,
      message: "Item Details created successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Item Not created due to error",
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

// Delete Item
exports.deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    console.log("ItemId", itemId);
    const itemData = await ItemModel.findById({ _id: itemId });
    if (!itemData) {
      return res.status(200).json({
        success: false,
        Message: "Item Not Exits Please Check",
      });
    }

    await ItemModel.deleteOne({ _id: itemId });

    res.status(200).json({
      success: true,
      Message: "Item delete successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Item details not deleted due to error",
      error: error.message,
    });
  }
};

// update Item

exports.updateItem = async (req, res) => {
  try {
    const { ...updateFields } = req.body;
    const { itemId } = req.params;
    const itemData = await ItemModel.findById({ _id: itemId });

    if (!itemData) {
      return res.status(404).json({
        success: true,
        Message: "Item Details is not found",
      });
    }
    for (const key in updateFields) {
      itemData[key] = updateFields[key];
    }

    const updatedItemData = await itemData.save();
    res.status(201).json({
      success: true,
      message: "Item Details is updated",
      updatedItemData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Item details is not update due to error Please fix first",
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
    const createdBy = req.user._id;

    // Enhanced validation
    // if (!schoolId) return res.status(400).json({ success: false, message: "School ID is required." });
    // if (!createdBy) return res.status(400).json({ success: false, message: "User ID is required." });
    if (!studentFullName)
      return res
        .status(400)
        .json({ success: false, message: "Student full name is required." });
    // if (!guardianName) return res.status(400).json({ success: false, message: "Guardian name is required." });
    // if (!registerClass) return res.status(400).json({ success: false, message: "Class is required." });
    // if (!studentAddress) return res.status(400).json({ success: false, message: "Student address is required." });
    if (!mobileNumber)
      return res
        .status(400)
        .json({ success: false, message: "Mobile number is required." });
    // if (!studentEmail) return res.status(400).json({ success: false, message: "Student email is required." });
    // if (!gender) return res.status(400).json({ success: false, message: "Gender is required." });
    // if (!fatherName) return res.status(400).json({ success: false, message: "Father's name is required." });
    // if (!motherName) return res.status(400).json({ success: false, message: "Mother's name is required." });
    // if (!remarks) return res.status(400).json({ success: false, message: "Remarks are required." });
    // if (!transport) return res.status(400).json({ success: false, message: "Transport details are required." });

    // File uploads
    const files = req.files || [];
    const studentPhoto = files.find((f) => f.fieldname === "studentPhoto");
    const motherPhoto = files.find((f) => f.fieldname === "motherPhoto");
    const fatherPhoto = files.find((f) => f.fieldname === "fatherPhoto");
    const guardianPhoto = files.find((f) => f.fieldname === "guardianPhoto");

    // Check if registration exists
    const registrationExist = await NewRegistrationModel.findOne({
      studentEmail,
      schoolId,
    });
    if (registrationExist) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Already registered in this school with this email!",
        });
    }

    // Generate admissionNo if not provided or empty
    const finalAdmissionNo =
      admissionNo && admissionNo.trim() !== ""
        ? admissionNo
        : await generateAdmission(schoolId);

    // Generate unique registration number
    const registrationNumber = await generateRegistrationNumber(schoolId);

    // MinIO Uploads
    let studentPhotoResult = {},
      fatherPhotoResult = {},
      motherPhotoResult = {},
      guardianPhotoResult = {};
    if (studentPhoto) {
      const fileKey = `registrations/student/${Date.now()}-${
        studentPhoto.originalname
      }`;
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
      const fileKey = `registrations/father/${Date.now()}-${
        fatherPhoto.originalname
      }`;
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
      const fileKey = `registrations/mother/${Date.now()}-${
        motherPhoto.originalname
      }`;
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
      const fileKey = `registrations/guardian/${Date.now()}-${
        guardianPhoto.originalname
      }`;
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
      studentFullName,
      guardianName,
      registerClass,
      studentAddress,
      mobileNumber,
      studentEmail,
      gender,
      amount,
      // rollNo,
      admissionNo: finalAdmissionNo,
      fatherName,
      parentEmail,
      motherName,
      remarks,
      transport,
      registrationNumber,
      createdBy,
      approvalStatus: "approved",
      studentPhoto: studentPhotoResult.url ? studentPhotoResult : undefined,
      fatherPhoto: fatherPhotoResult.url ? fatherPhotoResult : undefined,
      motherPhoto: motherPhotoResult.url ? motherPhotoResult : undefined,
      guardianPhoto: guardianPhotoResult.url ? guardianPhotoResult : undefined,
    });

    // Fetch school details for email branding
    const schoolDetails = await AdminInfo.findOne({ schoolId }).select(
      "schoolName image.url"
    );
    const schoolName = schoolDetails?.schoolName || "Your School";
    const schoolImageUrl =
      schoolDetails?.image?.url ||
      "https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg"; // Fallback image
    const softwareLogoUrl =
      "https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png"; // Digital Vidya Saarthi logo URL

    // Log URLs for debugging
    console.log("School Image URL:", schoolImageUrl);
    console.log("Software Logo URL:", softwareLogoUrl);

    // Send confirmation email with the gorgeous design
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

    return res.status(201).json({
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

exports.createBulkRegistrations = async (req, res) => {
  try {
    const registrations = req.body.registrations;
    const schoolId = req.user.schoolId;
    const createdBy = req.user.userId;

    if (!registrations || !Array.isArray(registrations)) {
      return res.status(400).json({
        success: false,
        message: "Invalid data format. Expected an array of registrations.",
      });
    }
    if (!schoolId)
      return res
        .status(400)
        .json({ success: false, message: "School ID is required." });
    if (!createdBy)
      return res
        .status(400)
        .json({ success: false, message: "User ID is required." });

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
        rollNo,
        admissionNo,
        fatherName,
        motherName,
        remarks,
        transport,
      } = registration;

      try {
        // Validation
        if (!studentFullName) throw new Error("Student full name is required.");
        if (!guardianName) throw new Error("Guardian name is required.");
        if (!registerClass) throw new Error("Class is required.");
        if (!studentAddress) throw new Error("Student address is required.");
        if (!mobileNumber) throw new Error("Mobile number is required.");
        if (!studentEmail) throw new Error("Student email is required.");
        if (!gender) throw new Error("Gender is required.");
        if (!amount) throw new Error("Amount is required.");
        if (!rollNo) throw new Error("Roll number is required.");
        if (!admissionNo) throw new Error("Admission number is required.");
        if (!fatherName) throw new Error("Father's name is required.");
        if (!motherName) throw new Error("Mother's name is required.");
        if (!remarks) throw new Error("Remarks are required.");
        if (!transport) throw new Error("Transport details are required.");

        // Check existing registration
        const registrationExist = await NewRegistrationModel.findOne({
          mobileNumber,
          schoolId,
        });
        if (registrationExist) {
          throw new Error(
            `Already registered with mobile number: ${mobileNumber}`
          );
        }

        // Generate registration number
        const registrationNumber = await generateRegistrationNumber();

        // Note: Bulk typically doesn’t handle file uploads; assuming no photos for simplicity
        const registrationData = {
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
          admissionNo,
          fatherName,
          motherName,
          remarks,
          transport,
          registrationNumber,
          createdBy,
        };

        createdRegistrations.push(registrationData);
      } catch (error) {
        errors.push({
          mobileNumber: mobileNumber || "unknown",
          error: error.message,
        });
      }
    }

    if (createdRegistrations.length > 0) {
      await NewRegistrationModel.insertMany(createdRegistrations);
    }

    res.status(201).json({
      success: true,
      message: "Bulk registrations processed successfully.",
      createdRegistrations,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to process bulk registrations due to an error.",
      error: error.message,
    });
  }
};

// Controller for fetching all registrations (GET)
exports.getRegistrations = async (req, res) => {
  try {
    const registrations = await NewRegistrationModel.find({
      schoolId: req.user.schoolId,
      ...req.sessionFilter,
    });

    return res.status(200).json({
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
    const { registrationNumber } = req.params;
    const updateData = req.body;
    const files = req.files || [];

    const registration = await NewRegistrationModel.findOne({
      registrationNumber,
      schoolId: req.user.schoolId,
    });
    if (!registration) {
      return res
        .status(404)
        .json({ success: false, message: "Registration not found." });
    }

    // Handle file uploads if provided
    const studentPhoto = files.find((f) => f.fieldname === "studentPhoto");
    const fatherPhoto = files.find((f) => f.fieldname === "fatherPhoto");
    const motherPhoto = files.find((f) => f.fieldname === "motherPhoto");
    const guardianPhoto = files.find((f) => f.fieldname === "guardianPhoto");

    if (studentPhoto) {
      const fileKey = `registrations/student/${Date.now()}-${
        studentPhoto.originalname
      }`;
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
      const fileKey = `registrations/father/${Date.now()}-${
        fatherPhoto.originalname
      }`;
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
      const fileKey = `registrations/mother/${Date.now()}-${
        motherPhoto.originalname
      }`;
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
      const fileKey = `registrations/guardian/${Date.now()}-${
        guardianPhoto.originalname
      }`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: guardianPhoto.buffer,
        ContentType: guardianPhoto.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      updateData.guardianPhoto = {
        public_id: fileKey,
        url: minioData.Location,
      };
    }

    const updatedRegistration = await NewRegistrationModel.findOneAndUpdate(
      { registrationNumber, schoolId: req.user.schoolId },
      { ...updateData, updatedBy: req.user.userId }, // Add updatedBy if needed
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
      message: "Failed to update registration due to an error.",
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
        studentIds: [studentData._id],
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
        message: "Invalid request format. Please provide an array of students in the 'students' field.",
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
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!createdBy) {
      return res.status(400).json({
        success: false,
        message: "User ID is required from authenticated admin.",
      });
    }

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
      } = student;

      try {
        if (!studentFullName) throw new Error("Student full name is required.");
        if (!studentEmail) throw new Error("Student email is required.");
        if (!studentPassword) throw new Error("Student password is required.");
        if (!fatherName) throw new Error("Father's name is required.");
        if (!studentJoiningDate) throw new Error("Student joining date is required.");
        if (!studentClass) throw new Error("Student class is required.");
        if (!parentEmail && !parentAdmissionNumber) {
          throw new Error("Parent email or admission number is required.");
        }
        if (!parentPassword && !parentAdmissionNumber) {
          throw new Error("Parent password is required when creating a new parent.");
        }

        const studentExist = await NewStudentModel.findOne({
          email: studentEmail,
          schoolId,
          session,
        });
        if (studentExist) {
          throw new Error(`Student with email ${studentEmail} already exists in this school and session.`);
        }

        const parentExist = parentAdmissionNumber
          ? await ParentModel.findOne({ admissionNumber: parentAdmissionNumber, schoolId, session })
          : parentEmail
          ? await ParentModel.findOne({ email: parentEmail, schoolId, session })
          : null;

        if (parentAdmissionNumber && !parentExist) {
          throw new Error(`Parent with admission number ${parentAdmissionNumber} does not exist in this school and session.`);
        }
        if (!parentAdmissionNumber && parentEmail && parentExist) {
          throw new Error(`Parent with email ${parentEmail} already exists in this school and session.`);
        }

        const studentHashPassword = await hashPassword(studentPassword);
        const parentHashPassword = parentPassword ? await hashPassword(parentPassword) : undefined;

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
              $push: { studentIds: studentData._id },
              studentNames: studentFullName,
            },
            { new: true }
          );
        } else if (parentEmail && parentPassword) {
          parentData = await ParentModel.create({
            schoolId,
            session,
            studentIds: [studentData._id],
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
          });

          const parentEmailContent = `<p>Your EmailID: ${parentEmail}</p><p>Your Password: ${parentPassword}</p><p>Your Parent ID: ${parentData.parentId}</p>`;
          await sendEmail(parentEmail, "Parent Login Credentials", parentEmailContent);
        } else {
          throw new Error("Parent details are required when creating a new parent.");
        }

        if (parentData) {
          studentData.parentId = parentData._id || parentExist._id;
          studentData.parentAdmissionNumber = parentAdmissionNumber || parentData.admissionNumber;
          await studentData.save();
        } else {
          throw new Error("Parent creation failed due to an error.");
        }

        createdStudents.push(studentData);
      } catch (error) {
        errors.push({ studentEmail: studentEmail || "unknown", error: error.message });
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
      message: "Bulk student and parent creation failed due to an unexpected error.",
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
    const { studentId } = req.params;
    const student = await NewStudentModel.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }
    student.approvalStatus = "approved";
    await student.save();
    return res.status(200).json({
      success: true,
      message: "Admission approved successfully",
      student,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.approveMultipleAdmissions = async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of student IDs",
      });
    }

    const result = await NewStudentModel.updateMany(
      { _id: { $in: studentIds }, approvalStatus: "pending" },
      { $set: { approvalStatus: "approved" } }
    );

    return res.status(200).json({
      success: true,
      message: `${result.nModified} admissions approved successfully`,
    });
  } catch (error) {
    return res.status(500).json({
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
    const pendingAdmissions = await NewStudentModel.find({
      approvalStatus: "pending",
    });
    return res.status(200).json({
      success: true,
      message: "Pending admissions fetched successfully",
      data: pendingAdmissions,
    });
  } catch (error) {
    return res.status(500).json({
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
    const { studentId, parentAdmissionNumber } = req.body;
    const schoolId = req.user.schoolId;
    const updatedBy = req.user._id; // Track who made the update (optional)

    // Validation
    if (!schoolId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "School ID is required from authenticated admin.",
        });
    }
    if (!studentId) {
      return res
        .status(400)
        .json({ success: false, message: "Student ID is required." });
    }
    if (!parentAdmissionNumber) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Parent admission number is required.",
        });
    }

    // Find the student
    const student = await NewStudentModel.findOne({ _id: studentId, schoolId });
    if (!student) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Student not found or does not belong to this school.",
        });
    }

    // Find the new parent
    const newParent = await ParentModel.findOne({
      admissionNumber: parentAdmissionNumber,
      schoolId,
    });
    if (!newParent) {
      return res
        .status(404)
        .json({
          success: false,
          message: `Parent with admission number ${parentAdmissionNumber} not found in this school.`,
        });
    }

    // Check if the student is already linked to this parent
    if (
      student.parentId &&
      student.parentId.toString() === newParent._id.toString()
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Student is already linked to this parent.",
        });
    }

    // If the student was previously linked to another parent, update the old parent's student list
    if (student.parentId) {
      const oldParent = await ParentModel.findById(student.parentId);
      if (oldParent) {
        oldParent.studentIds = oldParent.studentIds.filter(
          (id) => id.toString() !== studentId
        );
        oldParent.studentNames = oldParent.studentNames.filter(
          (name) => name !== student.fullName
        );
        await oldParent.save();
      }
    }

    // Update the new parent's student list
    newParent.studentIds.push(student._id);
    if (!newParent.studentNames.includes(student.fullName)) {
      newParent.studentNames.push(student.fullName);
    }
    await newParent.save();

    // Update the student's parent details
    student.parentId = newParent._id;
    student.parentAdmissionNumber = parentAdmissionNumber;
    await student.save();

    res.status(200).json({
      success: true,
      message: "Student successfully linked to the new parent.",
      student: {
        _id: student._id,
        fullName: student.fullName,
        admissionNumber: student.admissionNumber,
        parentId: student.parentId,
        parentAdmissionNumber: student.parentAdmissionNumber,
      },
      parent: {
        _id: newParent._id,
        fullName: newParent.fullName,
        admissionNumber: newParent.admissionNumber,
        studentIds: newParent.studentIds,
        studentNames: newParent.studentNames,
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

exports.getParentWithChildren = async (req, res) => {
  try {
    const parentAdmissionNumber = req.params.parentAdmissionNumber;

    if (!parentAdmissionNumber) {
      return res.status(400).json({
        success: false,
        message: "Parent admission number is required",
      });
    }

    // Find the parent and populate student details
    const parent = await ParentModel.findOne({
      admissionNumber: parentAdmissionNumber,
    }).populate("studentIds"); // Ensure that studentIds field is populated with student details

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    // Get dues for each child based on their admission number
    const childrenWithDues = await Promise.all(
      parent.studentIds.map(async (student) => {
        const feeStatus = await FeeStatus.findOne({
          admissionNumber: student.admissionNumber,
        });
        const totalDues = feeStatus ? feeStatus.dues : 0; // If no fee record, dues are 0 by default

        return {
          schoolId: student.schoolId,
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
          image: student.image,
          createdAt: student.createdAt,
          dues: totalDues, // Add the dues for the student
        };
      })
    );

    // Format the response
    res.status(200).json({
      success: true,
      parent: {
        schoolId: parent.schoolId,
        studentIds: parent.studentIds.map((student) => student._id.toString()), // Return student IDs
        studentName: parent.studentName,
        fullName: parent.fullName,
        motherName: parent.motherName,
        email: parent.email,
        contact: parent.contact,
        admissionNumber: parent.admissionNumber,
        income: parent.income,
        qualification: parent.qualification,
        image: parent.image,
        status: parent.status,
        role: parent.role,
        createdAt: parent.createdAt,
      },
      children: childrenWithDues, // Return children with dues included
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving parent with children",
      error: error.message,
    });
  }
};

exports.getDataByAdmissionNumber = async (req, res) => {
  try {
    const { admissionNumber } = req.params;

    const studentData = await NewStudentModel.findOne({ admissionNumber });
    const parentData = await ParentModel.findOne({ admissionNumber });
    const feeStatusData = await FeeStatus.findOne({ admissionNumber });

    if (!studentData && !parentData && !feeStatusData) {
      return res.status(404).json({
        success: false,
        message: "No data found with this admission number",
      });
    }

    res.status(200).json({
      success: true,
      studentData,
      parentData,
      feeStatusData, // Add the fee status data to the response
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving data",
      error: error.message,
    });
  }
};

exports.getAllParentsWithChildren = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    // Find all parents for the school and populate student details
    const parents = await ParentModel.find({
      schoolId,
      status: "active",
      ...req.sessionFilter,
    }).populate("studentIds"); // Ensure that studentIds field is populated with student details

    if (parents.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No parents found",
      });
    }

    // Format the response
    const parentsWithChildren = parents.map((parent) => {
      const children = parent.studentIds.map((student) => ({
        schoolId: student.schoolId,
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
        image: student.image,
        createdAt: student.createdAt,
      }));

      return {
        parent: {
          schoolId: parent.schoolId,
          studentIds: parent.studentIds.map((student) =>
            student._id.toString()
          ), // Return student IDs
          studentName: parent.studentIds
            .map((student) => student.fullName)
            .join(", "), // Concatenate all children's names
          fullName: parent.fullName,
          motherName: parent.motherName,
          email: parent.email,
          contact: parent.contact,
          admissionNumber: parent.admissionNumber,
          income: parent.income,
          qualification: parent.qualification,
          image: parent.image,
          status: parent.status,
          role: parent.role,
          createdAt: parent.createdAt,
          children: children, // Add the children array inside the parent object
        },
        children, // Keep the separate children array if needed
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
    const { fatherName, motherName, parentEmail, parentContact } = req.body;

    const parentImageFile = req.file;

    const parentData = await ParentModel.findOne({
      schoolId: req.user.schoolId,
      email: parentEmail,
    });

    if (!parentData) {
      return res.status(404).json({
        status: false,
        message: "Parent Data is not found",
      });
    }

    if (parentImageFile) {
      const fileUri = getDataUri(parentImageFile);
      const parentImageResult = await cloudinary.uploader.upload(
        fileUri.content
      );
      parentData.parentImage = {
        public_id: parentImageResult.public_id,
        url: parentImageResult.secure_url,
      };
    }

    if (fatherName) {
      parentData.fatherName = fatherName;
    }

    if (motherName) {
      parentData.motherName = motherName;
    }

    if (parentContact) {
      parentData.parentContact = parentContact;
    }

    if (parentEmail) {
      parentData.email = parentEmail;
    }

    const updatedParentData = await parentData.save();

    res.status(200).json({
      success: true,
      message: "Parent data is updated",
      updatedParentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Parent data is not updated due to error",
      error: error.message,
    });
  }
};

exports.deactivateParent = async (req, res) => {
  try {
    const { email } = req.body;

    const Parent = await ParentModel.findOneAndUpdate(
      { schoolId: req.user.schoolId, email: email },
      {
        $set: {
          parentStatus: "deactivated",
        },
      },
      { new: true }
    );
    console.log(Parent);
    if (!Parent) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Parent is deactivated",
      Parent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Parent is not deactivated due to error",
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
      studentIds, // Array of specific student IDs to update
      filters, // Filters like class, section, etc.
      updateFields, // Object containing fields to update
    } = req.body;

    if (!updateFields || Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No update fields provided",
      });
    }

    // Build the query based on provided filters and/or student IDs
    let query = {
      schoolId: req.user.schoolId,
      status: "active",
    };

    // Add studentIds to query if provided
    if (studentIds && studentIds.length > 0) {
      query._id = { $in: studentIds };
    }

    // Add other filters if provided
    if (filters) {
      if (filters.class) query.class = filters.class;
      if (filters.section) query.section = filters.section;
      // Add any other filters you want to support
    }

    // Validate the update fields against the schema
    const validUpdateFields = {};
    const studentSchema = NewStudentModel.schema;

    for (const [key, value] of Object.entries(updateFields)) {
      // Handle nested fields (like udisePlusDetails)
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

    // Perform the bulk update
    const result = await NewStudentModel.updateMany(
      query,
      { $set: validUpdateFields },
      {
        runValidators: true,
        multi: true,
      }
    );

    // Get the updated students
    const updatedStudents = await NewStudentModel.find(query);

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

    console.log("Chaya", req.sessionFilter);
    console.log("Ajay", req.user.schoolId);
    const filter = {
      ...(email ? { email: email } : {}),
      ...(studentClass ? { class: studentClass } : {}),
      ...(section ? { section: section } : {}),
      ...req.sessionFilter,
    };

    console.log("P2 Filter", filter);

    const allStudent = await NewStudentModel.find({
      schoolId: req.user.schoolId,
      status: "active",
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

exports.deactivateStudent = async (req, res) => {
  try {
    const { email } = req.body;
    console.log(email);
    const student = await NewStudentModel.findOne({
      schoolId: req.user.schoolId,
      email: email,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student data is not found",
      });
    }

    const Student = await NewStudentModel.findOneAndUpdate(
      { schoolId: req.user.schoolId, email: email },
      {
        $set: {
          status: "deactivated",
        },
      },
      { new: true }
    );

    const Parent = await ParentModel.findByIdAndUpdate(
      { schoolId: req.user.schoolId, _id: student.parentId },
      {
        $set: {
          status: "deactivated",
        },
      },
      { new: true }
    );

    if (!Student || !Parent) {
      return res.status(400).json({
        success: false,
        message: "Student and Parent is not deactivated due to error",
      });
    }

    res.status(200).json({
      success: true,
      message: "Student and Parent is deactivated",
      Student,
      Parent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Student is not deactivated due to error",
      error: error.message,
    });
  }
};

exports.getDeactivatedStudents = async (req, res) => {
  try {
    const { email, studentClass, section } = req.query;

    const filter = {
      ...(email ? { email: email } : {}),
      ...(studentClass ? { class: studentClass } : {}),
      ...(section ? { section: section } : {}),
      ...req.sessionFilter,
    };

    const deactivatedStudents = await NewStudentModel.find({
      schoolId: req.user.schoolId,
      status: "deactivated",
      ...filter,
    });

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
    const { email, ...studentFields } = req.body;

    const StudentImage = req.file;
    const studentData = await NewStudentModel.findOne({
      schoolId: req.user.schoolId,
      email: email,
    });

    if (!studentData) {
      return res.status(404).json({
        status: false,
        message: "Student Data is not found",
      });
    }

    if (StudentImage) {
      const fileUri = getDataUri(StudentImage);
      const studentImageResult = await cloudinary.uploader.upload(
        fileUri.content
      );

      studentData.image = {
        public_id: studentImageResult.public_id,
        url: studentImageResult.secure_url,
      };
    }

    for (const key in studentFields) {
      studentData[key] = studentFields[key];
    }

    const updatedStudentData = await studentData.save();

    res.status(200).json({
      success: true,
      message: "Student data is updated",
      updatedStudentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Student data is not updated due to error",
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
    const { email, password, ...employeeFields } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill the required fields",
      });
    }

    const employeeExist = await EmployeeModel.findOne({
      schoolId: req.user.schoolId,
      email: email,
    });

    if (employeeExist) {
      return res.status(404).json({
        success: false,
        message: "Employee Data is Already Exist",
      });
    }

    const hashedPassword = await hashPassword(password);

    const file = req.file;
    const fileUri = getDataUri(file);
    const employeeImage = await cloudinary.v2.uploader.upload(fileUri.content);

    const employeeData = await EmployeeModel.create({
      schoolId: req.user.schoolId,
      email,
      password: hashedPassword,
      image: {
        public_id: employeeImage.public_id,
        url: employeeImage.url,
      },
      ...employeeFields,
    });

    if (employeeData) {
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
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
                <img src="${schoolImageUrl}" alt="${schoolName}" style="max-width: 120px; height: auto; border-radius: 50%; border: 3px solid #fff; margin-bottom: 10px;" onerror="this.src='https://i.ibb.co/1Y1qz1g/school.webp';">
                <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">${schoolName}</h1>
                <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Welcome to Our Team!</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding: 30px; background-color: #ffffff;">
                <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, Employee!</h2>
                <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">We’re excited to have you join ${schoolName} as an employee.</p>
                <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                  <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Credentials</h3>
                  <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
                  <p style="margin: 5px 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
                </div>
                <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Log in to start contributing to our school’s success!</p>
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

      sendEmail(email, "Employee Login Credentials", employeeEmailContent)
        .then(() => {
          console.log(
            "Employee Created and also send message to employee email Id"
          );
        })
        .catch((error) => {
          return res.status(500).json({
            success: false,
            message: "Mail is not send to Employee Email Address due to error",
            error: error.message,
          });
        });
    } else {
      return res.status(500).json({
        success: true,
        message: "employee is not created",
      });
    }

    res.status(201).json({
      success: true,
      message: "Employee Data is created",
      employeeData,
    });
  } catch (error) {
    res.status(500).json({
      success: "false",
      message: "Employee Data is not created due to error",
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
    const { email } = req.body;

    const Employee = await EmployeeModel.findOneAndUpdate(
      { schoolId: req.user.schoolId, email: email },
      {
        $set: {
          status: "deactivated",
        },
      },
      { new: true }
    );

    if (!Employee) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Employee is deactivated",
      Employee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Employee is not deactivated due to error",
      error: error.message,
    });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { email, ...employeeFields } = req.body;
    const employeeData = await EmployeeModel.findOne({
      schoolId: req.user.schoolId,
      email: email,
    });

    if (!employeeData) {
      return res.status(404).json({
        status: false,
        message: "Employee Data is not found",
      });
    }
    const file = req.file;

    if (file) {
      const fileUri = getDataUri(file);
      const employeeImageResult = await cloudinary.v2.uploader.upload(
        fileUri.content
      );
      employeeData.image = {
        public_id: employeeImageResult.public_id,
        url: employeeImageResult.secure_url,
      };
    }

    for (const key in employeeFields) {
      employeeData[key] = employeeFields[key];
    }

    const updatedEmployeeData = await employeeData.save();

    res.status(200).json({
      success: true,
      message: "Employee data is updated",
      updatedEmployeeData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Employee data is not updated due to error",
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
    const { title, content } = req.body;
    const file = req.file;
    const fileDataUri = getDataUri(file);

    const existNotice = await NoticeModel.findOne({ title: title });

    if (existNotice) {
      return res.status(400).json({
        success: false,
        message: "Title of that notice is already exist",
      });
    }

    const noticeFile = await cloudinary.v2.uploader.upload(fileDataUri.content);

    const notice = await NoticeModel.create({
      schoolId: req.user.schoolId,
      title,
      content,
      file: {
        public_id: noticeFile.public_id,
        url: noticeFile.secure_url,
      },
      class: req.user.classTeacher,
      section: req.user.section,
      role: req.user.role,
    });

    res.status(201).json({
      success: true,
      message: "Notice is successfully created",
      notice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Notice is not created due to error",
      error: error.message,
    });
  }
};

exports.deleteNotice = async (req, res) => {
  try {
    const { noticeId } = req.params;

    const existNotice = await NoticeModel.findById(noticeId);

    if (!existNotice) {
      return res.status(400).json({
        success: false,
        message: "Notice does not exist",
      });
    }

    const deletedNotice = await existNotice.deleteOne();

    res.status(200).json({
      success: true,
      message: "Notice deleted successfully",
      deletedNotice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Notice is not deleted due to error",
      error: error.message,
    });
  }
};

exports.updateNotice = async (req, res) => {
  try {
    const { noticeId } = req.params;
    const { ...noticeFields } = req.body;
    const file = req.file;

    const existNotice = await NoticeModel.findById(noticeId);

    if (!existNotice) {
      return res.status(404).json({
        success: false,
        message: "Notice does not exist",
      });
    }

    if (file) {
      const fileDataUri = getDataUri(file);

      const noticeFile = await cloudinary.v2.uploader.upload(
        fileDataUri.content
      );

      existNotice.file = {
        public_id: noticeFile.public_id,
        url: noticeFile.secure_url,
      };
    }

    for (let key in noticeFields) {
      existNotice[key] = noticeFields[key];
    }

    const updatedNotice = await existNotice.save();

    res.status(200).json({
      success: true,
      message: "Notice is updated successfully",
      updatedNotice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Notice is not updated due to Error",
      error: error.message,
    });
  }
};

exports.getAllNotice = async (req, res) => {
  try {
    const { noticeId, className, section, role } = req.query;

    const filter = {
      ...(noticeId ? { _id: noticeId } : {}),
      ...(className ? { class: className } : {}),
      ...(section ? { section: section } : {}),
      ...(role ? { role: role } : {}),
      ...req.sessionFilter,
    };

    console.log("filter", filter);

    const allNotice = await NoticeModel.find({
      ...filter,
      schoolId: req.user.schoolId,
    });

    res.status(200).json({
      success: true,
      message: "Notice is fetch is successfully",
      allNotice,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Notice is not get due to error",
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
    const { ...issueBookFields } = req.body;

    const existBook = await BookModel.findById(issueBookFields.bookId);

    if (!existBook) {
      return res.status(404).json({
        success: false,
        message: "Book Details is not exist",
      });
    }

    const existStudent = await NewStudentModel.findById(
      issueBookFields.studentId
    );

    if (!existStudent) {
      return res.status(404).json({
        success: false,
        message: "Student record is not exist",
      });
    }

    const issuedData = await issueBookModel.findOne({
      schoolId: req.user.schoolID,
      bookId: issueBookFields.bookId,
      studentId: issueBookFields.studentId,
      bookName: issueBookFields.bookName,
      status: "issued",
    });

    if (issuedData) {
      return res.status(400).json({
        success: false,
        message: "This Book Already issued to this Student",
      });
    }

    if (existBook.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Stock is not available",
      });
    }

    const issueBookData = await issueBookModel.create({
      schoolId: req.user.schoolId,
      ...issueBookFields,
    });

    if (issueBookData) {
      existBook.quantity = existBook.quantity - 1;

      await existBook.save();
    }

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

    const issueRecord = await issueBookModel.findById(issueId);

    if (!issueRecord) {
      return res.status(404).json({
        success: false,
        message: "issue Record not found",
      });
    }

    issueRecord.status = "returned";
    issueRecord.returnDate = Date.now();

    await issueRecord.save();

    const existBook = await BookModel.findById(issueRecord.bookId);

    existBook.quantity++;

    await existBook.save();

    res.status(200).json({
      success: true,
      message: "Book Returned Data is successfully Updated",
      issueRecord,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Book not Returned due to error",
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
exports.getAdminExams = async (req, res) => {
  try {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    // Build the query dynamically
    const query = {
      schoolId: req.user.schoolId,
    };

    // Optional filters from query parameters
    const { className, section } = req.query;

    if (className) {
      query.className = className;
    }

    if (section) {
      query.section = section;
    }

    // Log the query for debugging
    console.log("Admin Exams Query:", query);

    // Fetch exams with the constructed query
    const exams = await Exam.find(query)
      .sort({ startDate: -1 }) // Sort by startDate in descending order
      .lean(); // Use lean() for better performance if you don’t need Mongoose documents

    // Log the result for debugging
    console.log("Found Exams:", exams);

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
    console.error("Error in getAdminExams:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve exams",
      error: error.message,
    });
  }
};

// DELETE API CONTROLLER FOR ADMIN
exports.deleteAdminExam = async (req, res) => {
  try {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const exam = await Exam.findOneAndDelete({
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
      message: "Exam deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteAdminExam:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete exam",
      error: error.message,
    });
  }
};

// CREATE API CONTROLLER FOR ADMIN
exports.createAdminExam = async (req, res) => {
  try {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const examData = {
      ...req.body,
      schoolId: req.user.schoolId,
      createdBy: req.user._id,
    };

    // Log exam data for debugging
    console.log("Admin Exam Data:", examData);

    // Check if exam already exists
    const existingExam = await Exam.findOne({
      schoolId: examData.schoolId,
      className: examData.className,
      section: examData.section,
      examType: req.body.examType,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
    });

    if (existingExam) {
      return res.status(400).json({
        success: false,
        message: "An exam with these details already exists",
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
    console.error("Error in createAdminExam:", error.message);
    res.status(400).json({
      success: false,
      message: "Failed to create exam",
      error: error.message,
    });
  }
};

// UPDATE API CONTROLLER FOR ADMIN
exports.updateAdminExam = async (req, res) => {
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

    // Validate dates if they are being updated
    if (req.body.startDate || req.body.endDate || req.body.resultPublishDate) {
      validateExamDates(
        req.body.startDate || exam.startDate,
        req.body.endDate || exam.endDate,
        req.body.resultPublishDate || exam.resultPublishDate
      );
    }

    Object.assign(exam, req.body);
    await exam.save();

    res.status(200).json({
      success: true,
      message: "Exam updated successfully",
      exam,
    });
  } catch (error) {
    console.error("Error in updateAdminExam:", error.message);
    res.status(400).json({
      success: false,
      message: "Failed to update exam",
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
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const { studentId, examId, className, section } = req.query;
    const query = {
      schoolId: req.user.schoolId,
    };

    if (studentId) query.studentId = studentId;
    if (examId) query.examId = examId;
    if (className) query.className = className;
    if (section) query.section = section;

    const marks = await Mark.find(query)
      .populate("studentId", "name rollNo")
      .populate("examId", "name examType")
      .sort({ "studentId.rollNo": 1 });

    res.status(200).json({
      success: true,
      message: "Marks retrieved successfully",
      count: marks.length,
      marks,
    });
  } catch (error) {
    console.error("Error in getAdminMarks:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ADMIN UPDATE MARK
exports.updateAdminMark = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const mark = await Mark.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    });

    if (!mark) {
      return res.status(404).json({
        success: false,
        message: "Mark record not found",
      });
    }

    // Validate new marks against exam configuration
    const exam = await Exam.findById(mark.examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Associated exam not found",
      });
    }

    if (req.body.marks) {
      req.body.marks.forEach((newMark) => {
        const examSubject = exam.subjects.find(
          (s) => s.name === newMark.subjectName
        );
        if (!examSubject) {
          throw new Error(
            `Subject ${newMark.subjectName} not found in exam configuration`
          );
        }
        if (newMark.marks > examSubject.totalMarks) {
          throw new Error(
            `Marks cannot exceed total marks for ${newMark.subjectName}`
          );
        }
      });
    }

    Object.assign(mark, req.body);
    await mark.save();

    res.status(200).json({
      success: true,
      message: "Mark updated successfully",
      mark,
    });
  } catch (error) {
    console.error("Error in updateAdminMark:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ADMIN DELETE MARK
exports.deleteAdminMark = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const mark = await Mark.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.user.schoolId,
    });

    if (!mark) {
      return res.status(404).json({
        success: false,
        message: "Mark record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Mark record deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteAdminMark:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
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
        message: "Access denied. This endpoint is for admins only.",
      });
    }

    const { examId, studentsMarks } = req.body;

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

    const results = [];
    const errors = [];

    for (const studentData of studentsMarks) {
      try {
        let studentMark = await Mark.findOne({
          studentId: studentData.studentId,
          examId,
          schoolId: req.user.schoolId,
        });

        if (studentMark) {
          studentData.marks.forEach((newSubjectMark) => {
            const examSubject = exam.subjects.find(
              (s) => s.name === newSubjectMark.subjectName
            );
            if (!examSubject) {
              throw new Error(
                `Subject ${newSubjectMark.subjectName} not found in exam configuration`
              );
            }
            if (Number(newSubjectMark.marks) > examSubject.totalMarks) {
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
        } else {
          studentMark = new Mark({
            studentId: studentData.studentId,
            examId,
            schoolId: req.user.schoolId,
            className: exam.className,
            section: exam.section,
            marks: studentData.marks,
            coScholasticMarks: studentData.coScholasticMarks || [],
          });
        }

        await studentMark.save();
        results.push(studentMark);
      } catch (error) {
        errors.push({
          studentId: studentData.studentId,
          error: error.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully processed marks for ${results.length} students`,
      failedCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in bulkUploadAdminMarks:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
