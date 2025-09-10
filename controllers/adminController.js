const Collection = require("../models/adminModel");
const FeeStructure = require("../models/feeStructureModel");
const Teacher = require("../models/teacherModel");
const cloudinary = require("cloudinary");
const getDataUri = require("../utils/dataUri");
const sendEmail = require("../utils/email");
const crypto = require("crypto");
const s3 = require("../config/minio");
const axios = require("axios");
const moment = require('moment');

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
const Return = require("../models/returnModel");
const {Sale, Counter} = require("../models/salesModel");
const PurchaseOrder = require("../models/purchaseOrderModel");
const NewRegistrationModel = require("../models/newRegistrationModel");
const NewStudentModel = require("../models/newStudentModel");
const ParentModel = require("../models/parentModel");
const EmployeeModel = require("../models/employeeModel");
const FeeStatus = require("../models/feeStatus");
// const classModel = require("../models/classModel");
const classModel = require("../models/classModel");
const NoticeModel = require("../models/noticeModel");
const SellInventory = require("../models/sellInventory");
const ReceiptModel = require("../models/receiptModel");
const Curriculum = require("../models/curriculumModel");
const Assignment = require("../models/assignmentModel");
const IssueBook = require("../models/issueBookModel");
const AdminInfo = require("../models/adminModel");
const Mark = require("../models/mark");
const Exam = require("../models/exam");
const { generateStructuredNumber } = require("../utils/numberGenerator");

// controllers/designFormatController.js
const DesignFormat = require("../models/designFormatModel");
const UserCredentials = require("../models/userCredentialsModel");
const BundleModel = require("../models/bundleModel");
const SupplierModel = require("../models/supplierModel");
const SupplierPayment = require("../models/supplierPaymentModel");
// const { v4: uuidv4 } = require("uuid");

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




// DESIGN RELATED CONTROLLER FLOW
// Improved base64 validation
function isValidBase64(str) {
  try {
    // Normalize input: remove whitespace, ensure proper padding
    str = str.trim();
    if (!str) return false;

    // Add padding if needed
    const paddingNeeded = str.length % 4;
    if (paddingNeeded) {
      str += '='.repeat(4 - paddingNeeded);
    }

    // Check if valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(str)) {
      console.log("Base64 validation failed: Invalid characters", str);
      return false;
    }

    // Verify decoding and re-encoding
    const buffer = Buffer.from(str, 'base64');
    const reEncoded = buffer.toString('base64');
    const isValid = reEncoded === str || reEncoded === str.replace(/=+$/, '');
    if (!isValid) {
      console.log("Base64 validation failed: Decode/re-encode mismatch", { original: str, reEncoded });
    }
    return isValid;
  } catch (error) {
    console.log("Base64 validation error:", error.message, str);
    return false;
  }
}




exports.createDesignFormat = async (req, res) => {
  try {
    console.log("Received req.body:", req.body);
    console.log("Received req.files:", req.files);
    console.log("Content-Type:", req.headers['content-type']);

    const { name, type, content, description, isDefault, isPublic } = req.body;

    // Validate name
    if (!name || name.trim() === "") {
      console.log("Validation failed: Name is missing or empty");
      return res.status(400).json({
        success: false,
        message: "Name is required and cannot be empty"
      });
    }

    // Validate type
    if (!type || type.trim() === "") {
      console.log("Validation failed: Type is missing or empty");
      return res.status(400).json({
        success: false,
        message: "Type is required and cannot be empty"
      });
    }
    const validTypes = ['idCard', 'feeReceipt', 'reportCard', 'admissionForm', 'registrationForm', 'registrationCard', 'reimbursementForm', 'bonafideCertificate', 'transferCertificate', 'characterCertificate', 'schoolLeavingCertificate', 'schoolLeavingCard'];
    if (!validTypes.includes(type)) {
      console.log("Validation failed: Invalid type", type);
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate content
    let contentArray = [];
    if (!content) {
      console.log("Validation failed: Content is missing");
      return res.status(400).json({
        success: false,
        message: "Content is required"
      });
    }

    const files = req.files || [];
    // Handle content
    if (typeof content === "string" && content.trim()) {
      if (content.trim().startsWith('[')) {
        try {
          const parsedContent = JSON.parse(content);
          if (!Array.isArray(parsedContent)) {
            throw new Error("Content must be an array");
          }
          for (let i = 0; i < parsedContent.length; i++) {
            const entry = parsedContent[i];
            if (!entry.data || typeof entry.data !== "string" || entry.data.trim() === "") {
              console.log("Validation failed: Missing or invalid content data", entry);
              return res.status(400).json({
                success: false,
                message: "Each content entry must have non-empty data"
              });
            }
            const contentEntry = {
              id: uuidv4(),
              data: entry.data.trim(),
              name: entry.name ? String(entry.name).trim() : ""
            };
            // Handle image upload for this content entry
            const imageFile = files.find(f => f.fieldname === `content[${i}][image]`);
            if (imageFile) {
              const fileKey = `designFormats/${type}/${Date.now()}-${imageFile.originalname}`;
              const params = {
                Bucket: process.env.MINIO_BUCKET,
                Key: fileKey,
                Body: imageFile.buffer,
                ContentType: imageFile.mimetype,
                ACL: "public-read"
              };
              const minioData = await s3.upload(params).promise();
              contentEntry.image = { public_id: fileKey, url: minioData.Location };
            }
            contentArray.push(contentEntry);
          }
        } catch (error) {
          console.log("Failed to parse content as JSON array:", error.message, content);
          contentArray = [{ id: uuidv4(), data: content.trim(), name: "" }];
        }
      } else {
        contentArray = [{ id: uuidv4(), data: content.trim(), name: "" }];
      }
    } else if (Array.isArray(content)) {
      for (let i = 0; i < content.length; i++) {
        const entry = content[i];
        if (!entry.data || typeof entry.data !== "string" || entry.data.trim() === "") {
          console.log("Validation failed: Missing or invalid content data", entry);
          return res.status(400).json({
            success: false,
            message: "Each content entry must have non-empty data"
          });
        }
        const contentEntry = {
          id: uuidv4(),
          data: entry.data.trim(),
          name: entry.name ? String(entry.name).trim() : ""
        };
        const imageFile = files.find(f => f.fieldname === `content[${i}][image]`);
        if (imageFile) {
          const fileKey = `designFormats/${type}/${Date.now()}-${imageFile.originalname}`;
          const params = {
            Bucket: process.env.MINIO_BUCKET,
            Key: fileKey,
            Body: imageFile.buffer,
            ContentType: imageFile.mimetype,
            ACL: "public-read"
          };
          const minioData = await s3.upload(params).promise();
          contentEntry.image = { public_id: fileKey, url: minioData.Location };
        }
        contentArray.push(contentEntry);
      }
    } else {
      console.log("Validation failed: Invalid content format", content);
      return res.status(400).json({
        success: false,
        message: "Content must be a string or array"
      });
    }

    if (contentArray.length === 0) {
      console.log("Validation failed: Content array is empty");
      return res.status(400).json({
        success: false,
        message: "Content array cannot be empty"
      });
    }

    // Handle background image
    let backgroundImageResult = {};
    const backgroundImageFile = files.find(f => f.fieldname === "backgroundImage");
    if (backgroundImageFile) {
      const fileKey = `designFormats/${type}/${Date.now()}-${backgroundImageFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: backgroundImageFile.buffer,
        ContentType: backgroundImageFile.mimetype,
        ACL: "public-read"
      };
      const minioData = await s3.upload(params).promise();
      backgroundImageResult = { public_id: fileKey, url: minioData.Location };
    }

    // Unset isDefault on any existing design with isDefault: true for this schoolId and type
    if (isDefault === "true" || isDefault === true) {
      await DesignFormat.updateMany(
        { schoolId: req.user.schoolId, type, isDefault: true },
        { $set: { isDefault: false } }
      );
      console.log("Unset isDefault on existing designs for schoolId:", req.user.schoolId, "type:", type);
    }

    // Check if a design exists for this school and type
    const existingDesign = await DesignFormat.findOne({
      schoolId: req.user.schoolId,
      type
    });

    let designFormat;
    if (existingDesign) {
      console.log("Existing design found, updating:", existingDesign._id);

      // Prepare new content array, preserving existing images where no new image is provided
      const newContentArray = contentArray.map((newEntry, index) => {
        const existingContent = existingDesign.content[index];
        const imageFile = files.find(f => f.fieldname === `content[${index}][image]`);
        
        if (imageFile) {
          // New image provided, delete old image if it exists
          if (existingContent?.image?.public_id) {
            try {
              console.log("Deleting old content image:", existingContent.image.public_id);
              s3.deleteObject({
                Bucket: process.env.MINIO_BUCKET,
                Key: existingContent.image.public_id
              }).promise().catch(err => console.error("Error deleting old content image:", err));
            } catch (deleteError) {
              console.error("Error deleting old content image:", deleteError);
            }
          }
          // New image is already set in contentArray
          return newEntry;
        } else if (existingContent?.image?.public_id) {
          // No new image, preserve existing image
          console.log("Preserving existing content image for index:", index);
          return {
            ...newEntry,
            image: existingContent.image
          };
        }
        // No new image and no existing image
        return newEntry;
      });

      // Delete images for content entries that are no longer present
      for (let i = newContentArray.length; i < existingDesign.content.length; i++) {
        const oldContent = existingDesign.content[i];
        if (oldContent?.image?.public_id) {
          try {
            console.log("Deleting orphaned content image:", oldContent.image.public_id);
            s3.deleteObject({
              Bucket: process.env.MINIO_BUCKET,
              Key: oldContent.image.public_id
            }).promise().catch(err => console.error("Error deleting orphaned content image:", err));
          } catch (deleteError) {
            console.error("Error deleting orphaned content image:", deleteError);
          }
        }
      }

      // Delete old background image if new one is provided
      if (backgroundImageFile && existingDesign.backgroundImage?.public_id) {
        try {
          console.log("Deleting old background image:", existingDesign.backgroundImage.public_id);
          s3.deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: existingDesign.backgroundImage.public_id
          }).promise().catch(err => console.error("Error deleting old background image:", err));
        } catch (deleteError) {
          console.error("Error deleting old background image:", deleteError);
        }
      }

      // Update existing design
      existingDesign.name = name.trim();
      existingDesign.content = newContentArray;
      existingDesign.description = description ? description.trim() : "";
      existingDesign.isDefault = isDefault === "true" || isDefault === true;
      existingDesign.isPublic = isPublic === "true" || isPublic === true;
      if (backgroundImageFile) {
        existingDesign.backgroundImage = backgroundImageResult.url ? backgroundImageResult : undefined;
      }

      await existingDesign.save();
      designFormat = existingDesign;
    } else {
      console.log("No existing design, creating new");

      // Create new design
      designFormat = await DesignFormat.create({
        formatId: uuidv4(),
        schoolId: req.user.schoolId,
        name: name.trim(),
        type,
        content: contentArray,
        description: description ? description.trim() : "",
        isDefault: isDefault === "true" || isDefault === true,
        isPublic: isPublic === "true" || isPublic === true,
        backgroundImage: backgroundImageResult.url ? backgroundImageResult : undefined
      });
    }

    // Transform response
    const transformedDesignFormat = {
      _id: designFormat._id,
      formatId: designFormat.formatId,
      schoolId: designFormat.schoolId,
      name: designFormat.name,
      type: designFormat.type,
      isDefault: designFormat.isDefault,
      isPublic: designFormat.isPublic,
      frontTemplate: designFormat.content[0]?.data || "",
      backTemplate: designFormat.content[1]?.data || "",
      frontImage: designFormat.content[0]?.image || { public_id: "", url: "" },
      backImage: designFormat.content[1]?.image || { public_id: "", url: "" },
      createdAt: designFormat.createdAt,
      updatedAt: designFormat.updatedAt,
      __v: designFormat.__v
    };

    res.status(201).json({
      success: true,
      message: existingDesign ? "Design format updated successfully" : "Design format created successfully",
      designFormat: transformedDesignFormat
    });
  } catch (error) {
    console.error("Error in createDesignFormat:", error);
    res.status(500).json({
      success: false,
      message: "Error processing design format",
      error: error.message
    });
  }
};

// Other functions remain unchanged
exports.getDesignFormats = async (req, res) => {
  try {
    const { type, formatId, isDefault, includePublic, schoolId } = req.query;
    const userSchoolId = req.user.schoolId;
    let query = {};

    if (type) {
      const validTypes = ['idCard', 'feeReceipt', 'reportCard', 'admissionForm', 'registrationForm', 'registrationCard', 'reimbursementForm', 'bonafideCertificate', 'transferCertificate', 'characterCertificate', 'schoolLeavingCertificate', 'schoolLeavingCard'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid type. Must be one of: ${validTypes.join(', ')}`
        });
      }
      query.type = type;
    }

    if (formatId) query.formatId = formatId;
    if (isDefault === "true") query.isDefault = true;

    if (includePublic === "true") {
      query = {
        $or: [
          { schoolId: userSchoolId, ...query },
          { isPublic: true, ...query }
        ]
      };
    } else {
      query.schoolId = userSchoolId;
    }

    if (schoolId) query.schoolId = schoolId;

    const designFormats = await DesignFormat.find(query)
      .sort({ type: 1, isDefault: -1, updatedAt: -1 });

    if (formatId && designFormats.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Design format not found"
      });
    }

    // Transform response to desired format
    const transformedDesignFormats = designFormats.map(df => ({
      _id: df._id,
      formatId: df.formatId,
      schoolId: df.schoolId,
      name: df.name,
      type: df.type,
      isDefault: df.isDefault,
      isPublic: df.isPublic,
      frontTemplate: df.content[0]?.data || "",
      backTemplate: df.content[1]?.data || "",
      frontImage: df.content[0]?.image || { public_id: "", url: "" },
      backImage: df.content[1]?.image || { public_id: "", url: "" },
      createdAt: df.createdAt,
      updatedAt: df.updatedAt,
      __v: df.__v
    }));

    res.status(200).json({
      success: true,
      message: "Design formats fetched successfully",
      count: transformedDesignFormats.length,
      designFormats: transformedDesignFormats
    });
  } catch (error) {
    console.error("Error in getDesignFormats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching design formats",
      error: error.message
    });
  }
};

exports.updateDesignFormat = async (req, res) => {
  try {
    console.log("Received req.body:", req.body);
    console.log("Received req.files:", req.files);
    console.log("Content-Type:", req.headers['content-type']);

    const { formatId } = req.params;
    const { name, content, description, isDefault, isPublic } = req.body;

    const designFormat = await DesignFormat.findOne({
      formatId,
      schoolId: req.user.schoolId
    });

    if (!designFormat) {
      return res.status(404).json({
        success: false,
        message: "Design format not found"
      });
    }

    if (name) designFormat.name = name.trim();
    if (description !== undefined) designFormat.description = description ? description.trim() : "";
    if (isPublic !== undefined) designFormat.isPublic = isPublic;

    const files = req.files || [];
    if (content !== undefined) {
      let contentArray = [];
      if (typeof content === "string" && content.trim()) {
        if (content.trim().startsWith('[')) {
          try {
            const parsedContent = JSON.parse(content);
            if (!Array.isArray(parsedContent)) {
              throw new Error("Content must be an array");
            }
            for (let i = 0; i < parsedContent.length; i++) {
              const entry = parsedContent[i];
              if (!entry.data || typeof entry.data !== "string" || entry.data.trim() === "") {
                console.log("Validation failed: Missing or invalid content data", entry);
                return res.status(400).json({
                  success: false,
                  message: "Each content entry must have non-empty data"
                });
              }
              const contentEntry = {
                id: uuidv4(),
                data: entry.data.trim(),
                name: entry.name ? String(entry.name).trim() : ""
              };
              const imageFile = files.find(f => f.fieldname === `content[${i}][image]`);
              if (imageFile) {
                const fileKey = `designFormats/${designFormat.type}/${Date.now()}-${imageFile.originalname}`;
                const params = {
                  Bucket: process.env.MINIO_BUCKET,
                  Key: fileKey,
                  Body: imageFile.buffer,
                  ContentType: imageFile.mimetype,
                  ACL: "public-read"
                };
                const minioData = await s3.upload(params).promise();
                contentEntry.image = { public_id: fileKey, url: minioData.Location };
              }
              contentArray.push(contentEntry);
            }
          } catch (error) {
            console.log("Failed to parse content as JSON array:", error.message, content);
            contentArray = [{ id: uuidv4(), data: content.trim(), name: "" }];
          }
        } else {
          contentArray = [{ id: uuidv4(), data: content.trim(), name: "" }];
        }
      } else if (Array.isArray(content)) {
        for (let i = 0; i < content.length; i++) {
          const entry = content[i];
          if (!entry.data || typeof entry.data !== "string" || entry.data.trim() === "") {
            console.log("Validation failed: Missing or invalid content data", entry);
            return res.status(400).json({
              success: false,
              message: "Each content entry must have non-empty data"
            });
          }
          const contentEntry = {
            id: uuidv4(),
            data: entry.data.trim(),
            name: entry.name ? String(entry.name).trim() : ""
          };
          const imageFile = files.find(f => f.fieldname === `content[${i}][image]`);
          if (imageFile) {
            const fileKey = `designFormats/${designFormat.type}/${Date.now()}-${imageFile.originalname}`;
            const params = {
              Bucket: process.env.MINIO_BUCKET,
              Key: fileKey,
              Body: imageFile.buffer,
              ContentType: imageFile.mimetype,
              ACL: "public-read"
            };
            const minioData = await s3.upload(params).promise();
            contentEntry.image = { public_id: fileKey, url: minioData.Location };
          }
          contentArray.push(contentEntry);
        }
      } else if (content !== "") {
        console.log("Validation failed: Invalid content format", content);
        return res.status(400).json({
          success: false,
          message: "Content must be a string or array"
        });
      }

      if (contentArray.length === 0 && content !== "") {
        return res.status(400).json({
          success: false,
          message: "Content array cannot be empty if provided"
        });
      }

      // Delete old content images from MinIO
      for (const oldContent of designFormat.content) {
        if (oldContent.image?.public_id) {
          try {
            await s3.deleteObject({
              Bucket: process.env.MINIO_BUCKET,
              Key: oldContent.image.public_id
            }).promise();
          } catch (deleteError) {
            console.error("Error deleting old content image:", deleteError);
          }
        }
      }

      designFormat.content = contentArray;
    }

    const backgroundImageFile = files.find(f => f.fieldname === "backgroundImage");
    if (backgroundImageFile) {
      if (designFormat.backgroundImage?.public_id) {
        try {
          await s3.deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: designFormat.backgroundImage.public_id
          }).promise();
        } catch (deleteError) {
          console.error("Error deleting old background image:", deleteError);
        }
      }
      const fileKey = `designFormats/${designFormat.type}/${Date.now()}-${backgroundImageFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: backgroundImageFile.buffer,
        ContentType: imageFile.mimetype,
        ACL: "public-read"
      };
      const minioData = await s3.upload(params).promise();
      designFormat.backgroundImage = { public_id: fileKey, url: minioData.Location };
    }

    if (isDefault && !designFormat.isDefault) {
      await DesignFormat.findOneAndUpdate(
        {
          schoolId: req.user.schoolId,
          type: designFormat.type,
          isDefault: true,
          formatId: { $ne: formatId }
        },
        { isDefault: false }
      );
      designFormat.isDefault = true;
    }

    await designFormat.save();

    // Transform response
    const transformedDesignFormat = {
      _id: designFormat._id,
      formatId: designFormat.formatId,
      schoolId: designFormat.schoolId,
      name: designFormat.name,
      type: designFormat.type,
      isDefault: designFormat.isDefault,
      isPublic: designFormat.isPublic,
      frontTemplate: designFormat.content[0]?.data || "",
      backTemplate: designFormat.content[1]?.data || "",
      frontImage: designFormat.content[0]?.image || { public_id: "", url: "" },
      backImage: designFormat.content[1]?.image || { public_id: "", url: "" },
      createdAt: designFormat.createdAt,
      updatedAt: designFormat.updatedAt,
      __v: designFormat.__v
    };

    res.status(200).json({
      success: true,
      message: "Design format updated successfully",
      designFormat: transformedDesignFormat
    });
  } catch (error) {
    console.error("Error in updateDesignFormat:", error);
    res.status(500).json({
      success: false,
      message: "Error updating design format",
      error: error.message
    });
  }
};

exports.deleteDesignFormat = async (req, res) => {
  try {
    const { formatId } = req.params;

    const designFormat = await DesignFormat.findOne({
      formatId,
      schoolId: req.user.schoolId
    });

    if (!designFormat) {
      return res.status(404).json({
        success: false,
        message: "Design format not found"
      });
    }

    if (designFormat.isDefault) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete the default format. Please set another format as default first."
      });
    }

    // Delete content images
    for (const content of designFormat.content) {
      if (content.image?.public_id) {
        try {
          await s3.deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: content.image.public_id
          }).promise();
        } catch (deleteError) {
          console.error("Error deleting content image:", deleteError);
        }
      }
    }

    // Delete background image
    if (designFormat.backgroundImage?.public_id) {
      try {
        await s3.deleteObject({
          Bucket: process.env.MINIO_BUCKET,
          Key: designFormat.backgroundImage.public_id
        }).promise();
      } catch (deleteError) {
        console.error("Error deleting background image:", deleteError);
      }
    }

    await DesignFormat.findByIdAndDelete(designFormat._id);

    res.status(200).json({
      success: true,
      message: "Design format deleted successfully"
    });
  } catch (error) {
    console.error("Error in deleteDesignFormat:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting design format",
      error: error.message
    });
  }
};

exports.setDefaultDesignFormat = async (req, res) => {
  try {
    const { formatId } = req.params;

    const designFormat = await DesignFormat.findOne({
      formatId,
      schoolId: req.user.schoolId
    });

    if (!designFormat) {
      return res.status(404).json({
        success: false,
        message: "Design format not found"
      });
    }

    if (designFormat.isDefault) {
      designFormat.isDefault = false;
    } else {
      await DesignFormat.findOneAndUpdate(
        {
          schoolId: req.user.schoolId,
          type: designFormat.type,
          isDefault: true,
          formatId: { $ne: formatId }
        },
        { isDefault: false }
      );
      designFormat.isDefault = true;
    }

    await designFormat.save();

    // Transform response
    const transformedDesignFormat = {
      _id: designFormat._id,
      formatId: designFormat.formatId,
      schoolId: designFormat.schoolId,
      name: designFormat.name,
      type: designFormat.type,
      isDefault: designFormat.isDefault,
      isPublic: designFormat.isPublic,
      frontTemplate: designFormat.content[0]?.data || "",
      backTemplate: designFormat.content[1]?.data || "",
      frontImage: designFormat.content[0]?.image || { public_id: "", url: "" },
      backImage: designFormat.content[1]?.image || { public_id: "", url: "" },
      createdAt: designFormat.createdAt,
      updatedAt: designFormat.updatedAt,
      __v: designFormat.__v
    };

    res.status(200).json({
      success: true,
      message: `Design format ${designFormat.isDefault ? 'set as' : 'unset from'} default successfully`,
      designFormat: transformedDesignFormat
    });
  } catch (error) {
    console.error("Error in setDefaultDesignFormat:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling default design format",
      error: error.message
    });
  }
};




// Create a new teacher
exports.createTeacher = async (req, res) => {
  try {
    const { email, password, session, ...userFields } = req.body;
    const file = req.file;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please fill the required fields",
      });
    }

    const assignedSession = session || req.user.session;
    if (!assignedSession) {
      return res.status(400).json({
        success: false,
        message: "Session is required to create a teacher",
      });
    }

    const userExist = await Teacher.findOne({
      email,
      schoolId: req.user.schoolId,
      session: assignedSession,
    });

    if (userExist) {
      return res.status(400).send({
        success: false,
        message: "Teacher already exists with this email for the specified session",
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

    const teacherId = uuidv4();
    const employeeId = generateEmployeeId();

    const teacherData = await Teacher.create({
      teacherId,
      schoolId: req.user.schoolId,
      session: assignedSession,
      email,
      password: hashedPassword,
      employeeId,
      image: fileData,
      createdBy: req.user._id, // Added createdBy from admin user
      ...userFields,
    });

    // Save credentials in UserCredentials
    const schoolDetails = await AdminInfo.findOne({ schoolId: req.user.schoolId }).select("schoolName");
    await UserCredentials.create({
      userId: teacherId,
      email,
      password, // Store plain-text password
      userType: "teacher",
      schoolName: schoolDetails?.schoolName || "Your School",
      createdBy: req.user._id,
    });

    // Email sending logic (unchanged)
    const schoolImageUrl = schoolDetails?.image?.url || "https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg";
    const softwareLogoUrl = "https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png";
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
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; text-align: center;">
              <img src="${schoolImageUrl}" alt="${schoolDetails?.schoolName || 'Your School'}" style="max-width: 120px; height: auto; border-radius: 50%; border: 3px solid #fff; margin-bottom: 10px;" onerror="this.src='https://i.ibb.co/1Y1qz1g/school.webp';">
              <h1 style="color: #ffffff; font-size: 28px; font-weight: bold; margin: 0;">${schoolDetails?.schoolName || 'Your School'}</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 5px 0 0;">Welcome to Our Faculty!</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, Teacher!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">We’re thrilled to have you join ${schoolDetails?.schoolName || 'Your School'} as a teacher for session ${assignedSession}.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Credentials</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Employee ID:</strong> ${employeeId}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Teacher ID:</strong> ${teacherId}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Session:</strong> ${assignedSession}</p>
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Log in to start shaping young minds with us!</p>
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
    await sendEmail(email, "Teacher Login Credentials", emailContent);

    res.status(201).send({
      success: true,
      message: "Teacher created successfully",
      teacher: teacherData,
    });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Deactivate a teacher using teacherId
exports.deactivateTeacher = async (req, res) => {
  try {
    const { teacherId } = req.body;

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
    const { teacherId } = req.body;

    const teacher = await Teacher.findOne({
      teacherId,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    const newStatus = teacher.status === "active" ? "deactivated" : "active";

    const updatedTeacher = await Teacher.findOneAndUpdate(
      { teacherId, schoolId: req.user.schoolId, session: req.user.session },
      { $set: { status: newStatus } },
      { new: true }
    );

    const message =
      newStatus === "active"
        ? "Teacher has been reactivated"
        : "Teacher has been deactivated";

    res.json({
      success: true,
      message,
      teacher: updatedTeacher,
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
    const { teacherId } = req.params;
    const { session, ...updateFields } = req.body;
    const file = req.file;

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

    if (file) {
      const fileUri = getDataUri(file);
      const mycloud = await cloudinary.v2.uploader.upload(fileUri.content);
      existingTeacher.image = {
        public_id: mycloud.public_id,
        url: mycloud.secure_url,
      };
    }

    if (session) {
      existingTeacher.session = session;
    }

    for (const key in updateFields) {
      if (key !== "password") {
        existingTeacher[key] = updateFields[key];
      }
    }

    const updatedTeacher = await existingTeacher.save();

    // Update credentials if email or password is changed
    if (updateFields.email || updateFields.password) {
      const credential = await UserCredentials.findOne({
        userId: teacherId,
        userType: "teacher",
      });
      if (credential) {
        if (updateFields.email) credential.email = updateFields.email;
        if (updateFields.password) credential.password = updateFields.password; // Store plain-text password
        await credential.save();
      }
    }

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
    }).lean();

    const teacherIds = teachers.map((t) => t.teacherId);
    const credentials = await UserCredentials.find({
      userId: { $in: teacherIds },
      userType: "teacher",
    }).select("userId email password");

    const teachersWithCredentials = teachers.map((teacher) => {
      const cred = credentials.find((c) => c.userId === teacher.teacherId);
      return {
        ...teacher,
        email: cred ? cred.email : teacher.email,
        password: cred ? cred.password : undefined, // Plain-text password from UserCredentials
      };
    });

    res.status(200).json({ success: true, data: teachersWithCredentials });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// END OF TEACHER RELATED FLOW

// --------------------------------Fee Controller--------------------------------------\\

// Fix fee frequency for existing fees
exports.fixFeeFrequency = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    // Find all fees for this school and session
    const fees = await FeeStructure.find({ schoolId, session });

    let updatedCount = 0;
    let errors = [];

    for (const fee of fees) {
      try {
        const correctFrequency = getFrequencyFromFeeType(fee.feeType);

        // Check if frequency needs to be updated
        if (fee.frequency !== correctFrequency) {
          await FeeStructure.updateOne(
            { _id: fee._id },
            { $set: { frequency: correctFrequency } }
          );

          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating fee ${fee._id}:`, error);
        errors.push({ feeId: fee._id, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: "Fee frequency fix completed",
      data: {
        totalFeesProcessed: fees.length,
        feesUpdated: updatedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error("fixFeeFrequency:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Important utility function needed by both controllers
const getFrequencyFromFeeType = (feeType) => {
  switch (feeType.toLowerCase()) {
    case "one time":
      return "one-time";
    case "monthly":
      return "monthly";
    case "annual":
      return "annual";
    case "latefine":
      return "monthly"; // Assuming late fines are monthly by default
    default:
      return "monthly"; // fallback
  }
};

// Create a student-specific fee structure
// Fixed createStudentSpecificFee controller
exports.createStudentSpecificFee = async (req, res) => {
  try {
    const { studentId, feeType, amount, name } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    // Validations
    if (!schoolId || !session) {
      return res
        .status(400)
        .json({ success: false, message: "School ID and session required." });
    }
    if (!studentId) {
      return res
        .status(400)
        .json({ success: false, message: "Student ID is required." });
    }
    if (!feeType) {
      return res
        .status(400)
        .json({ success: false, message: "Fee type is required." });
    }
    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid fee amount is required." });
    }

    // Find the student to get their class
    const student = await NewStudentModel.findOne({
      studentId,
      schoolId,
      session,
    });
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: `Student ${studentId} not found.` });
    }

    // Check if a fee structure already exists for this student and fee type
    const additional = !!name; // If name is provided, it's an additional fee
    
    // Create the query to check for existing fee
    const existingFeeQuery = {
      schoolId,
      session,
      studentId,
      feeType,
      additional
    };
    
    // Only add name to query if it's an additional fee
    if (additional) {
      existingFeeQuery.name = name;
    }
    
    const exists = await FeeStructure.findOne(existingFeeQuery);
    
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Student‐specific fee for ${feeType}${
          name ? ` (${name})` : ""
        } already exists.`,
      });
    }

    // Create the fee structure object
    const feeStructureData = {
      schoolId,
      session,
      className: student.class, // Include class for reference
      feeType,
      frequency: getFrequencyFromFeeType(feeType),
      amount,
      additional,
      studentId, // This makes it student-specific
      updatedBy
    };
    
    // Only add name field if it has a value
    if (name) {
      feeStructureData.name = name;
    }
    
    const feeStructure = new FeeStructure(feeStructureData);
    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: "Student‐specific fee structure created.",
      data: feeStructure,
    });
  } catch (error) {
    console.error("createStudentSpecificFee:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

// Create a regular fee structure for a class
exports.createFeeStructure = async (req, res) => {
  try {
    const { className, feeType, amount } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res
        .status(400)
        .json({ success: false, message: "School ID and session required." });
    }
    if (!className) {
      return res
        .status(400)
        .json({ success: false, message: "Class name is required." });
    }
    if (!feeType || !amount || amount <= 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Fee type and valid amount required.",
        });
    }

    const exists = await FeeStructure.findOne({
      schoolId,
      session,
      className,
      feeType,
      additional: false,
    });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Regular fee for ${feeType} already exists on class ${className}.`,
      });
    }

    const feeStructure = new FeeStructure({
      schoolId,
      session,
      className,
      feeType,
      frequency: getFrequencyFromFeeType(feeType),
      amount,
      additional: false,
      updatedBy,
    });
    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: "Regular fee structure created.",
      data: feeStructure,
    });
  } catch (error) {
    console.error("createFeeStructure:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create an additional fee structure for a class
exports.createAdditionalFee = async (req, res) => {
  try {
    const { className, name, feeType, amount } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res
        .status(400)
        .json({ success: false, message: "School ID and session required." });
    }
    if (!className || !name || !feeType || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Class name, fee name, fee type, and valid amount are required.",
      });
    }

    const exists = await FeeStructure.findOne({
      schoolId,
      session,
      className,
      name,
      feeType,
      additional: true,
    });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Additional fee ${name} for ${feeType} already exists on class ${className}.`,
      });
    }

    const feeStructure = new FeeStructure({
      schoolId,
      session,
      className,
      name,
      feeType,
      frequency: getFrequencyFromFeeType(feeType),
      amount,
      additional: true,
      updatedBy,
    });
    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: "Additional fee structure created.",
      data: feeStructure,
    });
  } catch (error) {
    console.error("createAdditionalFee:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a late-fine fee structure
exports.createLateFineFee = async (req, res) => {
  try {
    const { className, amount, lateFineDueDay } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res
        .status(400)
        .json({ success: false, message: "School ID and session required." });
    }
    if (!className) {
      return res
        .status(400)
        .json({ success: false, message: "Class name is required." });
    }
    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid amount is required." });
    }
    if (!lateFineDueDay || lateFineDueDay < 1 || lateFineDueDay > 31) {
      return res
        .status(400)
        .json({ success: false, message: "Late-fine due day must be 1–31." });
    }

    const exists = await FeeStructure.findOne({
      schoolId,
      session,
      className,
      feeType: "LateFine",
      additional: true,
    });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Late-fine already exists for class ${className}.`,
      });
    }

    const feeStructure = new FeeStructure({
      schoolId,
      session,
      className,
      name: "Late Fine",
      feeType: "LateFine",
      frequency: getFrequencyFromFeeType("LateFine"),
      amount,
      additional: true,
      lateFineDueDay,
      updatedBy,
    });
    await feeStructure.save();

    res.status(201).json({
      success: true,
      message: "Late-fine fee structure created.",
      data: feeStructure,
    });
  } catch (error) {
    console.error("createLateFineFee:", error);
    res.status(500).json({ success: false, message: error.message });
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

// Get all fee structures (Regular + Additional + Late Fines) for a school
exports.getAllFees = async (req, res) => {
  try {
    const {
      className,
      includeLateFines = "true",
      onlyLateFines = "false",
    } = req.query;
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

    // If onlyLateFines is true, then immediately return only late fine fee structures.
    if (onlyLateFines === "true") {
      const lateFines = await FeeStructure.find({
        ...filter,
        additional: true,
        feeType: "LateFine",
      }).lean();

      return res.status(200).json({
        success: true,
        message: "Late fine fee structures fetched successfully",
        data: lateFines,
      });
    }

    // Fetch regular fees
    const regularFees = await FeeStructure.find({
      ...filter,
      additional: false,
    }).lean();

    // Fetch additional fees excluding late fines
    const additionalFees = await FeeStructure.find({
      ...filter,
      additional: true,
      feeType: { $ne: "LateFine" },
    }).lean();

    let lateFines = [];
    if (includeLateFines === "true") {
      lateFines = await FeeStructure.find({
        ...filter,
        additional: true,
        feeType: "LateFine",
      }).lean();
    }

    const allFees = [...regularFees, ...additionalFees, ...lateFines];

    res.status(200).json({
      success: true,
      message: "All fee structures fetched successfully",
      data: allFees,
    });
  } catch (error) {
    console.error("Error in getAllFees:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update a fee structure using feeStructureId
exports.updateFees = async (req, res) => {
  try {
    const { feeStructureId } = req.params;
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
    if (!feeStructureId) {
      return res.status(400).json({
        success: false,
        message: "Fee structure ID is required in the URL parameter.",
      });
    }

    // Fetch the existing fee structure to check its type
    const existingFee = await FeeStructure.findOne({
      feeStructureId,
      schoolId,
      session,
    });
    if (!existingFee) {
      return res.status(404).json({
        success: false,
        message:
          "Fee structure not found or does not belong to this school and session.",
      });
    }

    // Additional validation for late fines
    if (existingFee.feeType === "LateFine") {
      if (updateData.amount !== undefined && updateData.amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid late fine amount is required.",
        });
      }
      if (
        updateData.lateFineDueDay !== undefined &&
        (updateData.lateFineDueDay < 1 || updateData.lateFineDueDay > 31)
      ) {
        return res.status(400).json({
          success: false,
          message: "Late fine due day must be between 1 and 31.",
        });
      }
    }

    const feeStructure = await FeeStructure.findOneAndUpdate(
      { feeStructureId, schoolId, session },
      { $set: { ...updateData, updatedBy, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Fee structure updated successfully",
      data: feeStructure,
    });
  } catch (error) {
    console.error("Error in updateFees:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
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

    const feeStructure = await FeeStructure.findOne({
      feeStructureId,
      schoolId,
      session,
    });
    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message:
          "Fee structure not found or does not belong to this school and session.",
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
    if (additional !== undefined) query.additional = additional === "true";
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

// Edit a late fine fee structure using feeStructureId
exports.editLateFineFee = async (req, res) => {
  try {
    const { feeStructureId } = req.params;
    const { amount, lateFineDueDay } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

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
    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid late fine amount is required.",
      });
    }
    if (
      lateFineDueDay !== undefined &&
      (lateFineDueDay < 1 || lateFineDueDay > 31)
    ) {
      return res.status(400).json({
        success: false,
        message: "Late fine due day must be between 1 and 31.",
      });
    }

    const feeStructure = await FeeStructure.findOne({
      feeStructureId,
      schoolId,
      session,
      feeType: "LateFine",
      additional: true,
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message:
          "Late fine fee structure not found or does not belong to this school and session.",
      });
    }

    const updateData = {};
    if (amount !== undefined) updateData.amount = amount;
    if (lateFineDueDay !== undefined)
      updateData.lateFineDueDay = lateFineDueDay;
    updateData.updatedBy = updatedBy;
    updateData.updatedAt = new Date();

    const updatedFeeStructure = await FeeStructure.findOneAndUpdate(
      { feeStructureId, schoolId, session },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Late fine fee structure updated successfully",
      data: updatedFeeStructure,
    });
  } catch (error) {
    console.error("Error in editLateFineFee:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update late fine fee structure",
      error: error.message,
    });
  }
};

// Bulk create fee structures (Regular, Additional, Student-Specific)
exports.bulkCreateFees = async (req, res) => {
  try {
    const { fees } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res
        .status(400)
        .json({ success: false, message: "School ID and session required." });
    }
    if (!Array.isArray(fees) || !fees.length) {
      return res
        .status(400)
        .json({ success: false, message: "Fees array cannot be empty." });
    }

    const created = [];
    const errors = [];

    for (const f of fees) {
      const { className, studentId, feeType, amount, name, lateFineDueDay } = f;
      if (!feeType || !amount || amount <= 0) {
        errors.push({ fee: f, message: "Invalid feeType or amount." });
        continue;
      }

      // Get frequency based on feeType
      const frequency = getFrequencyFromFeeType(feeType);

      const base = {
        schoolId,
        session,
        feeType,
        frequency, // Now correctly determined from feeType
        amount,
        additional: !!name,
        updatedBy,
      };

      if (studentId) {
        const student = await NewStudentModel.findOne({
          studentId,
          schoolId,
          session,
        });
        if (!student) {
          errors.push({ fee: f, message: `Student ${studentId} not found.` });
          continue;
        }

        const doc = new FeeStructure({
          ...base,
          className: student.class,
          studentId,
          name: name || undefined,
        });
        await doc.save();
        created.push(doc);
      } else {
        if (!className) {
          errors.push({ fee: f, message: "className is required." });
          continue;
        }

        const doc = new FeeStructure({
          ...base,
          className,
          name: name || undefined,
          ...(lateFineDueDay ? { lateFineDueDay } : {}),
        });
        await doc.save();
        created.push(doc);
      }
    }

    res.status(201).json({
      success: true,
      message: "Bulk fee creation processed.",
      data: created,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("bulkCreateFees:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk edit fee structures
exports.bulkEditFees = async (req, res) => {
  try {
    const { fees } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }

    if (!Array.isArray(fees) || fees.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Fees array is required and cannot be empty.",
      });
    }

    const updatedFees = [];
    const errors = [];

    for (const fee of fees) {
      const { feeStructureId, feeType, amount, lateFineDueDay } = fee;

      if (!feeStructureId) {
        errors.push({ fee, message: "Fee structure ID is required." });
        continue;
      }

      const existingFee = await FeeStructure.findOne({
        feeStructureId,
        schoolId,
        session,
      });

      if (!existingFee) {
        errors.push({
          fee,
          message: `Fee structure with ID ${feeStructureId} not found.`,
        });
        continue;
      }

      // Validate updates
      if (amount !== undefined && amount <= 0) {
        errors.push({ fee, message: "Valid amount is required." });
        continue;
      }

      if (existingFee.feeType === "LateFine" && lateFineDueDay !== undefined) {
        if (lateFineDueDay < 1 || lateFineDueDay > 31) {
          errors.push({
            fee,
            message: "Late fine due day must be between 1 and 31.",
          });
          continue;
        }
      }

      const updateData = {};
      if (amount !== undefined) updateData.amount = amount;
      if (lateFineDueDay !== undefined)
        updateData.lateFineDueDay = lateFineDueDay;

      // Update frequency if feeType is changed
      if (feeType !== undefined && feeType !== existingFee.feeType) {
        updateData.feeType = feeType;
        updateData.frequency = getFrequencyFromFeeType(feeType);
      }

      updateData.updatedBy = updatedBy;
      updateData.updatedAt = new Date();

      const updatedFee = await FeeStructure.findOneAndUpdate(
        { feeStructureId, schoolId, session },
        { $set: updateData },
        { new: true, runValidators: true }
      );

      updatedFees.push(updatedFee);
    }

    res.status(200).json({
      success: true,
      message: "Bulk fee edit processed.",
      data: updatedFees,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in bulkEditFees:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process bulk fee edit.",
      error: error.message,
    });
  }
};

// --------------------------------Book Controller

// Create a Book Details for a class

exports.createBookDetails = async (req, res) => {
  try {
    const { bookName, authorName, quantity, category, className, subject } =
      req.body;
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
    const { bookId, bookName, authorName, category, className, subject } =
      req.query;

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
        message:
          "Book not found or does not belong to this school and session.",
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
        message:
          "Book not found or does not belong to this school and session.",
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

    const itemExist = await ItemModel.findOne({
      schoolId,
      session,
      itemName,
      category,
    });
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
    const { quantitySold, studentId } = req.body;
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
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required.",
      });
    }

    const item = await ItemModel.findOne({ itemId, schoolId, session });
    if (!item) {
      return res.status(404).json({
        success: false,
        message:
          "Item not found or does not belong to this school and session.",
      });
    }

    if (item.quantity < quantitySold) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock to sell.",
      });
    }

    const totalAmount = quantitySold * item.price;
    const receiptId = `REC-${Date.now()}`;
    const sale = await SellInventory.create({
      schoolId,
      studentId,
      receiptId,
      items: [
        {
          itemId,
          itemName: item.itemName,
          category: item.category,
          price: item.price,
          sellQuantity: quantitySold,
          sellAmount: totalAmount,
        },
      ],
      totalAmount,
      dueAmount: 0, // Assuming full payment for single sale
      saleDate: new Date(),
      session,
    });

    await ReceiptModel.create({
      receiptId,
      saleId: sale._id,
      studentId,
      itemsSold: [
        {
          itemName: item.itemName,
          sellQuantity: quantitySold,
          sellAmount: totalAmount,
        },
      ],
      totalAmount,
      dueAmount: 0,
      paymentStatus: "Paid",
    });

    item.quantity -= quantitySold;
    item.sellQuantity += quantitySold;
    item.sellAmount += totalAmount;
    item.updatedBy = updatedBy;
    item.updatedAt = new Date();
    await item.save();

    res.status(200).json({
      success: true,
      message: "Item sold successfully",
      sale,
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

exports.multiSellItem = async (req, res) => {
  try {
    const { items, studentId, totalAmount, dueAmount = 0 } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!studentId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Student ID and valid items array are required.",
      });
    }

    // Check stock availability
    for (const { itemId, sellQuantity } of items) {
      const item = await ItemModel.findOne({ itemId, schoolId, session });
      if (!item || item.quantity < sellQuantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for item ${item?.itemName || itemId}`,
        });
      }
    }

    const receiptId = `REC-${Date.now()}`;

    // Fetch item details asynchronously
    const itemDetailsPromises = items.map(async (item) => {
      const dbItem = await ItemModel.findOne({ itemId: item.itemId });
      return {
        itemId: item.itemId,
        itemName: dbItem.itemName,
        category: dbItem.category,
        price: dbItem.price,
        sellQuantity: item.sellQuantity,
        sellAmount: item.sellQuantity * dbItem.price,
      };
    });
    const saleItems = await Promise.all(itemDetailsPromises);

    const sale = await SellInventory.create({
      schoolId,
      studentId,
      receiptId,
      items: saleItems,
      totalAmount,
      dueAmount,
      saleDate: new Date(),
      session,
    });

    // Fetch item details for receipt
    const itemsSoldPromises = items.map(async (item) => {
      const dbItem = await ItemModel.findOne({ itemId: item.itemId });
      return {
        itemName: dbItem.itemName,
        sellQuantity: item.sellQuantity,
        sellAmount: item.sellQuantity * dbItem.price,
      };
    });
    const soldItems = await Promise.all(itemsSoldPromises);

    await ReceiptModel.create({
      receiptId,
      saleId: sale._id,
      studentId,
      itemsSold: soldItems,
      totalAmount,
      dueAmount,
      paymentStatus: dueAmount > 0 ? "Pending" : "Paid",
    });

    // Update item quantities
    for (const { itemId, sellQuantity } of items) {
      const item = await ItemModel.findOne({ itemId, schoolId, session });
      item.quantity -= sellQuantity;
      item.sellQuantity += sellQuantity;
      item.sellAmount += sellQuantity * item.price;
      item.updatedBy = updatedBy;
      item.updatedAt = new Date();
      await item.save();
    }

    res.status(200).json({
      success: true,
      message: "Multi-item sale recorded successfully",
      sale,
    });
  } catch (error) {
    console.error("Error in multiSellItem:", error);
    res.status(500).json({
      success: false,
      message: "Multi-item sale failed due to error",
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
        message:
          "Item not found or does not belong to this school and session.",
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
        message:
          "Item not found or does not belong to this school and session.",
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

// NEW INVENTORY

exports.createItem = async (req, res) => {
  try {
    const { itemName, category, quantity, price, icon, color } = req.body;
    const { schoolId, session, _id: updatedBy } = req.user;

    if (!schoolId || !session)
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    if (!itemName || !category || !quantity || !price)
      return res
        .status(400)
        .json({ success: false, message: "All fields are required." });

    const itemExist = await ItemModel.findOne({
      schoolId,
      session,
      itemName,
      category,
    });
    if (itemExist)
      return res
        .status(400)
        .json({ success: false, message: "Item already exists." });

    const item = new ItemModel({
      schoolId,
      session,
      itemName,
      category,
      quantity,
      price,
      icon: icon || "🛒",
      color: color || "#000000",
      updatedBy,
    });
    await item.save();

    res
      .status(201)
      .json({ success: true, message: "Item created", data: item });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating item",
      error: error.message,
    });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { itemName, category, quantity, price, icon, color } = req.body;
    const { _id: updatedBy } = req.user;

    if (!itemName || !category || !quantity || !price) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required." });
    }

    const item = await ItemModel.findOne({ itemId });

    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found." });
    }

    const duplicate = await ItemModel.findOne({
      itemId: { $ne: itemId },
      schoolId: item.schoolId,
      session: item.session,
      itemName,
      category,
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: "Another item with the same name and category exists.",
      });
    }

    item.itemName = itemName;
    item.category = category;
    item.quantity = quantity;
    item.price = price;
    item.icon = icon || item.icon;
    item.color = color || item.color;
    item.updatedBy = updatedBy;

    await item.save();

    res.json({ success: true, message: "Item updated successfully", data: item });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating item",
      error: error.message,
    });
  }
};

exports.createPurchaseOrder = async (req, res) => {
  try {
    const { items, supplierId, expectedDeliveryDate } = req.body; // Updated from supplier to supplierId
    const { schoolId, session, _id: updatedBy } = req.user;

    if (!schoolId || !session)
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    if (!items || !supplierId)
      return res
        .status(400)
        .json({ success: false, message: "Items and supplier ID are required." });

    let totalCost = 0;
    for (let item of items) {
      const inventoryItem = await ItemModel.findOne({
        itemId: item.itemId,
        schoolId,
        session,
      });
      if (!inventoryItem)
        return res
          .status(404)
          .json({ success: false, message: `Item ${item.itemId} not found.` });
      item.itemName = inventoryItem.itemName;
      item.category = inventoryItem.category;
      item.totalCost = item.quantity * item.price;
      totalCost += item.totalCost;
    }

    const purchaseOrder = new PurchaseOrder({
      schoolId,
      session,
      items,
      supplierId, // Updated from supplier to supplierId
      totalCost,
      expectedDeliveryDate,
      updatedBy,
    });
    await purchaseOrder.save();

    res.status(201).json({
      success: true,
      message: "Purchase order created",
      data: purchaseOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating purchase order",
      error: error.message,
    });
  }
};


exports.getPurchaseOrders = async (req, res) => {
  try {
    const { schoolId, session } = req.user;
    const purchaseOrders = await PurchaseOrder.find({ schoolId, session });
    res.status(200).json({ success: true, message: "Purchase orders fetched", data: purchaseOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching purchase orders", error: error.message });
  }
};




exports.receivePurchaseOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { schoolId, session, _id: updatedBy } = req.user;

    const order = await PurchaseOrder.findOne({
      _id: orderId,
      schoolId,
      session,
      status: "ordered",
    });
    if (!order)
      return res.status(404).json({
        success: false,
        message: "Order not found or already received.",
      });

    for (let item of order.items) {
      await ItemModel.findOneAndUpdate(
        { itemId: item.itemId, schoolId, session },
        {
          $inc: {
            quantity: item.quantity,
            purchaseQuantity: item.quantity,
            purchaseCost: item.totalCost,
          },
          updatedBy,
          updatedAt: new Date(),
        }
      );
    }
    order.status = "received";
    order.receivedDate = new Date();
    order.updatedBy = updatedBy;
    order.updatedAt = new Date();
    await order.save();

    res
      .status(200)
      .json({ success: true, message: "Order received", data: order });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error receiving order",
      error: error.message,
    });
  }
};

exports.createSale = async (req, res) => {
  try {
    const { studentId, items, paymentStatus, paidAmount, paymentMode } = req.body;
    const { schoolId, session, _id: updatedBy } = req.user;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    }
    if (!studentId || !items) {
      return res.status(400).json({
        success: false,
        message: "Student ID and items are required.",
      });
    }
    if (paidAmount > 0 && !paymentMode) {
      return res.status(400).json({
        success: false,
        message: "Payment mode is required when paid amount is provided.",
      });
    }

    const studentResponse = await axios.get(
      `https://api.digitalvidyasaarthi.in/api/v1/adminRoute/studentparent?studentId=${studentId}`,
      {
        headers: {
          Authorization: `Bearer ${req.headers.authorization.split(" ")[1]}`,
        },
      }
    );
    if (!studentResponse.data.success) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    let totalAmount = 0;
    for (let item of items) {
      const inventoryItem = await ItemModel.findOne({
        itemId: item.itemId,
        schoolId,
        session,
      }).lean();
      if (!inventoryItem) {
        return res.status(404).json({
          success: false,
          message: `Item ${item.itemId} not found.`,
        });
      }
      if (inventoryItem.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${inventoryItem.itemName}.`,
        });
      }
      item.itemName = inventoryItem.itemName;
      item.category = inventoryItem.category;
      item.price = inventoryItem.price;
      item.total = item.quantity * inventoryItem.price;
      totalAmount += item.total;
    }

    const dueAmount =
      paymentStatus === "paid" ? 0 : totalAmount - (paidAmount || 0);
    if (paymentStatus === "paid" && paidAmount < totalAmount) {
      return res.status(400).json({
        success: false,
        message: "Paid amount insufficient for paid status.",
      });
    }

    let counter = await Counter.findOneAndUpdate(
      { schoolId, session },
      { $inc: { sequence: 1 } },
      { upsert: true, new: true }
    );
    let saleNumber = counter.sequence;
    if (saleNumber > 9999) {
      return res.status(400).json({
        success: false,
        message: "Sale number limit reached for this school and session.",
      });
    }

    const sale = new Sale({
      saleNumber,
      schoolId,
      session,
      studentId,
      items,
      totalAmount,
      paymentStatus,
      paidAmount: paidAmount || 0,
      dueAmount: dueAmount,
      updatedBy,
      paymentMode,
      paymentHistory: paidAmount
        ? [{ amount: paidAmount, date: new Date(), updatedBy, paymentMode }]
        : [],
    });
    await sale.save();

    for (let item of items) {
      await ItemModel.updateOne(
        { itemId: item.itemId, schoolId, session },
        {
          $inc: {
            quantity: -item.quantity,
            sellQuantity: item.quantity,
            sellAmount: item.total,
          },
          updatedBy,
          updatedAt: new Date(),
        }
      );
    }

    let receipt = null;
    try {
      let studentName = studentResponse.data.students?.data[0]?.studentName || "Unknown";
      const receiptData = {
        receiptId: sale.receiptId,
        saleNumber: sale.saleNumber,
        studentName,
        date: sale.date,
        items: sale.items.map((item) => ({
          itemName: item.itemName,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
        totalAmount: sale.totalAmount,
        paidAmount: sale.paidAmount,
        dueAmount: sale.dueAmount,
        paymentStatus: sale.paymentStatus,
        paymentMode: sale.paymentMode,
        paymentHistory: sale.paymentHistory,
      };

      await ReceiptModel.updateOne(
        { saleNumber: sale.saleNumber },
        {
          receiptId: receiptData.receiptId,
          saleNumber: sale.saleNumber,
          studentId: sale.studentId,
          itemsSold: receiptData.items,
          totalAmount: receiptData.totalAmount,
          dueAmount: receiptData.dueAmount,
          paymentStatus: receiptData.paymentStatus,
          paymentMode: receiptData.paymentMode,
          paymentHistory: receiptData.paymentHistory,
        },
        { upsert: true }
      );

      receipt = receiptData;
    } catch (receiptError) {
      console.error("Error generating receipt:", receiptError.message);
    }

    res.status(201).json({
      success: true,
      message:
        "Sale created" +
        (receipt ? " and receipt generated" : ", receipt generation failed"),
      data: { sale },
      receipt,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating sale",
      error: error.message,
    });
  }
};

exports.payDuesAndAddSale = async (req, res) => {
  try {
    const { saleNumber, paymentAmount = 0, newItems = [] } = req.body;
    const { schoolId, session, _id: updatedBy } = req.user;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    }
    if (!saleNumber) {
      return res.status(400).json({
        success: false,
        message: "Sale number is required.",
      });
    }
    if (paymentAmount === 0 && newItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Either payment amount or new items must be provided.",
      });
    }

    if (paymentAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount cannot be negative.",
      });
    }

    const sale = await Sale.findOne({ saleNumber, schoolId, session });
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found.",
      });
    }

    let studentName = "Unknown";
    try {
      const studentResponse = await axios.get(
        `https://api.digitalvidyasaarthi.in/api/v1/adminRoute/studentparent?studentId=${sale.studentId}`,
        {
          headers: {
            Authorization: `Bearer ${req.headers.authorization.split(" ")[1]}`,
          },
        }
      );
      if (studentResponse.data.success) {
        studentName =
          studentResponse.data.students?.data[0]?.studentName || "Unknown";
      } else {
        console.warn(
          "Student API response invalid or failed:",
          studentResponse.data
        );
      }
    } catch (studentError) {
      console.error("Error fetching student data:", studentError.message);
    }

    let totalNewAmount = 0;
    let updatedItems = [...sale.items];
    const updatedPaymentHistory = [...(sale.paymentHistory || [])];

    if (newItems.length > 0) {
      for (let item of newItems) {
        if (!item.itemId || !item.quantity || item.quantity <= 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid item data: itemId and positive quantity are required.`,
          });
        }

        const inventoryItem = await ItemModel.findOne({
          itemId: item.itemId,
          schoolId,
          session,
        });
        if (!inventoryItem) {
          return res.status(404).json({
            success: false,
            message: `Item ${item.itemId} not found.`,
          });
        }
        if (inventoryItem.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${inventoryItem.itemName}.`,
          });
        }

        const itemTotal = item.quantity * inventoryItem.price;
        updatedItems.push({
          itemId: item.itemId,
          itemName: inventoryItem.itemName,
          category: inventoryItem.category,
          quantity: item.quantity,
          price: inventoryItem.price,
          total: itemTotal,
          icon: inventoryItem.icon,
          color: inventoryItem.color,
        });
        totalNewAmount += itemTotal;

        await ItemModel.findOneAndUpdate(
          { itemId: item.itemId, schoolId, session },
          {
            $inc: {
              quantity: -item.quantity,
              sellQuantity: item.quantity,
              sellAmount: itemTotal,
            },
            updatedBy,
            updatedAt: new Date(),
          }
        );
      }
    }

    const updatedTotalAmount = sale.totalAmount + totalNewAmount;
    const updatedPaidAmount = sale.paidAmount + paymentAmount;
    const updatedDueAmount = updatedTotalAmount - updatedPaidAmount;

    if (paymentAmount > 0) {
      if (paymentAmount > sale.dueAmount + totalNewAmount) {
        return res.status(400).json({
          success: false,
          message: `Payment amount (${paymentAmount}) exceeds total due amount (${
            sale.dueAmount + totalNewAmount
          }).`,
        });
      }
      updatedPaymentHistory.push({
        amount: paymentAmount,
        date: new Date(),
        updatedBy,
      });
    }

    if (updatedDueAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Total paid amount exceeds total sale amount.",
      });
    }

    const updatedPaymentStatus = updatedDueAmount === 0 ? "paid" : "pending";

    sale.items = updatedItems;
    sale.totalAmount = updatedTotalAmount;
    sale.paidAmount = updatedPaidAmount;
    sale.dueAmount = updatedDueAmount;
    sale.paymentStatus = updatedPaymentStatus;
    sale.paymentHistory = updatedPaymentHistory;
    sale.updatedBy = updatedBy;
    sale.updatedAt = new Date();
    await sale.save();

    const receiptData = {
      receiptId: sale.receiptId,
      saleNumber: sale.saleNumber,
      studentName,
      date: sale.date,
      items: sale.items.map((item) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
      totalAmount: sale.totalAmount,
      paidAmount: sale.paidAmount,
      dueAmount: sale.dueAmount,
      paymentStatus: sale.paymentStatus,
      paymentHistory: sale.paymentHistory,
    };

    await ReceiptModel.findOneAndUpdate(
      { saleNumber: sale.saleNumber },
      {
        receiptId: receiptData.receiptId,
        saleNumber: sale.saleNumber,
        studentId: sale.studentId,
        itemsSold: receiptData.items,
        totalAmount: receiptData.totalAmount,
        dueAmount: receiptData.dueAmount,
        paymentStatus: receiptData.paymentStatus,
        paymentHistory: receiptData.paymentHistory,
      },
      { upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Dues paid and/or new sale added, receipt updated",
      data: { sale },
      receipt: receiptData,
    });
  } catch (error) {
    console.error("Error in payDuesAndAddSale:", error.message);
    res.status(500).json({
      success: false,
      message: "Error processing dues payment or new sale",
      error: error.message,
    });
  }
};

exports.processReturn = async (req, res) => {
  try {
    const { saleNumber, items, reason } = req.body;
    const { schoolId, session, _id: updatedBy } = req.user;

    if (!schoolId || !session)
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    if (!saleNumber || !items)
      return res
        .status(400)
        .json({ success: false, message: "Sale number and items are required." });

    const sale = await Sale.findOne({ saleNumber, schoolId, session });
    if (!sale)
      return res
        .status(404)
        .json({ success: false, message: "Sale not found." });

    let totalAmount = 0;
    for (let item of items) {
      const saleItem = sale.items.find((i) => i.itemId === item.itemId);
      if (!saleItem || saleItem.quantity < item.quantity)
        return res.status(400).json({
          success: false,
          message: `Invalid return quantity for ${item.itemId}.`,
        });
      item.itemName = saleItem.itemName;
      item.category = saleItem.category;
      item.price = saleItem.price;
      item.total = item.quantity * saleItem.price;
      totalAmount += item.total;
    }

    const returnRecord = new Return({
      schoolId,
      session,
      saleNumber,
      studentId: sale.studentId,
      items,
      totalAmount,
      reason,
      updatedBy,
    });
    await returnRecord.save();

    for (let item of items) {
      await ItemModel.findOneAndUpdate(
        { itemId: item.itemId, schoolId, session },
        {
          $inc: {
            quantity: item.quantity,
            sellQuantity: -item.quantity,
            sellAmount: -item.total,
          },
          updatedBy,
          updatedAt: new Date(),
        }
      );
      await Sale.findOneAndUpdate(
        { saleNumber },
        { $inc: { dueAmount: -item.total }, updatedBy, updatedAt: new Date() }
      );
    }

    res
      .status(201)
      .json({ success: true, message: "Return processed", data: returnRecord });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error processing return",
      error: error.message,
    });
  }
};

exports.getInventoryStats = async (req, res) => {
  try {
    const { schoolId, session } = req.user;
    const { period = "month", lowStockThreshold = 5 } = req.query;

    if (!schoolId || !session)
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });

    const match = { schoolId, session };
    const dateFilter = {};
    const now = new Date();
    if (period === "day") dateFilter.$gte = new Date(now.setHours(0, 0, 0, 0));
    else if (period === "month") dateFilter.$gte = new Date(now.setDate(1));
    else if (period === "year") dateFilter.$gte = new Date(now.setMonth(0, 1));

    const totalQuantity = await ItemModel.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);
    const totalItemsSold = await Sale.aggregate([
      { $match: { ...match, date: dateFilter } },
      { $unwind: "$items" },
      { $group: { _id: null, total: { $sum: "$items.quantity" } } },
    ]);
    const totalRevenue = await Sale.aggregate([
      { $match: { ...match, date: dateFilter } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);
    const avgOrderValue = await Sale.aggregate([
      { $match: { ...match, date: dateFilter } },
      { $group: { _id: null, avg: { $avg: "$totalAmount" } } },
    ]);
    const lowStockThresholdNum = parseInt(lowStockThreshold, 10);
    const lowStockItems = await ItemModel.find({
      ...match,
      quantity: { $lt: 25 },
    }).lean();
    const totalCategories = await ItemModel.distinct("category", match);
    const topSellingItems = await Sale.aggregate([
      { $match: { ...match, date: dateFilter } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemId",
          totalSold: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 3 },
      {
        $lookup: {
          from: "itemmodels",
          localField: "_id",
          foreignField: "itemId",
          as: "itemDetails",
        },
      },
      { $unwind: "$itemDetails" },
      {
        $project: {
          itemId: "$_id",
          itemName: "$itemDetails.itemName",
          category: "$itemDetails.category",
          totalSold: 1,
          icon: "$itemDetails.icon",
          color: "$itemDetails.color",
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: "Inventory statistics fetched",
      stats: {
        totalQuantity: totalQuantity[0]?.total || 0,
        totalItemsSold: totalItemsSold[0]?.total || 0,
        totalRevenue: totalRevenue[0]?.total || 0,
        avgOrderValue: avgOrderValue[0]?.avg || 0,
        lowStockItems,
        totalCategories: totalCategories.length,
        topSellingItems,
        period,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching stats",
      error: error.message,
    });
  }
};

exports.getAllSales = async (req, res) => {
  try {
    const { schoolId, session } = req.user;
    const {
      dateStart,
      dateEnd,
      specificDate,
      search,
      saleNumber,
      studentId,
      paymentStatus,
      page = 1,
      limit = 50,
    } = req.query;

    if (!schoolId || !session)
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });

    const query = { 
      schoolId, 
      session,
      saleNumber: { $ne: null },
      totalAmount: { $ne: null },
    };

    // Date filters
    if (specificDate) {
      const startOfDay = new Date(specificDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(specificDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (dateStart || dateEnd) {
      query.date = {};
      if (dateStart) query.date.$gte = new Date(dateStart);
      if (dateEnd) query.date.$lte = new Date(dateEnd);
    }

    if (saleNumber) query.saleNumber = Number(saleNumber);
    if (studentId) query.studentId = studentId;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const sales = await Sale.find(query)
      .select('saleNumber date totalAmount paidAmount dueAmount paymentStatus studentId')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const totalSales = await Sale.countDocuments(query);
    const salesWithDues = await Sale.countDocuments({
      ...query,
      paymentStatus: "pending",
      dueAmount: { $gt: 0 },
    });

    res.status(200).json({
      success: true,
      message: "Sales fetched",
      counts: {
        totalSales,
        salesWithDues,
        salesWithoutDues: totalSales - salesWithDues,
      },
      sales: sales.map(sale => ({
        ...sale,
        saleNumber: sale.saleNumber || 0,
        date: sale.date || new Date(),
        totalAmount: sale.totalAmount || 0,
        paidAmount: sale.paidAmount || 0,
        dueAmount: sale.dueAmount || 0,
        paymentStatus: sale.paymentStatus || 'pending',
      })),
      pagination: {
        total: totalSales,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalSales / limit),
      },
    });
  } catch (error) {
    console.error('Error in getAllSales:', error);
    res.status(500).json({
      success: false,
      message: "Error fetching sales",
      error: error.message,
    });
  }
};

exports.generateReceipt = async (req, res) => {
  try {
    const { saleNumber } = req.params;
    const { schoolId, session } = req.user;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!saleNumber) {
      return res.status(400).json({
        success: false,
        message: "Sale number is required in the URL parameter.",
      });
    }

    const sale = await Sale.findOne({ saleNumber, schoolId, session });
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found or does not belong to this school and session.",
      });
    }

    let studentName = "Unknown";
    let studentId = sale.studentId;
    let studentClass = "N/A";
    let section = "N/A";
    try {
      const studentResponse = await axios.get(
        `https://api.digitalvidyasaarthi.in/api/v1/adminRoute/studentparent?studentId=${sale.studentId}`,
        {
          headers: {
            Authorization: `Bearer ${req.headers.authorization.split(" ")[1]}`,
          },
        }
      );
      // console.log("Student API response:", studentResponse.data); // Debug log
      if (studentResponse.data && studentResponse.data.success) {
        const studentData = studentResponse.data.student || {};
        studentName = studentData.studentName || "Unknown";
        studentId = studentData.studentId || sale.studentId;
        studentClass = studentData.class || "N/A";
        section = studentData.section || "N/A";
      } else {
        console.warn(
          "Student API response invalid or failed:",
          studentResponse.data
        );
      }
    } catch (studentError) {
      console.error("Error fetching student data:", studentError.message);
    }

    const receiptData = {
      receiptId: sale.receiptId,
      saleNumber: sale.saleNumber,
      studentName,
      studentId,
      class: studentClass,
      section,
      date: sale.date,
      items: sale.items.map((item) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
      totalAmount: sale.totalAmount,
      paidAmount: sale.paidAmount,
      paymentMode: sale.paymentMode,
      dueAmount: sale.dueAmount,
      paymentStatus: sale.paymentStatus,
      paymentHistory: sale.paymentHistory,
    };

    await ReceiptModel.findOneAndUpdate(
      { saleNumber: sale.saleNumber },
      {
        receiptId: receiptData.receiptId,
        saleNumber: sale.saleNumber,
        studentId: sale.studentId,
        itemsSold: receiptData.items,
        totalAmount: receiptData.totalAmount,
        dueAmount: receiptData.dueAmount,
        paymentStatus: receiptData.paymentStatus,
        paymentHistory: receiptData.paymentHistory,
      },
      { upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Receipt generated successfully",
      receipt: receiptData,
    });
  } catch (error) {
    console.error("Error in generateReceipt:", error);
    res.status(500).json({
      success: false,
      message: "Receipt generation failed due to error",
      error: error.message,
    });
  }
};

// const axios = require('axios');

exports.getStudentsWithDues = async (req, res) => {
  try {
    const { schoolId, session } = req.user;
    const { page = 1, limit = 10 } = req.query;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: 'School ID and session are required.',
      });
    }

    // Optimized aggregation pipeline
    const salesWithDues = await Sale.aggregate([
      {
        $match: {
          schoolId,
          session,
          paymentStatus: { $ne: 'paid' },
          dueAmount: { $gt: 0 },
          saleNumber: { $ne: null },
          totalAmount: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$studentId',
          totalDue: { $sum: '$dueAmount' },
          sales: {
            $push: {
              saleNumber: { $ifNull: ['$saleNumber', 0] },
              date: { $ifNull: ['$date', new Date()] },
              totalAmount: { $ifNull: ['$totalAmount', 0] },
              paidAmount: { $ifNull: ['$paidAmount', 0] },
              dueAmount: { $ifNull: ['$dueAmount', 0] },
              paymentStatus: { $ifNull: ['$paymentStatus', 'pending'] },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'newstudentmodels', // Matches NewStudentModel collection
          localField: '_id',
          foreignField: 'studentId',
          as: 'studentDetails',
        },
      },
      {
        $unwind: {
          path: '$studentDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          studentId: '$_id',
          studentName: { $ifNull: ['$studentDetails.studentName', 'Unknown'] },
          class: { $ifNull: ['$studentDetails.class', 'N/A'] },
          section: { $ifNull: ['$studentDetails.section', 'N/A'] },
          admissionNumber: { $ifNull: ['$studentDetails.admissionNumber', 'N/A'] },
          totalDue: 1,
          sales: 1,
        },
      },
      { $sort: { totalDue: -1 } },
      {
        $facet: {
          paginatedResults: [
            { $skip: (parseInt(page) - 1) * parseInt(limit) },
            { $limit: parseInt(limit) },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ]);

    const studentsWithDues = salesWithDues[0].paginatedResults;
    const total = salesWithDues[0].totalCount[0]?.count || 0;

    // Batch fetch student details if needed
    const studentsToFetch = studentsWithDues
      .filter(student => student.studentName === 'Unknown')
      .map(student => student.studentId);

    if (studentsToFetch.length > 0) {
      try {
        const studentResponse = await axios.post(
          'https://api.digitalvidyasaarthi.in/api/v1/adminRoute/studentparent/batch',
          { studentIds: studentsToFetch },
          {
            headers: {
              Authorization: `Bearer ${req.headers.authorization.split(' ')[1]}`,
            },
            timeout: 10000,
          }
        ).catch(async error => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return axios.post(
            'https://api.digitalvidyasaarthi.in/api/v1/adminRoute/studentparent/batch',
            { studentIds: studentsToFetch },
            {
              headers: {
                Authorization: `Bearer ${req.headers.authorization.split(' ')[1]}`,
              },
              timeout: 10000,
            }
          );
        });

        if (studentResponse.data.success) {
          const studentDataMap = new Map(
            studentResponse.data.students?.data.map(s => [s.studentId, s]) || []
          );
          for (let student of studentsWithDues) {
            if (student.studentName === 'Unknown') {
              const studentData = studentDataMap.get(student.studentId) || {};
              student.studentName = studentData.studentName || 'Unknown';
              student.class = studentData.class || 'N/A';
              student.section = studentData.section || 'N/A';
              student.admissionNumber = studentData.admissionNumber || 'N/A';
            }
          }
        }
      } catch (studentError) {
        console.error('Error fetching batch student details:', studentError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Students with dues fetched',
      students: studentsWithDues,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error in getStudentsWithDues:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students with dues',
      error: error.message,
    });
  }
};







exports.createBundle = async (req, res) => {
  try {
    const { bundleName, items, price } = req.body;
    const { schoolId, session, _id: updatedBy } = req.user;

    if (!bundleName || !items || !price) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const bundle = new BundleModel({ schoolId, session, bundleName, items, price, updatedBy });
    await bundle.save();
    res.status(201).json({ success: true, message: "Bundle created", data: bundle });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating bundle", error: error.message });
  }
};

exports.getBundles = async (req, res) => {
  try {
    const { schoolId, session } = req.user;
    const bundles = await BundleModel.find({ schoolId, session });
    res.status(200).json({ success: true, message: "Bundles fetched", data: bundles });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching bundles", error: error.message });
  }
};

exports.updateBundle = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { bundleName, items, price } = req.body;
    const { _id: updatedBy } = req.user;

    const bundle = await BundleModel.findOneAndUpdate(
      { bundleId },
      { bundleName, items, price, updatedBy, updatedAt: new Date() },
      { new: true }
    );
    if (!bundle) {
      return res.status(404).json({ success: false, message: "Bundle not found." });
    }
    res.status(200).json({ success: true, message: "Bundle updated", data: bundle });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating bundle", error: error.message });
  }
};

exports.deleteBundle = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const bundle = await BundleModel.findOneAndDelete({ bundleId });
    if (!bundle) {
      return res.status(404).json({ success: false, message: "Bundle not found." });
    }
    res.status(200).json({ success: true, message: "Bundle deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting bundle", error: error.message });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const { name, contact, address } = req.body;
    const { schoolId, session, _id: updatedBy } = req.user;

    if (!name) {
      return res.status(400).json({ success: false, message: "Supplier name is required." });
    }

    const supplier = new SupplierModel({ schoolId, session, name, contact, address, updatedBy });
    await supplier.save();
    res.status(201).json({ success: true, message: "Supplier created", data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating supplier", error: error.message });
  }
};

exports.getSuppliers = async (req, res) => {
  try {
    const { schoolId, session } = req.user;
    const suppliers = await SupplierModel.find({ schoolId, session });
    res.status(200).json({ success: true, message: "Suppliers fetched", data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching suppliers", error: error.message });
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { name, contact, address } = req.body;
    const { _id: updatedBy } = req.user;

    const supplier = await SupplierModel.findOneAndUpdate(
      { supplierId },
      { name, contact, address, updatedBy, updatedAt: new Date() },
      { new: true }
    );
    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found." });
    }
    res.status(200).json({ success: true, message: "Supplier updated", data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating supplier", error: error.message });
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const supplier = await SupplierModel.findOneAndDelete({ supplierId });
    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found." });
    }
    res.status(200).json({ success: true, message: "Supplier deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting supplier", error: error.message });
  }
};

exports.createSupplierPayment = async (req, res) => {
  try {
    const { supplierId, amount, paymentMode, description } = req.body;
    const { schoolId, session, _id: updatedBy } = req.user;

    if (!supplierId || !amount) {
      return res.status(400).json({ success: false, message: "Supplier ID and amount are required." });
    }

    const payment = new SupplierPayment({
      schoolId,
      session,
      supplierId,
      amount,
      paymentMode,
      description,
      updatedBy,
    });
    await payment.save();
    res.status(201).json({ success: true, message: "Payment recorded", data: payment });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error recording payment", error: error.message });
  }
};

exports.getSupplierPayments = async (req, res) => {
  try {
    const { schoolId, session } = req.user;
    const payments = await SupplierPayment.find({ schoolId, session });
    res.status(200).json({ success: true, message: "Payments fetched", data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching payments", error: error.message });
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
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
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
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    }
    if (!studentFullName) {
      return res
        .status(400)
        .json({ success: false, message: "Student full name is required." });
    }
    if (!mobileNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Mobile number is required." });
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
          message:
            "Already registered with this email in this school and session!",
        });
      }
    }

    // Generate admissionNo and registrationNumber
    const finalAdmissionNo =
      admissionNo && admissionNo.trim() !== ""
        ? admissionNo
        : await generateAdmission(schoolId); // Assumes this function exists
    const registrationNumber = await generateRegistrationNumber(schoolId); // Assumes this function exists

    // Handle file uploads
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
    const schoolDetails = await AdminInfo.findOne({ schoolId }).select(
      "schoolName image.url"
    );
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
                <p style="margin: 5px 0; font-size: 16px;"><strong>Registration ID:</strong> ${
                  registrationData.registrationId
                }</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Class:</strong> ${
                  registerClass || "N/A"
                }</p>
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
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    }
    if (!createdBy) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required." });
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
            throw new Error(
              `Already registered with email: ${studentEmail} in this school and session`
            );
          }
        }

        const finalAdmissionNo =
          admissionNo && admissionNo.trim() !== ""
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
      const insertedRegistrations = await NewRegistrationModel.insertMany(
        createdRegistrations
      );
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
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    }

    const {
      registrationId,
      registrationNumber,
      studentEmail,
      parentEmail,
      mobileNumber,
      class: registerClass,
      gender,
      status,
      fetchAll,
      limit = 10,
      page = 1,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Define the class order
    const classOrder = [
      "PRE NUR",
      "NUR",
      "LKG",
      "UKG",
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
      "X",
      "XI",
      "XI(A)",
      "XI(C)",
      "XI(S)",
      "XI(S)-M",
      "XI(S)-B",
      "XII",
      "XII(A)",
      "XII(C)",
      "XII(S)",
      "XII(S)-M",
      "XII(S)-B",
      "PASS OUT",
      "Passout2025",
    ];

    let query = { schoolId, session };

    if (registrationId) query.registrationId = registrationId;
    if (registrationNumber) query.registrationNumber = registrationNumber;
    if (studentEmail) query.studentEmail = studentEmail;
    if (parentEmail) query.parentEmail = parentEmail;
    if (mobileNumber) query.mobileNumber = Number(mobileNumber);
    if (registerClass) query.registerClass = registerClass;
    if (gender) query.gender = gender;
    if (status) query.approvalStatus = status;

    const skip = (page - 1) * parseInt(limit);
    const limitValue = parseInt(limit);

    if (registrationId) {
      const registration = await NewRegistrationModel.findOne(query).lean();
      if (!registration) {
        return res
          .status(404)
          .json({ success: false, message: "Registration not found." });
      }
      return res.status(200).json({
        success: true,
        data: {
          ...registration,
          displayClass: registration.section
            ? `${registration.registerClass}-${registration.section}`
            : registration.registerClass,
        },
      });
    }

    const pipeline = [
      {
        $match: query,
      },
      {
        $addFields: {
          classOrderIndex: { $indexOfArray: [classOrder, "$registerClass"] },
        },
      },
      {
        $sort: {
          classOrderIndex: 1,
          section: 1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limitValue,
      },
      {
        $project: {
          classOrderIndex: 0, // Remove temporary field
        },
      },
    ];

    const registrations = await NewRegistrationModel.aggregate(pipeline);
    const total = await NewRegistrationModel.countDocuments(query);

    res.status(200).json({
      success: true,
      data: registrations.map((reg) => ({
        ...reg,
        displayClass: reg.section
          ? `${reg.registerClass}-${reg.section}`
          : reg.registerClass,
      })),
      pagination: {
        total,
        page: parseInt(page),
        limit: limitValue,
        totalPages: Math.ceil(total / limitValue),
      },
    });
  } catch (error) {
    console.error("Error in getRegistrations:", error);
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
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    }
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status value. Use 'pending', 'approved', or 'rejected'.",
      });
    }

    const registration = await NewRegistrationModel.findOneAndUpdate(
      { registrationId, schoolId, session },
      { approvalStatus: status },
      { new: true }
    );

    if (!registration) {
      return res
        .status(404)
        .json({ success: false, message: "Registration not found." });
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
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    }

    const registration = await NewRegistrationModel.findOne({
      registrationId,
      schoolId,
      session,
    });
    if (!registration) {
      return res
        .status(404)
        .json({ success: false, message: "Registration not found." });
    }
    if (registration.approvalStatus !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Registration must be approved to admit.",
      });
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
          message:
            "Student with this email already exists in this school and session.",
        });
      }
    }

    // Generate passwords
    const studentPassword = generateRandomPassword(); // Assumes this function exists
    const parentPassword = generateRandomPassword();
    const studentHashPassword = await hashPassword(studentPassword); // Assumes this function exists
    const parentHashPassword = await hashPassword(parentPassword);

    // Generate a unique admission number
    const studentAdmissionNumber = await generateAdmissionNumber(
      schoolId,
      NewStudentModel
    );
    const parentAdmissionNumber = await generateAdmissionNumber(
      schoolId,
      ParentModel
    );

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
      joiningDate: new Date().toISOString().split("T")[0], // Current date
      rollNo:
        registration.rollNo ||
        (
          (await NewStudentModel.countDocuments({
            schoolId,
            class: registration.registerClass,
          })) + 1
        ).toString(),
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
      contact: registration.mobileNumber
        ? registration.mobileNumber.toString()
        : null,
      admissionNumber: parentAdmissionNumber,
      createdBy,
      parentImage:
        registration.fatherPhoto ||
        registration.motherPhoto ||
        registration.guardianPhoto,
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
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    }

    const registration = await NewRegistrationModel.findOne({
      registrationId,
      schoolId,
      session,
    });
    if (!registration) {
      return res
        .status(404)
        .json({ success: false, message: "Registration not found." });
    }

    // Handle file uploads
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

// Create Student Only (New Endpoint)
exports.createStudentOnly = async (req, res) => {
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
      religion,
      caste,
      nationality,
      pincode,
      state,
      city,
      admissionNumber,
      // UDISE+ fields (same as createStudentParent)
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

    if (!schoolId || !session || !createdBy) {
      return res.status(400).json({
        success: false,
        message: "School ID, session, and user ID are required.",
      });
    }

    if (
      !studentFullName ||
      !studentEmail ||
      !studentPassword ||
      !studentJoiningDate ||
      !studentClass
    ) {
      return res.status(400).json({
        success: false,
        message: "Required student fields are missing.",
      });
    }

    const studentExist = await NewStudentModel.findOne({
      email: studentEmail,
      schoolId,
      session,
    });
    if (studentExist) {
      return res.status(400).json({
        success: false,
        message: `Student with email ${studentEmail} already exists.`,
      });
    }

    const files = req.files || [];
    const studentFile = files.find((f) => f.fieldname === "studentImage");
    const fatherFile = files.find((f) => f.fieldname === "fatherImage");
    const motherFile = files.find((f) => f.fieldname === "motherImage");
    const guardianFile = files.find((f) => f.fieldname === "guardianImage");

    const studentHashPassword = await hashPassword(studentPassword);
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
      const fileKey = `students/father/${Date.now()}-${
        fatherFile.originalname
      }`;
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
      const fileKey = `students/mother/${Date.now()}-${
        motherFile.originalname
      }`;
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
      const fileKey = `students/guardian/${Date.now()}-${
        guardianFile.originalname
      }`;
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
      isNewAdmission: true,
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

    const schoolDetails = await AdminInfo.findOne({ schoolId }).select(
      "schoolName image.url"
    );
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
                <p style="margin: 5px 0; font-size: 16px;"><strong>Student ID:</strong> ${
                  studentData.studentId
                }</p>
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
    await sendEmail(
      studentEmail,
      "Admission Confirmation",
      studentEmailContent
    );

    res.status(201).json({
      success: true,
      message: "Student created successfully, email sent.",
      student: studentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Student creation failed due to an error.",
      error: error.message,
    });
  }
};

// Create Parent Only (New Endpoint)
exports.createParentOnly = async (req, res) => {
  try {
    const {
      fatherName,
      motherName,
      guardianName,
      parentEmail,
      parentPassword,
      parentContact,
      parentIncome,
      parentQualification,
      admissionNumber,
    } = req.body;

    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const createdBy = req.user._id;

    if (!schoolId || !session || !createdBy) {
      return res.status(400).json({
        success: false,
        message: "School ID, session, and user ID are required.",
      });
    }

    if (!fatherName || !parentEmail || !parentPassword) {
      return res.status(400).json({
        success: false,
        message: "Required parent fields are missing.",
      });
    }

    const parentExist = await ParentModel.findOne({
      email: parentEmail,
      schoolId,
      session,
    });
    if (parentExist) {
      return res.status(400).json({
        success: false,
        message: `Parent with email ${parentEmail} already exists.`,
      });
    }

    const files = req.files || [];
    const parentFile = files.find((f) => f.fieldname === "parentImage");
    const fatherFile = files.find((f) => f.fieldname === "fatherImage");
    const motherFile = files.find((f) => f.fieldname === "motherImage");
    const guardianFile = files.find((f) => f.fieldname === "guardianImage");

    const parentHashPassword = await hashPassword(parentPassword);
    let parentImageResult = {},
      fatherImageResult = {},
      motherImageResult = {},
      guardianImageResult = {};

    if (parentFile) {
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
      const fileKey = `parents/father/${Date.now()}-${fatherFile.originalname}`;
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
      const fileKey = `parents/mother/${Date.now()}-${motherFile.originalname}`;
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
      const fileKey = `parents/guardian/${Date.now()}-${
        guardianFile.originalname
      }`;
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

    const parentAdmissionNumberToUse =
      admissionNumber && admissionNumber.trim() !== ""
        ? admissionNumber
        : await generateAdmissionNumber(schoolId, ParentModel);

    const parentData = await ParentModel.create({
      schoolId,
      session,
      studentIds: [],
      studentNames: [],
      fatherName,
      motherName,
      guardianName,
      email: parentEmail,
      password: parentHashPassword,
      contact: parentContact,
      admissionNumber: parentAdmissionNumberToUse,
      income: parentIncome,
      qualification: parentQualification,
      createdBy,
      parentImage: parentImageResult.url ? parentImageResult : undefined,
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
    await sendEmail(
      parentEmail,
      "Parent Login Credentials",
      parentEmailContent
    );

    res.status(201).json({
      success: true,
      message: "Parent created successfully, email sent.",
      parent: parentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Parent creation failed due to an error.",
      error: error.message,
    });
  }
};


exports.getParentByEmail = async (req, res) => {
  try {
    const { email } = req.query; // Email passed as query parameter
    const { schoolId, session } = req.user;

    // Validate inputs
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Parent email is required.",
      });
    }
    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    }

    // Fetch parent details
    const parent = await ParentModel.findOne({
      email,
      schoolId,
      session,
    }).select('-password -base64'); // Exclude sensitive fields

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: `No parent found with email ${email} for the specified school and session.`,
      });
    }

    // Prepare response data
    const parentDetails = {
      parentId: parent.parentId,
      fatherName: parent.fatherName,
      motherName: parent.motherName,
      guardianName: parent.guardianName,
      email: parent.email,
      contact: parent.contact,
      admissionNumber: parent.admissionNumber,
      income: parent.income,
      qualification: parent.qualification,
      studentIds: parent.studentIds,
      studentNames: parent.studentNames,
      status: parent.status,
      role: parent.role,
      parentImage: parent.parentImage.url ? parent.parentImage : undefined,
      fatherImage: parent.fatherImage.url ? parent.fatherImage : undefined,
      motherImage: parent.motherImage.url ? parent.motherImage : undefined,
      guardianImage: parent.guardianImage.url ? parent.guardianImage : undefined,
      createdAt: parent.createdAt,
    };

    res.status(200).json({
      success: true,
      message: "Parent details retrieved successfully.",
      parent: parentDetails,
    });
  } catch (error) {
    console.error("Error fetching parent details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch parent details.",
      error: error.message,
    });
  }
};

// Updated parseDate to handle malformed input gracefully
// Updated helper function to parse DD/MM/YYYY strings into Date objects
const parseDate = (dateString) => {
  if (!dateString || typeof dateString !== "string") return null;

  // Trim whitespace from the input string
  const trimmedDate = dateString.trim();

  // Split by '/' or '-' and ensure we get exactly 3 parts
  const parts = trimmedDate.split(/[-\/]/);
  if (parts.length !== 3) return null;

  const [day, month, year] = parts.map((part) => part.trim()); // Trim each part to remove any extra spaces

  // Validate day, month, and year are numeric and within valid ranges
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) return null;
  if (
    dayNum < 1 ||
    dayNum > 31 ||
    monthNum < 1 ||
    monthNum > 12 ||
    yearNum < 1900
  )
    return null;

  // Construct Date object (month is 0-based in JS, so subtract 1)
  const date = new Date(yearNum, monthNum - 1, dayNum);

  // Check if the date is valid and matches the input (e.g., handles invalid days like 31/04)
  if (
    isNaN(date.getTime()) ||
    date.getDate() !== dayNum ||
    date.getMonth() + 1 !== monthNum ||
    date.getFullYear() !== yearNum
  ) {
    return null;
  }

  return date;
};

// Utility function to generate unique email
const generateUniqueEmail = async (base, schoolId, model, suffix) => {
  let email = `${base.replace(/\s+/g, "").toLowerCase()}${suffix}`;
  let counter = 1;
  while (await model.findOne({ email, schoolId })) {
    email = `${base.replace(/\s+/g, "").toLowerCase()}${counter}${suffix}`;
    counter++;
  }
  return email;
};

// Utility functions to avoid obfuscation issues
const cleanString = (str) => {
  if (typeof str !== "string") return "";
  return str.toLowerCase().replace(/\s+/g, "");
};

// Existing createStudentParent (Unchanged except for minor refactoring)
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

    if (!schoolId || !session || !createdBy) {
      return res.status(400).json({
        success: false,
        message: "School ID, session, and user ID are required.",
      });
    }

    // Validate required fields
    // Require student fields and either parentAdmissionNumber or (parentEmail and parentPassword)
    if (
      !studentFullName ||
      !studentEmail ||
      !studentPassword ||
      !studentJoiningDate ||
      !studentClass ||
      (!parentAdmissionNumber && (!parentEmail || !parentPassword))
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Required fields are missing." });
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
        message: `Student with email ${studentEmail} already exists Bourne.`,
      });
    }

    let parentExist = null;
    if (parentAdmissionNumber) {
      parentExist = await ParentModel.findOne({
        admissionNumber: parentAdmissionNumber,
        schoolId,
        session,
      });
      if (!parentExist) {
        return res.status(400).json({
          success: false,
          message: `Parent with admission number ${parentAdmissionNumber} does not exist.`,
        });
      }
    } else if (parentEmail) {
      parentExist = await ParentModel.findOne({
        email: parentEmail,
        schoolId,
        session,
      });
      if (parentExist) {
        // Return error with parent details and halt execution
        const parentDetails = {
          parentId: parentExist.parentId,
          fatherName: parentExist.fatherName,
          motherName: parentExist.motherName,
          guardianName: parentExist.guardianName,
          email: parentExist.email,
          contact: parentExist.contact,
          admissionNumber: parentExist.admissionNumber,
          income: parentExist.income,
          qualification: parentExist.qualification,
          studentIds: parentExist.studentIds,
          studentNames: parentExist.studentNames,
          status: parentExist.status,
          role: parentExist.role,
          parentImage: parentExist.parentImage?.url ? parentExist.parentImage : undefined,
          fatherImage: parentExist.fatherImage?.url ? parentExist.fatherImage : undefined,
          motherImage: parentExist.motherImage?.url ? parentExist.motherImage : undefined,
          guardianImage: parentExist.guardianImage?.url ? parentExist.guardianImage : undefined,
          createdAt: parentExist.createdAt,
        };
        return res.status(400).json({
          success: false,
          message: `Parent with email ${parentEmail} already exists.`,
          parent: parentDetails,
        });
      }
    }

    const studentHashPassword = await hashPassword(studentPassword);
    const parentHashPassword = parentPassword
      ? await hashPassword(parentPassword)
      : undefined;

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

    // Use parentExist data for fatherName, motherName, etc., if available
    const studentFatherName = parentExist ? parentExist.fatherName : fatherName;
    const studentMotherName = parentExist ? parentExist.motherName : motherName;
    const studentGuardianName = parentExist ? parentExist.guardianName : guardianName;

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
      fatherName: studentFatherName,
      motherName: studentMotherName,
      guardianName: studentGuardianName,
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
      parentId: parentExist ? parentExist.parentId : undefined,
      parentAdmissionNumber: parentExist ? parentExist.admissionNumber : undefined,
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
    if (parentAdmissionNumber && parentExist) {
      parentData = await ParentModel.findOneAndUpdate(
        { admissionNumber: parentAdmissionNumber, schoolId, session },
        {
          $push: {
            studentIds: studentData.studentId, // Use UUID studentId
            studentNames: studentFullName,
          },
        },
        { new: true }
      );
      // Ensure student has correct parentId (UUID)
      if (!studentData.parentId) {
        studentData.parentId = parentData.parentId;
        studentData.parentAdmissionNumber = parentData.admissionNumber;
        await studentData.save();
      }
    } else if (parentEmail && parentPassword) {
      const parentImageResult =
        files.find((f) => f.fieldname === "parentImage") ||
        fatherFile ||
        motherFile ||
        guardianFile;
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
        studentIds: [studentData.studentId], // Use UUID studentId
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
        parentImage: parentImageData.url ? parentImageData : undefined,
        fatherImage: fatherImageResult.url ? fatherImageResult : undefined,
        motherImage: motherImageResult.url ? motherImageResult : undefined,
        guardianImage: guardianImageResult.url ? guardianImageResult : undefined,
      });

      // Update student with new parent details
      studentData.parentId = parentData.parentId; // Use UUID parentId
      studentData.parentAdmissionNumber = parentData.admissionNumber;
      await studentData.save();

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
      await sendEmail(
        parentEmail,
        "Parent Login Credentials",
        parentEmailContent
      );
    }

    const schoolDetails = await AdminInfo.findOne({ schoolId }).select(
      "schoolName image.url"
    );
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
              <h2 style="color: #ff560

0; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, ${studentFullName}!</h2>
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
    await sendEmail(
      studentEmail,
      "Admission Confirmation",
      studentEmailContent
    );

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

// Updated createBulkStudentParent
// exports.createBulkStudentParent = async (req, res) => {
//   try {
//     // Validate request format
//     if (!req.body || !req.body.students || !Array.isArray(req.body.students)) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid request format." });
//     }

//     const studentsData = req.body.students;
//     const schoolId = req.user.schoolId;
//     const session = req.user.session;
//     const createdBy = req.user._id;
//     const createdStudents = [];
//     const generatedCredentials = [];
//     const errors = [];

//     if (!schoolId || !session || !createdBy) {
//       return res.status(400).json({
//         success: false,
//         message: "School ID, session, and user ID are required.",
//       });
//     }

//     for (const student of studentsData) {
//       let finalStudentEmail = null;
//       let finalParentEmail = null;

//       try {
//         const {
//           studentFullName,
//           studentDateOfBirth,
//           studentGender,
//           studentJoiningDate,
//           studentClass,
//           studentSection,
//           fatherName,
//           motherName,
//           guardianName,
//           remarks,
//           transport,
//           parentContact,
//           studentAddress,
//           religion,
//           caste,
//           nationality,
//           pincode,
//           state,
//           city,
//           studentContact,
//           admissionNumber,
//           parentAdmissionNumber,
//           // ... other fields ...
//         } = student;

//         // Validate required fields
//         if (
//           !studentFullName ||
//           !fatherName ||
//           !studentJoiningDate ||
//           !studentClass
//         ) {
//           throw new Error(
//             "Required fields (studentFullName, fatherName, joiningDate, class) are missing."
//           );
//         }

//         // Generate student email if not provided
//         finalStudentEmail = student.studentEmail;
//         if (!finalStudentEmail) {
//           const baseName = studentFullName.toLowerCase().replace(/\s+/g, "");
//           let uniqueNumber = Math.floor(100 + Math.random() * 900);
//           finalStudentEmail = `${baseName}${uniqueNumber}@dvs.com`;
//           while (
//             await NewStudentModel.findOne({
//               email: finalStudentEmail,
//               schoolId,
//             })
//           ) {
//             uniqueNumber = Math.floor(100 + Math.random() * 900);
//             finalStudentEmail = `${baseName}${uniqueNumber}@dvs.com`;
//           }
//         }

//         // Check for existing student
//         const studentExist = await NewStudentModel.findOne({
//           email: { $regex: new RegExp(`^${finalStudentEmail}$`, "i") },
//           schoolId,
//         });
//         if (studentExist) {
//           throw new Error(
//             `Student with email ${finalStudentEmail} already exists in this school.`
//           );
//         }

//         // Parse and handle dates
//         let parsedJoiningDate;
//         if (typeof studentJoiningDate === "number") {
//           const excelEpoch = new Date(1899, 11, 30);
//           parsedJoiningDate = new Date(
//             excelEpoch.getTime() + studentJoiningDate * 86400000
//           );
//           if (isNaN(parsedJoiningDate.getTime())) {
//             throw new Error(
//               `Invalid joiningDate serial number: ${studentJoiningDate}`
//             );
//           }
//           const day = String(parsedJoiningDate.getDate()).padStart(2, "0");
//           const month = String(parsedJoiningDate.getMonth() + 1).padStart(
//             2,
//             "0"
//           );
//           const year = parsedJoiningDate.getFullYear();
//           parsedJoiningDate = `${day}/${month}/${year}`;
//         } else {
//           parsedJoiningDate = parseDate(studentJoiningDate);
//           if (!parsedJoiningDate) {
//             throw new Error(
//               `Invalid joiningDate format: ${studentJoiningDate}. Use DD/MM/YYYY.`
//             );
//           }
//           parsedJoiningDate = studentJoiningDate; // Keep as string per schema
//         }

//         let parsedDateOfBirth;
//         if (typeof studentDateOfBirth === "number") {
//           const excelEpoch = new Date(1899, 11, 30);
//           parsedDateOfBirth = new Date(
//             excelEpoch.getTime() + studentDateOfBirth * 86400000
//           );
//           if (isNaN(parsedDateOfBirth.getTime())) {
//             throw new Error(
//               `Invalid dateOfBirth serial number: ${studentDateOfBirth}`
//             );
//           }
//         } else if (studentDateOfBirth) {
//           parsedDateOfBirth = parseDate(studentDateOfBirth);
//           if (!parsedDateOfBirth) {
//             throw new Error(
//               `Invalid dateOfBirth format: ${studentDateOfBirth}. Use DD/MM/YYYY.`
//             );
//           }
//         } else {
//           parsedDateOfBirth = null;
//         }

//         // Set passwords
//         const studentPassword = "dvs@student";
//         const studentHashPassword = await hashPassword(studentPassword);

//         // Generate or use provided admission number for student
//         let studentAdmissionNumberToUse;
//         if (admissionNumber && admissionNumber.trim() !== "") {
//           // Use provided admission number and check for uniqueness
//           studentAdmissionNumberToUse = admissionNumber.trim();
//           const existingStudent = await NewStudentModel.findOne({
//             admissionNumber: studentAdmissionNumberToUse,
//             schoolId,
//           });
//           if (existingStudent) {
//             throw new Error(
//               `Admission number ${studentAdmissionNumberToUse} is already in use by another student.`
//             );
//           }
//         } else {
//           // Generate default admission number if not provided
//           studentAdmissionNumberToUse = await generateAdmissionNumber(
//             schoolId,
//             NewStudentModel
//           );
//         }

//         // Create student with the determined admission number
//         const studentData = await NewStudentModel.create({
//           schoolId,
//           session,
//           studentName: studentFullName,
//           email: finalStudentEmail,
//           password: studentHashPassword,
//           dateOfBirth: parsedDateOfBirth,
//           rollNo: (
//             (await NewStudentModel.countDocuments({
//               schoolId,
//               class: studentClass,
//               section: studentSection || "A",
//             })) + 1
//           ).toString(),
//           gender: studentGender,
//           joiningDate: parsedJoiningDate,
//           address: studentAddress,
//           contact: studentContact || "",
//           class: studentClass,
//           fatherName,
//           motherName,
//           guardianName,
//           remarks,
//           transport,
//           section: studentSection || "A",
//           country: nationality || "Indian",
//           subject: [],
//           admissionNumber: studentAdmissionNumberToUse,
//           religion,
//           caste,
//           nationality,
//           pincode,
//           state,
//           city,
//           createdBy,
//           approvalStatus: "approved",
//           assignedThirdParty: null,
//           isNewAdmission: true,
//         });

//         // Handle parent
//         let parentData = null;

//         if (parentAdmissionNumber) {
//           parentData = await ParentModel.findOne({
//             admissionNumber: parentAdmissionNumber,
//             schoolId,
//             session,
//           });
//           if (!parentData) {
//             throw new Error(
//               `Parent with admission number ${parentAdmissionNumber} does not exist.`
//             );
//           }
//           await ParentModel.updateOne(
//             { _id: parentData._id },
//             {
//               $push: { studentIds: studentData.studentId },
//               $addToSet: { studentNames: studentFullName },
//             }
//           );
//         } else {
//           finalParentEmail = student.parentEmail;
//           if (!finalParentEmail) {
//             const baseName = fatherName.toLowerCase().replace(/\s+/g, "");
//             const contact =
//               parentContact ||
//               Math.floor(1000000000 + Math.random() * 9000000000).toString();
//             finalParentEmail = `${baseName}${contact}@dvs.com`;
//             let suffix = "";
//             let attempt = 0;
//             while (
//               await ParentModel.findOne({
//                 email: `${finalParentEmail}${suffix}`,
//                 schoolId,
//               })
//             ) {
//               attempt++;
//               suffix = attempt.toString();
//             }
//             finalParentEmail = `${finalParentEmail}${suffix}`;
//           }

//           parentData = await ParentModel.findOne({
//             email: finalParentEmail,
//             schoolId,
//             session,
//           });

//           if (parentData) {
//             await ParentModel.updateOne(
//               { _id: parentData._id },
//               {
//                 $push: { studentIds: studentData.studentId },
//                 $addToSet: { studentNames: studentFullName },
//               }
//             );
//           } else {
//             const parentPassword = "dvs@parent";
//             const parentHashPassword = await hashPassword(parentPassword);

//             parentData = await ParentModel.create({
//               schoolId,
//               session,
//               studentIds: [studentData.studentId],
//               studentNames: [studentFullName],
//               fatherName,
//               motherName,
//               guardianName,
//               email: finalParentEmail,
//               password: parentHashPassword,
//               contact: parentContact || "",
//               admissionNumber: await generateAdmissionNumber(
//                 schoolId,
//                 ParentModel
//               ),
//               createdBy,
//             });

//             const parentEmailContent = `
//               <!DOCTYPE html>
//               <html>
//               <head><meta charset="UTF-8"><title>Parent Account Created</title></head>
//               <body style="font-family: Arial, sans-serif;">
//                 <h1>Welcome, Parent!</h1>
//                 <p>Your account has been created.</p>
//                 <p><strong>Email:</strong> ${finalParentEmail}</p>
//                 <p><strong>Password:</strong> ${parentPassword}</p>
//                 <p><strong>Parent ID:</strong> ${parentData.admissionNumber}</p>
//               </body>
//               </html>
//             `;
//             await sendEmail(
//               finalParentEmail,
//               "Parent Login Credentials",
//               parentEmailContent
//             );
//           }
//         }

//         // Update student with parent info
//         if (parentData) {
//           await NewStudentModel.updateOne(
//             { _id: studentData._id },
//             {
//               parentId: parentData.parentId,
//               parentAdmissionNumber: parentData.admissionNumber,
//             }
//           );
//         }

//         // Send student email
//         const schoolDetails = await AdminInfo.findOne({ schoolId }).select(
//           "schoolName image.url"
//         );
//         const schoolName = schoolDetails?.schoolName || "Your School";
//         const studentEmailContent = `
//           <!DOCTYPE html>
//           <html>
//           <head><meta charset="UTF-8"><title>Admission Confirmation</title></head>
//           <body style="font-family: Arial, sans-serif;">
//             <h1>${schoolName}</h1>
//             <p>Hello, ${studentFullName}!</p>
//             <p>Your admission is confirmed.</p>
//             <p><strong>Email:</strong> ${finalStudentEmail}</p>
//             <p><strong>Password:</strong> ${studentPassword}</p>
//             <p><strong>Student ID:</strong> ${studentData.studentId}</p>
//             <p><strong>Class:</strong> ${studentClass}</p>
//             <p><strong>Admission Number:</strong> ${studentAdmissionNumberToUse}</p>
//           </body>
//           </html>
//         `;
//         await sendEmail(
//           finalStudentEmail,
//           "Admission Confirmation",
//           studentEmailContent
//         );

//         createdStudents.push(studentData);
//         generatedCredentials.push({
//           studentName: studentFullName,
//           studentEmail: finalStudentEmail,
//           studentPassword,
//           parentEmail: parentData.email,
//           parentPassword: "dvs@parent",
//           parentAdmissionNumber: parentData.admissionNumber,
//         });
//       } catch (error) {
//         errors.push({
//           studentEmail:
//             finalStudentEmail || student.studentFullName || "unknown",
//           error: error.message,
//         });
//       }
//     }

//     res.status(201).json({
//       success: true,
//       message: "Bulk student and parent creation completed.",
//       createdStudents,
//       generatedCredentials,
//       errors: errors.length > 0 ? errors : [],
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Bulk creation failed due to an unexpected error.",
//       error: error.message,
//     });
//   }
// };

exports.createBulkStudentParent = async (req, res) => {
  try {
    // Utility to normalize various date formats into DD/MM/YYYY
    function normalizeDateFormat(input) {
      if (!input || typeof input !== "string") return null;

      const separators = ["/", "-", "."];
      let parts = [];

      for (let sep of separators) {
        if (input.includes(sep)) {
          parts = input.split(sep);
          break;
        }
      }

      if (parts.length !== 3) return null;

      let [day, month, year] = parts.map((x) => x.trim());

      // Fix year if short format (e.g., "25" → "2025")
      if (year.length === 2) {
        const fullYear = parseInt(year, 10);
        year = fullYear < 50 ? `20${year}` : `19${year}`;
      }

      day = day.padStart(2, "0");
      month = month.padStart(2, "0");

      return `${day}/${month}/${year}`;
    }

    if (!req.body || !req.body.students || !Array.isArray(req.body.students)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request format.",
      });
    }

    const studentsData = req.body.students;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const createdBy = req.user._id;
    const createdStudents = [];
    const generatedCredentials = [];
    const errors = [];

    if (!schoolId || !session || !createdBy) {
      return res.status(400).json({
        success: false,
        message: "School ID, session, and user ID are required.",
      });
    }

    for (const student of studentsData) {
      let finalStudentEmail = null;
      let finalParentEmail = null;

      try {
        const {
          studentFullName,
          studentDateOfBirth,
          studentGender,
          studentJoiningDate,
          studentClass,
          studentSection,
          fatherName,
          motherName,
          guardianName,
          remarks,
          transport,
          parentContact,
          studentAddress,
          religion,
          caste,
          nationality,
          pincode,
          state,
          city,
          studentContact,
          admissionNumber,
          parentAdmissionNumber,
        } = student;

        if (
          !studentFullName ||
          !fatherName ||
          !studentJoiningDate ||
          !studentClass
        ) {
          throw new Error(
            "Required fields (studentFullName, fatherName, joiningDate, class) are missing."
          );
        }

        finalStudentEmail = student.studentEmail;
        if (!finalStudentEmail) {
          const baseName = studentFullName.toLowerCase().replace(/\s+/g, "");
          let uniqueNumber = Math.floor(100 + Math.random() * 900);
          finalStudentEmail = `${baseName}${uniqueNumber}@dvs.com`;
          while (
            await NewStudentModel.findOne({
              email: finalStudentEmail,
              schoolId,
            })
          ) {
            uniqueNumber = Math.floor(100 + Math.random() * 900);
            finalStudentEmail = `${baseName}${uniqueNumber}@dvs.com`;
          }
        }

        const studentExist = await NewStudentModel.findOne({
          email: { $regex: new RegExp(`^${finalStudentEmail}$`, "i") },
          schoolId,
        });
        if (studentExist) {
          throw new Error(
            `Student with email ${finalStudentEmail} already exists in this school.`
          );
        }

        // Parse and normalize dates
        let parsedJoiningDate;
        if (typeof studentJoiningDate === "number") {
          const excelEpoch = new Date(1899, 11, 30);
          parsedJoiningDate = new Date(
            excelEpoch.getTime() + studentJoiningDate * 86400000
          );
          if (isNaN(parsedJoiningDate.getTime())) {
            throw new Error(
              `Invalid joiningDate serial number: ${studentJoiningDate}`
            );
          }
          const day = String(parsedJoiningDate.getDate()).padStart(2, "0");
          const month = String(parsedJoiningDate.getMonth() + 1).padStart(
            2,
            "0"
          );
          const year = parsedJoiningDate.getFullYear();
          parsedJoiningDate = `${day}/${month}/${year}`;
        } else {
          const formatted = normalizeDateFormat(studentJoiningDate);
          if (!formatted)
            throw new Error(
              `Invalid joiningDate format: ${studentJoiningDate}`
            );
          parsedJoiningDate = formatted;
        }

        let parsedDateOfBirth;
        if (typeof studentDateOfBirth === "number") {
          const excelEpoch = new Date(1899, 11, 30);
          parsedDateOfBirth = new Date(
            excelEpoch.getTime() + studentDateOfBirth * 86400000
          );
          if (isNaN(parsedDateOfBirth.getTime())) {
            throw new Error(
              `Invalid dateOfBirth serial number: ${studentDateOfBirth}`
            );
          }
        } else if (studentDateOfBirth) {
          const formatted = normalizeDateFormat(studentDateOfBirth);
          if (!formatted)
            throw new Error(
              `Invalid dateOfBirth format: ${studentDateOfBirth}`
            );
          parsedDateOfBirth = new Date(
            formatted.split("/").reverse().join("-") + "T00:00:00Z"
          );
        } else {
          parsedDateOfBirth = null;
        }

        const studentPassword = "dvs@student";
        const studentHashPassword = await hashPassword(studentPassword);

        let studentAdmissionNumberToUse;
        if (admissionNumber && admissionNumber.trim() !== "") {
          studentAdmissionNumberToUse = admissionNumber.trim();
          const existingStudent = await NewStudentModel.findOne({
            admissionNumber: studentAdmissionNumberToUse,
            schoolId,
          });
          if (existingStudent) {
            throw new Error(
              `Admission number ${studentAdmissionNumberToUse} is already in use.`
            );
          }
        } else {
          studentAdmissionNumberToUse = await generateAdmissionNumber(
            schoolId,
            NewStudentModel
          );
        }

        const studentData = await NewStudentModel.create({
          schoolId,
          session,
          studentName: studentFullName,
          email: finalStudentEmail,
          password: studentHashPassword,
          dateOfBirth: parsedDateOfBirth,
          rollNo: (
            (await NewStudentModel.countDocuments({
              schoolId,
              class: studentClass,
              section: studentSection || "A",
            })) + 1
          ).toString(),
          gender: studentGender,
          joiningDate: parsedJoiningDate,
          address: studentAddress,
          contact: studentContact || "",
          class: studentClass,
          fatherName,
          motherName,
          guardianName,
          remarks,
          transport,
          section: studentSection || "A",
          country: nationality || "Indian",
          subject: [],
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
          isNewAdmission: true,
        });

        // Handle parent logic
        let parentData = null;

        if (parentAdmissionNumber) {
          parentData = await ParentModel.findOne({
            admissionNumber: parentAdmissionNumber,
            schoolId,
            session,
          });
          if (!parentData) {
            throw new Error(
              `Parent with admission number ${parentAdmissionNumber} does not exist.`
            );
          }
          await ParentModel.updateOne(
            { _id: parentData._id },
            {
              $push: { studentIds: studentData.studentId },
              $addToSet: { studentNames: studentFullName },
            }
          );
        } else {
          finalParentEmail = student.parentEmail;
          if (!finalParentEmail) {
            const baseName = fatherName.toLowerCase().replace(/\s+/g, "");
            const contact =
              parentContact ||
              Math.floor(1000000000 + Math.random() * 9000000000).toString();
            finalParentEmail = `${baseName}${contact}@dvs.com`;
            let suffix = "";
            let attempt = 0;
            while (
              await ParentModel.findOne({
                email: `${finalParentEmail}${suffix}`,
                schoolId,
              })
            ) {
              attempt++;
              suffix = attempt.toString();
            }
            finalParentEmail = `${finalParentEmail}${suffix}`;
          }

          parentData = await ParentModel.findOne({
            email: finalParentEmail,
            schoolId,
            session,
          });

          if (parentData) {
            await ParentModel.updateOne(
              { _id: parentData._id },
              {
                $push: { studentIds: studentData.studentId },
                $addToSet: { studentNames: studentFullName },
              }
            );
          } else {
            const parentPassword = "dvs@parent";
            const parentHashPassword = await hashPassword(parentPassword);

            parentData = await ParentModel.create({
              schoolId,
              session,
              studentIds: [studentData.studentId],
              studentNames: [studentFullName],
              fatherName,
              motherName,
              guardianName,
              email: finalParentEmail,
              password: parentHashPassword,
              contact: parentContact || "",
              admissionNumber: await generateAdmissionNumber(
                schoolId,
                ParentModel
              ),
              createdBy,
            });

            await sendEmail(
              finalParentEmail,
              "Parent Login Credentials",
              `<h1>Parent Account Created</h1><p>Email: ${finalParentEmail}</p><p>Password: dvs@parent</p>`
            );
          }
        }

        if (parentData) {
          await NewStudentModel.updateOne(
            { _id: studentData._id },
            {
              parentId: parentData.parentId,
              parentAdmissionNumber: parentData.admissionNumber,
            }
          );
        }

        const schoolDetails = await AdminInfo.findOne({ schoolId }).select(
          "schoolName image.url"
        );
        const schoolName = schoolDetails?.schoolName || "Your School";

        await sendEmail(
          finalStudentEmail,
          "Admission Confirmation",
          `<h1>${schoolName}</h1><p>Welcome ${studentFullName}</p><p>Email: ${finalStudentEmail}</p><p>Password: ${studentPassword}</p>`
        );

        createdStudents.push(studentData);
        generatedCredentials.push({
          studentName: studentFullName,
          studentEmail: finalStudentEmail,
          studentPassword,
          parentEmail: parentData.email,
          parentPassword: "dvs@parent",
          parentAdmissionNumber: parentData.admissionNumber,
        });
      } catch (error) {
        errors.push({
          studentEmail:
            finalStudentEmail || student.studentFullName || "unknown",
          error: error.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Bulk student and parent creation completed.",
      createdStudents,
      generatedCredentials,
      errors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Bulk creation failed due to an unexpected error.",
      error: error.message,
    });
  }
};

// Updated editStudentParent (Enhanced to support linking)
exports.editStudentParent = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const formData = req.body;
    const files = req.files || [];
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    // Essential identifiers must be present
    if (!schoolId || !session || !studentId) {
      return res.status(400).json({
        success: false,
        message: "School ID, session, and student ID are required.",
      });
    }

    // Find the student
    const student = await NewStudentModel.findOne({
      studentId,
      schoolId,
      session,
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found or does not belong to this school and session.",
      });
    }

    // If an email is provided and is non-empty, check its format
    if (formData.email !== undefined && formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid email format." });
      }
    }

    // If dateOfBirth is provided and non-empty, ensure it's not in the future
    if (formData.dateOfBirth !== undefined && formData.dateOfBirth) {
      const dob = new Date(formData.dateOfBirth);
      if (dob > new Date()) {
        return res.status(400).json({
          success: false,
          message: "Date of birth cannot be in the future.",
        });
      }
    }

    // Student password handling: only update if provided and of acceptable length
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

    // Handle file uploads for student images (if provided)
    let studentImageResult = student.studentImage;
    let fatherImageResult = student.fatherImage;
    let motherImageResult = student.motherImage;
    let guardianImageResult = student.guardianImage;

    const studentFile = files.find((f) => f.fieldname === "studentImage");
    const fatherFile = files.find((f) => f.fieldname === "fatherImage");
    const motherFile = files.find((f) => f.fieldname === "motherImage");
    const guardianFile = files.find((f) => f.fieldname === "guardianImage");

    if (studentFile) {
      if (student.studentImage && student.studentImage.public_id) {
        await s3
          .deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: student.studentImage.public_id,
          })
          .promise();
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
      if (student.fatherImage && student.fatherImage.public_id) {
        await s3
          .deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: student.fatherImage.public_id,
          })
          .promise();
      }
      const fileKey = `students/father/${Date.now()}-${
        fatherFile.originalname
      }`;
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
      if (student.motherImage && student.motherImage.public_id) {
        await s3
          .deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: student.motherImage.public_id,
          })
          .promise();
      }
      const fileKey = `students/mother/${Date.now()}-${
        motherFile.originalname
      }`;
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
      if (student.guardianImage && student.guardianImage.public_id) {
        await s3
          .deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: student.guardianImage.public_id,
          })
          .promise();
      }
      const fileKey = `students/guardian/${Date.now()}-${
        guardianFile.originalname
      }`;
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

    // Linking logic for parent/student relations (if linking data is provided)
    if (
      formData.parentId ||
      formData.parentAdmissionNumber ||
      formData.linkStudentId
    ) {
      let parent;
      // Link student to parent using parentId or parentAdmissionNumber
      if (formData.parentId || formData.parentAdmissionNumber) {
        const parentQuery = formData.parentId
          ? { parentId: formData.parentId }
          : { admissionNumber: formData.parentAdmissionNumber };
        parent = await ParentModel.findOne({
          ...parentQuery,
          schoolId,
          session,
        });
        if (!parent) {
          return res
            .status(404)
            .json({ success: false, message: "Parent not found." });
        }
        // Update student with parent details
        student.parentId = parent.parentId;
        student.parentAdmissionNumber = parent.admissionNumber;
        // Also update parent's studentIds and studentNames if not already linked
        if (!parent.studentIds.includes(studentId)) {
          parent.studentIds.push(studentId);
          parent.studentNames.push(student.studentName);
          await parent.save();
        }
      }

      // Reverse linking: Link parent to another student (if provided)
      if (formData.linkStudentId) {
        const targetStudent = await NewStudentModel.findOne({
          studentId: formData.linkStudentId,
          schoolId,
          session,
        });
        if (!targetStudent) {
          return res
            .status(404)
            .json({ success: false, message: "Target student not found." });
        }
        parent =
          (await ParentModel.findOne({
            parentId: student.parentId,
            schoolId,
            session,
          })) ||
          (await ParentModel.findOne({
            studentIds: { $in: [studentId] },
            schoolId,
            session,
          }));
        if (!parent) {
          return res.status(404).json({
            success: false,
            message: "Parent not found for reverse linking.",
          });
        }
        if (!parent.studentIds.includes(formData.linkStudentId)) {
          parent.studentIds.push(formData.linkStudentId);
          parent.studentNames.push(targetStudent.studentName);
          await parent.save();
        }
        targetStudent.parentId = parent.parentId;
        targetStudent.parentAdmissionNumber = parent.admissionNumber;
        await targetStudent.save();
      }
    }

    // Update student document using only provided fields (others remain unchanged)
    const updateStudentFields = {
      studentName: formData.studentName || student.studentName,
      email: formData.email !== undefined ? formData.email : student.email,
      password: studentHashPassword,
      dateOfBirth: formData.dateOfBirth || student.dateOfBirth,
      motherName:
        formData.motherName !== undefined
          ? formData.motherName
          : student.motherName,
      fatherName:
        formData.fatherName !== undefined
          ? formData.fatherName
          : student.fatherName,
      guardianName:
        formData.guardianName !== undefined
          ? formData.guardianName
          : student.guardianName,
      remarks:
        formData.remarks !== undefined ? formData.remarks : student.remarks,
      transport:
        formData.transport !== undefined
          ? formData.transport
          : student.transport, // simple string update
      parentContact:
        formData.parentContact !== undefined
          ? formData.parentContact
          : student.parentContact,
      rollNo: formData.rollNo !== undefined ? formData.rollNo : student.rollNo,
      parentId: student.parentId, // updated via linking logic if applicable
      parentAdmissionNumber: student.parentAdmissionNumber, // updated via linking logic if applicable
      gender: formData.gender !== undefined ? formData.gender : student.gender,
      joiningDate: formData.joiningDate || student.joiningDate,
      address:
        formData.address !== undefined ? formData.address : student.address,
      contact:
        formData.contact !== undefined ? formData.contact : student.contact,
      class: formData.class !== undefined ? formData.class : student.class,
      section:
        formData.section !== undefined ? formData.section : student.section,
      country:
        formData.country !== undefined ? formData.country : student.country,
      subject:
        formData.subject !== undefined ? formData.subject : student.subject,
      studentImage: studentImageResult.url
        ? studentImageResult
        : student.studentImage,
      fatherImage: fatherImageResult.url
        ? fatherImageResult
        : student.fatherImage,
      motherImage: motherImageResult.url
        ? motherImageResult
        : student.motherImage,
      guardianImage: guardianImageResult.url
        ? guardianImageResult
        : student.guardianImage,
      admissionNumber:
        formData.admissionNumber !== undefined
          ? formData.admissionNumber
          : student.admissionNumber,
      religion:
        formData.religion !== undefined ? formData.religion : student.religion,
      caste: formData.caste !== undefined ? formData.caste : student.caste,
      nationality:
        formData.nationality !== undefined
          ? formData.nationality
          : student.nationality,
      pincode:
        formData.pincode !== undefined ? formData.pincode : student.pincode,
      state: formData.state !== undefined ? formData.state : student.state,
      city: formData.city !== undefined ? formData.city : student.city,
      udisePlusDetails: {
        stu_id:
          formData.stu_id !== undefined
            ? formData.stu_id
            : student.udisePlusDetails?.stu_id,
        class:
          formData.studentUdiseClass !== undefined
            ? formData.studentUdiseClass
            : student.udisePlusDetails?.class,
        section:
          formData.studentUdiseSection !== undefined
            ? formData.studentUdiseSection
            : student.udisePlusDetails?.section,
        roll_no:
          formData.roll_no !== undefined
            ? formData.roll_no
            : student.udisePlusDetails?.roll_no,
        student_name:
          formData.student_name !== undefined
            ? formData.student_name
            : student.udisePlusDetails?.student_name,
        gender:
          formData.studentUdiseGender !== undefined
            ? formData.studentUdiseGender
            : student.udisePlusDetails?.gender,
        DOB:
          formData.DOB !== undefined
            ? formData.DOB
            : student.udisePlusDetails?.DOB,
        mother_name:
          formData.mother_name !== undefined
            ? formData.mother_name
            : student.udisePlusDetails?.mother_name,
        father_name:
          formData.father_name !== undefined
            ? formData.father_name
            : student.udisePlusDetails?.father_name,
        guardian_name:
          formData.guardian_name !== undefined
            ? formData.guardian_name
            : student.udisePlusDetails?.guardian_name,
        aadhar_no:
          formData.aadhar_no !== undefined
            ? formData.aadhar_no
            : student.udisePlusDetails?.aadhar_no,
        aadhar_name:
          formData.aadhar_name !== undefined
            ? formData.aadhar_name
            : student.udisePlusDetails?.aadhar_name,
        paddress:
          formData.paddress !== undefined
            ? formData.paddress
            : student.udisePlusDetails?.paddress,
        pincode:
          formData.udisePlusPincode !== undefined
            ? formData.udisePlusPincode
            : student.udisePlusDetails?.pincode,
        mobile_no:
          formData.mobile_no !== undefined
            ? formData.mobile_no
            : student.udisePlusDetails?.mobile_no,
        alt_mobile_no:
          formData.alt_mobile_no !== undefined
            ? formData.alt_mobile_no
            : student.udisePlusDetails?.alt_mobile_no,
        email_id:
          formData.email_id !== undefined
            ? formData.email_id
            : student.udisePlusDetails?.email_id,
        mothere_tougue:
          formData.mothere_tougue !== undefined
            ? formData.mothere_tougue
            : student.udisePlusDetails?.mothere_tougue,
        category:
          formData.category !== undefined
            ? formData.category
            : student.udisePlusDetails?.category,
        minority:
          formData.minority !== undefined
            ? formData.minority
            : student.udisePlusDetails?.minority,
        is_bpl:
          formData.is_bpl !== undefined
            ? formData.is_bpl
            : student.udisePlusDetails?.is_bpl,
        is_aay:
          formData.is_aay !== undefined
            ? formData.is_aay
            : student.udisePlusDetails?.is_aay,
        ews_aged_group:
          formData.ews_aged_group !== undefined
            ? formData.ews_aged_group
            : student.udisePlusDetails?.ews_aged_group,
        is_cwsn:
          formData.is_cwsn !== undefined
            ? formData.is_cwsn
            : student.udisePlusDetails?.is_cwsn,
        cwsn_imp_type:
          formData.cwsn_imp_type !== undefined
            ? formData.cwsn_imp_type
            : student.udisePlusDetails?.cwsn_imp_type,
        ind_national:
          formData.ind_national !== undefined
            ? formData.ind_national
            : student.udisePlusDetails?.ind_national,
        mainstramed_child:
          formData.mainstramed_child !== undefined
            ? formData.mainstramed_child
            : student.udisePlusDetails?.mainstramed_child,
        adm_no:
          formData.adm_no !== undefined
            ? formData.adm_no
            : student.udisePlusDetails?.adm_no,
        adm_date:
          formData.adm_date !== undefined
            ? formData.adm_date
            : student.udisePlusDetails?.adm_date,
        stu_stream:
          formData.stu_stream !== undefined
            ? formData.stu_stream
            : student.udisePlusDetails?.stu_stream,
        pre_year_schl_status:
          formData.pre_year_schl_status !== undefined
            ? formData.pre_year_schl_status
            : student.udisePlusDetails?.pre_year_schl_status,
        pre_year_class:
          formData.pre_year_class !== undefined
            ? formData.pre_year_class
            : student.udisePlusDetails?.pre_year_class,
        stu_ward:
          formData.stu_ward !== undefined
            ? formData.stu_ward
            : student.udisePlusDetails?.stu_ward,
        pre_class_exam_app:
          formData.pre_class_exam_app !== undefined
            ? formData.pre_class_exam_app
            : student.udisePlusDetails?.pre_class_exam_app,
        result_pre_exam:
          formData.result_pre_exam !== undefined
            ? formData.result_pre_exam
            : student.udisePlusDetails?.result_pre_exam,
        perc_pre_class:
          formData.perc_pre_class !== undefined
            ? formData.perc_pre_class
            : student.udisePlusDetails?.perc_pre_class,
        att_pre_class:
          formData.att_pre_class !== undefined
            ? formData.att_pre_class
            : student.udisePlusDetails?.att_pre_class,
        fac_free_uniform:
          formData.fac_free_uniform !== undefined
            ? formData.fac_free_uniform
            : student.udisePlusDetails?.fac_free_uniform,
        fac_free_textbook:
          formData.fac_free_textbook !== undefined
            ? formData.fac_free_textbook
            : student.udisePlusDetails?.fac_free_textbook,
        received_central_scholarship:
          formData.received_central_scholarship !== undefined
            ? formData.received_central_scholarship
            : student.udisePlusDetails?.received_central_scholarship,
        name_central_scholarship:
          formData.name_central_scholarship !== undefined
            ? formData.name_central_scholarship
            : student.udisePlusDetails?.name_central_scholarship,
        received_state_scholarship:
          formData.received_state_scholarship !== undefined
            ? formData.received_state_scholarship
            : student.udisePlusDetails?.received_state_scholarship,
        received_other_scholarship:
          formData.received_other_scholarship !== undefined
            ? formData.received_other_scholarship
            : student.udisePlusDetails?.received_other_scholarship,
        scholarship_amount:
          formData.scholarship_amount !== undefined
            ? formData.scholarship_amount
            : student.udisePlusDetails?.scholarship_amount,
        fac_provided_cwsn:
          formData.fac_provided_cwsn !== undefined
            ? formData.fac_provided_cwsn
            : student.udisePlusDetails?.fac_provided_cwsn,
        SLD_type:
          formData.SLD_type !== undefined
            ? formData.SLD_type
            : student.udisePlusDetails?.SLD_type,
        aut_spec_disorder:
          formData.aut_spec_disorder !== undefined
            ? formData.aut_spec_disorder
            : student.udisePlusDetails?.aut_spec_disorder,
        ADHD:
          formData.ADHD !== undefined
            ? formData.ADHD
            : student.udisePlusDetails?.ADHD,
        inv_ext_curr_activity:
          formData.inv_ext_curr_activity !== undefined
            ? formData.inv_ext_curr_activity
            : student.udisePlusDetails?.inv_ext_curr_activity,
        vocational_course:
          formData.vocational_course !== undefined
            ? formData.vocational_course
            : student.udisePlusDetails?.vocational_course,
        trade_sector_id:
          formData.trade_sector_id !== undefined
            ? formData.trade_sector_id
            : student.udisePlusDetails?.trade_sector_id,
        job_role_id:
          formData.job_role_id !== undefined
            ? formData.job_role_id
            : student.udisePlusDetails?.job_role_id,
        pre_app_exam_vocationalsubject:
          formData.pre_app_exam_vocationalsubject !== undefined
            ? formData.pre_app_exam_vocationalsubject
            : student.udisePlusDetails?.pre_app_exam_vocationalsubject,
        bpl_card_no:
          formData.bpl_card_no !== undefined
            ? formData.bpl_card_no
            : student.udisePlusDetails?.bpl_card_no,
        ann_card_no:
          formData.ann_card_no !== undefined
            ? formData.ann_card_no
            : student.udisePlusDetails?.ann_card_no,
      },
      updatedBy, // track who updated the record
    };

    // Update the student document
    const updatedStudent = await NewStudentModel.findOneAndUpdate(
      { studentId, schoolId, session },
      updateStudentFields,
      { new: true, runValidators: true }
    );

    // If parent info is provided, update the parent document (only minimal checks are done)
    if (formData.parentId) {
      const parent = await ParentModel.findOne({
        parentId: formData.parentId,
        schoolId,
        session,
      });
      if (!parent) {
        return res.status(404).json({
          success: false,
          message:
            "Parent not found or does not belong to this school and session.",
        });
      }

      // Update parent's password if provided
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

      // Handle parent file uploads
      let parentImageResult = parent.parentImage;
      let pFatherImageResult = parent.fatherImage;
      let pMotherImageResult = parent.motherImage;
      let pGuardianImageResult = parent.guardianImage;

      const parentFile = files.find((f) => f.fieldname === "parentImage");
      if (parentFile) {
        if (parent.parentImage && parent.parentImage.public_id) {
          await s3
            .deleteObject({
              Bucket: process.env.MINIO_BUCKET,
              Key: parent.parentImage.public_id,
            })
            .promise();
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
        if (parent.fatherImage && parent.fatherImage.public_id) {
          await s3
            .deleteObject({
              Bucket: process.env.MINIO_BUCKET,
              Key: parent.fatherImage.public_id,
            })
            .promise();
        }
        const fileKey = `parents/father/${Date.now()}-${
          fatherFile.originalname
        }`;
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
        if (parent.motherImage && parent.motherImage.public_id) {
          await s3
            .deleteObject({
              Bucket: process.env.MINIO_BUCKET,
              Key: parent.motherImage.public_id,
            })
            .promise();
        }
        const fileKey = `parents/mother/${Date.now()}-${
          motherFile.originalname
        }`;
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
        if (parent.guardianImage && parent.guardianImage.public_id) {
          await s3
            .deleteObject({
              Bucket: process.env.MINIO_BUCKET,
              Key: parent.guardianImage.public_id,
            })
            .promise();
        }
        const fileKey = `parents/guardian/${Date.now()}-${
          guardianFile.originalname
        }`;
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
        fatherName:
          formData.fatherName !== undefined
            ? formData.fatherName
            : parent.fatherName,
        motherName:
          formData.motherName !== undefined
            ? formData.motherName
            : parent.motherName,
        guardianName:
          formData.guardianName !== undefined
            ? formData.guardianName
            : parent.guardianName,
        email: formData.email !== undefined ? formData.email : parent.email,
        password: parentHashPassword,
        contact:
          formData.contact !== undefined ? formData.contact : parent.contact,
        income: formData.income !== undefined ? formData.income : parent.income,
        qualification:
          formData.qualification !== undefined
            ? formData.qualification
            : parent.qualification,
        parentImage: parentImageResult.url
          ? parentImageResult
          : parent.parentImage,
        fatherImage: pFatherImageResult.url
          ? pFatherImageResult
          : parent.fatherImage,
        motherImage: pMotherImageResult.url
          ? pMotherImageResult
          : parent.motherImage,
        guardianImage: pGuardianImageResult.url
          ? pGuardianImageResult
          : parent.guardianImage,
        admissionNumber:
          formData.admissionNumber !== undefined
            ? formData.admissionNumber
            : parent.admissionNumber,
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
    const schoolId = req.user.schoolId;
    const session = req.query.session || req.user.session;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required.",
      });
    }

    const countQuery = { schoolId };
    if (req.query.session) {
      countQuery.$or = [
        { session: req.query.session },
        { sessionHistory: req.query.session },
      ];
    } else {
      countQuery.session = session;
    }

    const countWithImage = await NewStudentModel.countDocuments({
      ...countQuery,
      "studentImage.url": { $ne: "" },
    });

    const countWithoutImage = await NewStudentModel.countDocuments({
      ...countQuery,
      $or: [
        { "studentImage.url": "" },
        { "studentImage.url": { $exists: false } },
      ],
    });

    const {
      studentId,
      parentId,
      admissionNumber,
      parentAdmissionNumber,
      email,
      class: studentClass,
      section,
      gender,
      status,
      fetchAllStudents,
      fetchNewAdmissions,
      fetchAllParents,
      fetchParentsWithMultipleChildren,
      limit,
      page = 1,
      sortBy = "createdAt",
      sortOrder = "desc",
      studentName,
      contact,
      rollNo,
      religion,
      caste,
      nationality,
      pincode,
      state,
      city,
      approvalStatus,
      createdBy,
      joiningDateStart,
      joiningDateEnd,
      dateOfBirthStart,
      dateOfBirthEnd,
      searchTerm, // Added searchTerm parameter
    } = req.query;

    let studentQuery = { schoolId };
    let parentQuery = { schoolId };

    if (req.query.session) {
      studentQuery.$or = [
        { session: req.query.session },
        { sessionHistory: req.query.session },
      ];
      parentQuery.$or = [
        { session: req.query.session },
        { sessionHistory: req.query.session },
      ];
    } else {
      studentQuery.session = session;
      parentQuery.session = session;
    }

    if (studentId) studentQuery.studentId = studentId;
    if (admissionNumber) studentQuery.admissionNumber = admissionNumber;
    if (email) studentQuery.email = email;
    if (studentClass) studentQuery.class = studentClass;
    if (section) studentQuery.section = section;
    if (gender) studentQuery.gender = gender;
    if (status) studentQuery.status = status;
    if (studentName) studentQuery.studentName = { $regex: studentName, $options: "i" };
    if (contact) studentQuery.contact = contact;
    if (rollNo) studentQuery.rollNo = rollNo;
    if (religion) studentQuery.religion = religion;
    if (caste) studentQuery.caste = caste;
    if (nationality) studentQuery.nationality = nationality;
    if (pincode) studentQuery.pincode = pincode;
    if (state) studentQuery.state = state;
    if (city) studentQuery.city = city;
    if (approvalStatus) studentQuery.approvalStatus = approvalStatus;
    if (createdBy) studentQuery.createdBy = createdBy;
    if (joiningDateStart || joiningDateEnd) {
      studentQuery.joiningDate = {};
      if (joiningDateStart) studentQuery.joiningDate.$gte = new Date(joiningDateStart);
      if (joiningDateEnd) studentQuery.joiningDate.$lte = new Date(joiningDateEnd);
    }
    if (dateOfBirthStart || dateOfBirthEnd) {
      studentQuery.dateOfBirth = {};
      if (dateOfBirthStart) studentQuery.dateOfBirth.$gte = new Date(dateOfBirthStart);
      if (dateOfBirthEnd) studentQuery.dateOfBirth.$lte = new Date(dateOfBirthEnd);
    }
    if (fetchNewAdmissions === "true") {
      studentQuery.isNewAdmission = true;
    }

    // Add searchTerm logic to filter by name or admission number
    if (searchTerm) {
      studentQuery.$or = [
        { studentName: { $regex: searchTerm, $options: "i" } },
        { admissionNumber: { $regex: searchTerm, $options: "i" } },
      ];
    }

    if (parentId) parentQuery.parentId = parentId;
    if (parentAdmissionNumber) parentQuery.admissionNumber = parentAdmissionNumber;
    if (email) parentQuery.email = email;

    const skip = (page - 1) * (limit || 0);
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    let responseData = {
      imageCounts: {
        withImage: countWithImage,
        withoutImage: countWithoutImage,
      },
    };

    const attachParentContact = async (students) => {
      const parentIds = [...new Set(students.map((s) => s.parentId).filter(Boolean))];
      const parentContacts = await ParentModel.find({
        parentId: { $in: parentIds },
        schoolId,
      }, { parentId: 1, contact: 1 }).lean();

      const contactMap = {};
      parentContacts.forEach(p => {
        contactMap[p.parentId] = typeof p.contact === 'string' ? Number(p.contact) : p.contact;
      });

      return students.map((student) => ({
        ...student,
        parentContact: contactMap[student.parentId] || null,
      }));
    };

    if (studentId) {
      let student = await NewStudentModel.findOne(studentQuery).lean();
      if (!student)
        return res.status(404).json({
          success: false,
          message: `Student with ID ${studentId} not found`,
        });
      const parentData = student.parentId
        ? await ParentModel.findOne({
            parentId: student.parentId,
            schoolId,
            session,
          }).lean()
        : null;
      responseData.student = {
        ...student,
        parentContact: parentData?.contact ? Number(parentData.contact) : null,
        parentDetails: parentData,
      };
    } else if (parentId) {
      const parent = await ParentModel.findOne(parentQuery).lean();
      if (!parent)
        return res.status(404).json({
          success: false,
          message: `Parent with ID ${parentId} not found`,
        });
      let students = await NewStudentModel.find({
        parentId: parent.parentId,
        schoolId,
        session,
      }).lean();
      students = await attachParentContact(students);
      responseData.parent = {
        ...parent,
        studentDetails: students,
        hasMultipleChildren: students.length > 1,
        totalChildren: students.length,
      };
    } else if (fetchParentsWithMultipleChildren === "true") {
      const parents = await ParentModel.find(parentQuery).sort(sort).lean();
      const parentsWithMultipleChildren = [];
      for (const parent of parents) {
        let students = await NewStudentModel.find({
          parentId: parent.parentId,
          schoolId,
          session,
        }).lean();
        if (students.length > 1) {
          students = await attachParentContact(students);
          parentsWithMultipleChildren.push({
            ...parent,
            studentDetails: students,
            totalChildren: students.length,
          });
        }
      }
      const totalParentsWithMultiple = parentsWithMultipleChildren.length;
      responseData.parentsWithMultipleChildren = {
        data: limit
          ? parentsWithMultipleChildren.slice(skip, skip + parseInt(limit))
          : parentsWithMultipleChildren,
        pagination: {
          total: totalParentsWithMultiple,
          page: parseInt(page),
          limit: limit ? parseInt(limit) : null,
          totalPages: limit ? Math.ceil(totalParentsWithMultiple / limit) : 1,
        },
      };
    } else if (fetchAllStudents === "true") {
      let students = await NewStudentModel.find(studentQuery)
        .sort(sort)
        .skip(skip)
        .limit(limit ? parseInt(limit) : undefined)
        .lean();
      students = await attachParentContact(students);
      const totalStudents = await NewStudentModel.countDocuments(studentQuery);
      responseData.students = {
        data: students,
        pagination: {
          total: totalStudents,
          page: parseInt(page),
          limit: limit ? parseInt(limit) : null,
          totalPages: limit ? Math.ceil(totalStudents / limit) : 1,
        },
      };
    } else if (fetchNewAdmissions === "true") {
      let newStudents = await NewStudentModel.find(studentQuery)
        .sort(sort)
        .skip(skip)
        .limit(limit ? parseInt(limit) : undefined)
        .lean();
      newStudents = await attachParentContact(newStudents);
      const totalNewStudents = await NewStudentModel.countDocuments(studentQuery);
      responseData.newAdmissions = {
        data: newStudents,
        pagination: {
          total: totalNewStudents,
          page: parseInt(page),
          limit: limit ? parseInt(limit) : null,
          totalPages: limit ? Math.ceil(totalNewStudents / limit) : 1,
        },
      };
    } else if (fetchAllParents === "true") {
      const parents = await ParentModel.find(parentQuery)
        .sort(sort)
        .skip(skip)
        .limit(limit ? parseInt(limit) : undefined)
        .lean();
      const totalParents = await ParentModel.countDocuments(parentQuery);
      responseData.parents = {
        data: parents,
        pagination: {
          total: totalParents,
          page: parseInt(page),
          limit: limit ? parseInt(limit) : null,
          totalPages: limit ? Math.ceil(totalParents / limit) : 1,
        },
      };
    } else if (
      Object.keys(studentQuery).length > 2 ||
      Object.keys(parentQuery).length > 2
    ) {
      let students = await NewStudentModel.find(studentQuery)
        .sort(sort)
        .skip(skip)
        .limit(limit ? parseInt(limit) : undefined)
        .lean();
      students = await attachParentContact(students);
      const totalStudents = await NewStudentModel.countDocuments(studentQuery);
      responseData.students = {
        data: students,
        pagination: {
          total: totalStudents,
          page: parseInt(page),
          limit: limit ? parseInt(limit) : null,
          totalPages: limit ? Math.ceil(totalStudents / limit) : 1,
        },
      };

      const parents = await ParentModel.find(parentQuery)
        .sort(sort)
        .skip(skip)
        .limit(limit ? parseInt(limit) : undefined)
        .lean();
      const totalParents = await ParentModel.countDocuments(parentQuery);
      responseData.parents = {
        data: parents,
        pagination: {
          total: totalParents,
          page: parseInt(page),
          limit: limit ? parseInt(limit) : null,
          totalPages: limit ? Math.ceil(totalParents / limit) : 1,
        },
      };
    } else {
      let students = await NewStudentModel.find({ schoolId, session }).sort(sort).lean();
      students = await attachParentContact(students);
      const totalStudents = students.length;
      responseData.students = { data: students, total: totalStudents };

      const parents = await ParentModel.find({ schoolId, session }).sort(sort).lean();
      const totalParents = parents.length;
      responseData.parents = { data: parents, total: totalParents };
    }

    return res.status(200).json({
      success: true,
      message: "Data retrieved successfully.",
      ...responseData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error retrieving student and parent data.",
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
      ? await ParentModel.findOne({
          parentId: studentData.parentId,
          schoolId,
          session,
        })
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

// POST /api/students/toggle-printed
exports.toggleIsPrinted = async (req, res) => {
  try {
    const { studentIds, isPrinted } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    if (!Array.isArray(studentIds) || typeof isPrinted !== "boolean") {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payload. 'studentIds' must be an array and 'isPrinted' a boolean.",
      });
    }

    const result = await NewStudentModel.updateMany(
      {
        studentId: { $in: studentIds },
        schoolId,
        $or: [{ session }, { sessionHistory: session }],
      },
      { $set: { isPrinted } }
    );

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} student(s)`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating print status.",
      error: error.message,
    });
  }
};

exports.toggleAdmissionStatus = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { isNewAdmission } = req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    // Validation
    if (!schoolId || !session || !studentId) {
      return res.status(400).json({
        success: false,
        message: "School ID, session, and student ID are required.",
      });
    }

    if (isNewAdmission === undefined || typeof isNewAdmission !== "boolean") {
      return res.status(400).json({
        success: false,
        message:
          "isNewAdmission must be provided as a boolean value (true or false).",
      });
    }

    // Find the student
    const student = await NewStudentModel.findOne({
      studentId,
      schoolId,
      session,
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student with ID ${studentId} not found.`,
      });
    }

    // Update the isNewAdmission field
    student.isNewAdmission = isNewAdmission;
    await student.save();

    res.status(200).json({
      success: true,
      message: `Student admission status updated to ${
        isNewAdmission ? "new" : "existing"
      } successfully.`,
      student: {
        studentId: student.studentId,
        studentName: student.studentName,
        isNewAdmission: student.isNewAdmission,
        schoolId: student.schoolId,
        session: student.session,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error toggling admission status.",
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
    const student = await NewStudentModel.findOne({
      studentId,
      schoolId,
      session,
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found or does not belong to this school and session.",
      });
    }

    // Toggle student status
    const newStudentStatus =
      student.status === "active" ? "deactivated" : "active";

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
      const parent = await ParentModel.findOne({
        parentId: student.parentId,
        schoolId,
        session,
      });
      if (parent) {
        const newParentStatus =
          parent.status === "active" ? "deactivated" : "active";
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

    const student = await NewStudentModel.findOne({
      studentId,
      schoolId,
      session,
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found or does not belong to this school and session.",
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
      {
        studentId: { $in: studentIds },
        schoolId,
        session,
        approvalStatus: "pending",
      },
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
    const {
      studentId,
      studentAdmissionNumber,
      parentId,
      parentAdmissionNumber,
    } = req.body;

    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;

    // 1. Basic validation
    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required from authenticated admin.",
      });
    }
    if (!(studentId || studentAdmissionNumber)) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide either studentId or studentAdmissionNumber in the body.",
      });
    }
    if (!(parentId || parentAdmissionNumber)) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide either parentId or parentAdmissionNumber in the body.",
      });
    }

    // 2. Find the student
    const studentFilter = {
      schoolId,
      session,
      $or: [],
    };
    if (studentId) studentFilter.$or.push({ studentId });
    if (studentAdmissionNumber)
      studentFilter.$or.push({ admissionNumber: studentAdmissionNumber });

    const student = await NewStudentModel.findOne(studentFilter);
    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found with given identifier(s) in this school and session.",
      });
    }

    // 3. Find the parent
    const parentFilter = {
      schoolId,
      session,
      $or: [],
    };
    if (parentId) parentFilter.$or.push({ parentId });
    if (parentAdmissionNumber)
      parentFilter.$or.push({ admissionNumber: parentAdmissionNumber });

    const newParent = await ParentModel.findOne(parentFilter);
    if (!newParent) {
      return res.status(404).json({
        success: false,
        message:
          "Parent not found with given identifier(s) in this school and session.",
      });
    }

    // 4. Already linked?
    if (student.parentId && student.parentId === newParent.parentId) {
      return res.status(400).json({
        success: false,
        message: "Student is already linked to this parent.",
      });
    }

    // 5. Unlink from old parent (if any)
    if (student.parentId) {
      const oldParent = await ParentModel.findOne({
        parentId: student.parentId,
        schoolId,
        session,
      });
      if (oldParent) {
        oldParent.studentIds = oldParent.studentIds.filter(
          (id) => id !== student.studentId
        );
        oldParent.studentNames = oldParent.studentNames.filter(
          (name) => name !== student.studentName
        );
        await oldParent.save();
      }
    }

    // 6. Link to new parent by student.studentId (UUID)
    if (!newParent.studentIds.includes(student.studentId)) {
      newParent.studentIds.push(student.studentId);
    }
    if (!newParent.studentNames.includes(student.studentName)) {
      newParent.studentNames.push(student.studentName);
    }
    newParent.updatedBy = updatedBy;
    newParent.updatedAt = new Date();
    await newParent.save();

    // 7. Update student record
    student.parentId = newParent.parentId;
    student.parentAdmissionNumber = newParent.admissionNumber;
    student.updatedBy = updatedBy;
    student.updatedAt = new Date();
    await student.save();

    // 8. Return the linked records
    res.status(200).json({
      success: true,
      message: "Student successfully linked to parent.",
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

exports.bulkEditStudents = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body. Expected an array of updates.",
      });
    }

    const bulkOps = [];

    for (const update of updates) {
      const { studentId, fields } = update;
      if (!studentId || !fields || typeof fields !== "object") {
        return res.status(400).json({
          success: false,
          message: "Each update must include studentId and fields object.",
        });
      }

      // Handle password hashing if provided
      const updateFields = { ...fields };
      if (updateFields.password) {
        if (updateFields.password.length < 8) {
          return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters long.",
          });
        }
        updateFields.password = await hashPassword(updateFields.password);
      }

      bulkOps.push({
        updateOne: {
          filter: { studentId, schoolId, session },
          update: { $set: updateFields },
        },
      });
    }

    const result = await NewStudentModel.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: "Students updated successfully.",
      result,
    });
  } catch (error) {
    console.error("Error in bulkEditStudents:", error);
    res.status(500).json({
      success: false,
      message: "Error updating students.",
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

    const studentData = await NewStudentModel.findOne({
      admissionNumber,
      schoolId,
      session,
    });
    const parentData = await ParentModel.findOne({
      admissionNumber,
      schoolId,
      session,
    });
    const feeStatusData = await FeeStatus.findOne({
      admissionNumber,
      schoolId,
      session,
    });

    if (!studentData && !parentData && !feeStatusData) {
      return res.status(404).json({
        success: false,
        message:
          "No data found with this admission number for this school and session",
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
    const { parentId } = req.params;
    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: "Parent id is required",
      });
    }

    // Find the parent by parentId
    const parent = await ParentModel.findOne({ parentId });
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    // Find children with the matching parentId
    const children = await NewStudentModel.find({ parentId });

    // Get dues for each child based on their studentId
    const childrenWithDues = await Promise.all(
      children.map(async (student) => {
        // Use studentId (instead of admissionNumber) to fetch fee status
        const feeStatus = await FeeStatus.findOne({
          schoolId: student.schoolId,
          studentId: student.studentId,
        });
        const totalDues = feeStatus ? feeStatus.dues : 0;

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

exports.parentsWithChildren = async (req, res) => {
  try {
    const { studentId, admissionNumber, class: className, section } = req.query;

    // Get schoolId and session from the verified token
    const { schoolId, session } = req.user;

    if (!schoolId || !session) {
      return res.status(400).json({
        success: false,
        message: "School ID and session are required in token",
      });
    }

    // Build filter for students
    let studentFilter = { schoolId, session };
    if (studentId) studentFilter.studentId = studentId;
    if (admissionNumber) studentFilter.admissionNumber = admissionNumber;
    if (className) studentFilter.class = className;
    if (section) studentFilter.section = section;

    // Find students matching the filter
    const students = await NewStudentModel.find(studentFilter);

    // Get unique parentIds from the filtered students
    const parentIds = [...new Set(students.map((s) => s.parentId))];

    if (parentIds.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No parents found for the given filters.",
        });
    }

    // Fetch all matching parents
    const parents = await ParentModel.find({
      parentId: { $in: parentIds },
      schoolId,
      session,
    });

    // For each parent, get their children and dues
    const results = await Promise.all(
      parents.map(async (parent) => {
        const children = students.filter(
          (child) => child.parentId === parent.parentId
        );

        const childrenWithDues = await Promise.all(
          children.map(async (student) => {
            const feeStatus = await FeeStatus.findOne({
              schoolId: student.schoolId,
              studentId: student.studentId,
            });
            const totalDues = feeStatus ? feeStatus.dues : 0;

            return {
              ...student.toObject(),
              dues: totalDues,
            };
          })
        );

        // ✅ Return parent with children inside it
        return {
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
            children: childrenWithDues, // 👈 children are now nested here
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving parents with children",
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

    const parentData = await ParentModel.findOne({
      parentId,
      schoolId,
      session,
    });
    if (!parentData) {
      return res.status(404).json({
        success: false,
        message:
          "Parent not found or does not belong to this school and session.",
      });
    }

    const parentImageFile = req.file;
    let parentImageResult = parentData.parentImage;

    if (parentImageFile) {
      if (parentData.parentImage.public_id) {
        await s3
          .deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: parentData.parentImage.public_id,
          })
          .promise();
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
      parentImage: parentImageResult.url
        ? parentImageResult
        : parentData.parentImage,
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
        message:
          "Parent not found or does not belong to this school and session.",
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
        message:
          "Parent not found or does not belong to this school and session.",
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
      schoolId: req.user.schoolId, // Filter by schoolId from the authenticated user
      status: "active", // Only active students
      ...filter, // Apply the additional filters (including session-based ones)
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

    const student = await NewStudentModel.findOne({
      studentId,
      schoolId,
      session,
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found or does not belong to this school and session.",
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
    const student = await NewStudentModel.findOne({
      studentId,
      schoolId,
      session,
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found or does not belong to this school and session.",
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

    const studentData = await NewStudentModel.findOne({
      studentId,
      schoolId,
      session,
    });
    if (!studentData) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found or does not belong to this school and session.",
      });
    }

    const studentImageFile = req.file;
    let studentImageResult = studentData.studentImage;

    if (studentImageFile) {
      if (studentData.studentImage.public_id) {
        await s3
          .deleteObject({
            Bucket: process.env.MINIO_BUCKET,
            Key: studentData.studentImage.public_id,
          })
          .promise();
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
      studentImage: studentImageResult.url
        ? studentImageResult
        : studentData.studentImage,
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
    const {
      email,
      password,
      staffName,
      dateOfBirth,
      qualification,
      salary,
      gender,
      address,
      contact,
    } = req.body;
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

    const employeeExist = await EmployeeModel.findOne({
      schoolId,
      session,
      email,
    });
    if (employeeExist) {
      return res.status(400).json({
        success: false,
        message:
          "Employee with this email already exists in this school and session.",
      });
    }

    // Check if file (image) is provided, if not, skip the image processing
    let employeeImage = null;
    if (req.file) {
      const fileUri = getDataUri(req.file);
      const uploadedImage = await cloudinary.v2.uploader.upload(
        fileUri.content
      );
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
      image: employeeImage, // Image is optional now, can be null
    });

    await employeeData.save();

    // Fetch school details for email branding
    const schoolDetails = await AdminInfo.findOne({ schoolId }).select(
      "schoolName image.url"
    );
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

    const employees = await EmployeeModel.find(query)
      .select("-password")
      .lean();

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
        message:
          "Employee not found or does not belong to this school and session.",
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
      const employeeImageResult = await cloudinary.v2.uploader.upload(
        fileUri.content
      );
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
        message:
          "Employee not found or does not belong to this school and session.",
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
    const employee = await EmployeeModel.findOne({
      staffId,
      schoolId,
      session,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          "Employee not found or does not belong to this school and session.",
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

// CLASS CONTROLLERS (Updated with whitespace trimming)


// Define class enum
const CLASS_ENUM = [
  "PRE NUR", "NUR", "LKG", "UKG", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XI(ARTS)", "XI(COMM)", "XI(SCI)", "XI(SCI)-MED", "XI(SCI)-NONMED",
  "XII", "XII(ARTS)", "XII(COMM)", "XII(SCI)", "XII(SCI)-MED", "XII(SCI)-NONMED",
  "PASS OUT", "Passout2025"
];


// Create a new class
exports.createClass = async (req, res) => {
  try {
    let { className, sections, subjects } = req.body;

    // Validate and trim inputs
    className = className?.trim();
    if (!className || !CLASS_ENUM.includes(className)) {
      return res.status(400).json({
        success: false,
        message: `Class name must be one of: ${CLASS_ENUM.join(", ")}`,
      });
    }
    sections = sections
      ? sections
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[a-zA-Z0-9]+$/.test(s)) // Ensure sections are alphanumeric
      : [];
    subjects = subjects
      ? subjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const classId = uuidv4();

    const existClass = await classModel.findOne({
      schoolId: req.user.schoolId,
      className,
    });

    if (existClass) {
      return res.status(400).json({
        success: false,
        message: "This class already exists.",
      });
    }

    const newClass = await classModel.create({
      classId,
      schoolId: req.user.schoolId,
      className,
      sections,
      subjects,
      createdBy: req.user._id,
    });

    // Generate school initials from schoolName
    const schoolName = req.user.schoolName || "Default School";
    const initials = schoolName
      .split(/\s+/)
      .map((word) => word[0]?.toLowerCase())
      .join("");

    // Track created teachers for response
    const createdTeachers = [];

    // Create default teachers for each section
    const defaultPassword = "dvs@teacher";
    for (const section of sections) {
      // Sanitize className for email (remove spaces, parentheses, hyphens)
      const sanitizedClassName = className.toLowerCase().replace(/[\s()]+/g, "").replace(/-/g, "");
      // Generate email prefix with conflict resolution
      let prefix = initials;
      let counter = 0;
      let defaultEmail = `${prefix}class${sanitizedClassName}${section.toLowerCase()}@dvs.com`;

      // Check for email conflicts and increment if necessary
      while (await UserCredentials.findOne({ email: defaultEmail })) {
        counter++;
        prefix = `${initials}${counter}`;
        defaultEmail = `${prefix}class${sanitizedClassName}${section.toLowerCase()}@dvs.com`;
      }

      const teacherId = uuidv4();
      const employeeId = await generateStructuredNumber(req.user.schoolId, Teacher, 'employeeId');

      const existingTeacher = await Teacher.findOne({
        email: defaultEmail,
        schoolId: req.user.schoolId,
        session: req.user.session,
      });

      if (!existingTeacher) {
        const hashedPassword = await hashPassword(defaultPassword);

        // Create teacher
        const teacher = await Teacher.create({
          teacherId,
          schoolId: req.user.schoolId,
          session: req.user.session,
          email: defaultEmail,
          password: hashedPassword,
          employeeId,
          teacherName: `Class Teacher ${className} ${section}`,
          classTeacher: className, // Set to className (e.g., "PRE NUR")
          section: section, // Set to section (e.g., "A")
          createdBy: req.user._id,
        });

        // Log teacher details for debugging
        console.log(`Teacher created: ID=${teacher.teacherId}, Email=${teacher.email}, ClassTeacher=${teacher.classTeacher}, Section=${teacher.section}`);

        // Create credentials with rollback on failure
        try {
          const schoolDetails = await AdminInfo.findOne({ schoolId: req.user.schoolId }).select("schoolName");
          await UserCredentials.create({
            userId: teacherId,
            email: defaultEmail,
            password: defaultPassword, // Store plain-text password
            userType: "teacher",
            schoolName: schoolDetails?.schoolName || "Your School",
            createdBy: req.user._id,
          });
          console.log(`Created teacher: ${defaultEmail} with employeeId: ${employeeId} for class ${className} section ${section}`);
        } catch (credError) {
          // Rollback teacher creation if credentials fail
          await Teacher.deleteOne({ teacherId });
          throw new Error(`Failed to create credentials for section ${section}: ${credError.message}`);
        }

        // Add to createdTeachers for response
        createdTeachers.push({
          teacherId,
          email: defaultEmail,
          employeeId,
          teacherName: `Class Teacher ${className} ${section}`,
          classTeacher: className, // Include classTeacher in response
          section, // Include section in response
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Class created successfully",
      class: newClass,
      createdTeachers,
    });
  } catch (error) {
    console.error(`Error in createClass: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error creating class",
      error: error.message,
    });
  }
};

// Get all classes grouped by className and sorted
exports.getClassesGrouped = async (req, res) => {
  try {
    // Define the class order
    const classOrder = [
      "PRE NUR",
      "NUR",
      "LKG",
      "UKG",
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
      "X",
      "XI",
      "XI(ARTS)",
      "XI(COMM)",
      "XI(SCI)",
      "XI(SCI)-MED",
      "XI(SCI)-NONMED",
      "XII",
      "XII(ARTS)",
      "XII(COMM)",
      "XII(SCI)",
      "XII(SCI)-MED",
      "XII(SCI)-NONMED",
      "PASS OUT",
      "Passout2025",
    ];

    const classes = await classModel
      .find({
        schoolId: req.user.schoolId,
      })
      .lean();

    // Sort classes by className based on classOrder and sort sections alphabetically
    const sortedClasses = classes
      .map((cls) => ({
        ...cls,
        sections: cls.sections ? cls.sections.sort() : [], // Sort sections alphabetically
        order: classOrder.indexOf(cls.className), // Optional: Add order for sorting
      }))
      .sort((a, b) => a.order - b.order);

    res.status(200).json({
      success: true,
      message: "Grouped class list fetched successfully",
      classes: sortedClasses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching grouped class list",
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
exports.updateClass = async (req, res) => {
  try {
    const { classId } = req.params;
    let { className, sections, subjects } = req.body;

    // Trim and sanitize inputs
    className = className?.trim();
    sections = sections
      ? sections
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[a-zA-Z0-9]+$/.test(s)) // Ensure sections are alphanumeric
      : [];
    subjects = subjects
      ? subjects
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // Find class to update
    const classToUpdate = await classModel.findOne({
      classId,
      schoolId: req.user.schoolId,
    });

    if (!classToUpdate) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    // Validate and assign className if changed
    if (className && className !== classToUpdate.className) {
      if (!CLASS_ENUM.includes(className)) {
        return res.status(400).json({
          success: false,
          message: `Class name must be one of: ${CLASS_ENUM.join(", ")}`,
        });
      }
      const existingClass = await classModel.findOne({
        schoolId: req.user.schoolId,
        className,
      });
      if (existingClass && existingClass.classId !== classId) {
        return res.status(400).json({
          success: false,
          message: "Another class with this name already exists",
        });
      }
      classToUpdate.className = className;
    }

    // Replace sections (overwrite instead of merge)
    classToUpdate.sections = sections.length > 0 ? sections.sort() : classToUpdate.sections;

    // Replace subjects (overwrite instead of merge)
    classToUpdate.subjects = subjects.length > 0 ? subjects : classToUpdate.subjects;

    // Auto-set createdBy if missing
    if (!classToUpdate.createdBy) {
      classToUpdate.createdBy = req.user._id.toString();
    }

    // Always set updatedBy and updatedAt
    classToUpdate.updatedBy = req.user._id.toString();
    classToUpdate.updatedAt = new Date();

    const updatedClass = await classToUpdate.save();

    return res.status(200).json({
      success: true,
      message: "Class updated successfully",
      class: updatedClass,
    });
  } catch (error) {
    console.error(`Error in updateClass: ${error.message}`);
    return res.status(500).json({
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
    const file =
      req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    // Validate title and content
    if (!title || title.trim() === "" || !content || content.trim() === "") {
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
      updateData.file = {
        public_id: noticeFile.public_id,
        url: noticeFile.secure_url,
      };
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

    const notice = await NoticeModel.findOneAndDelete({
      noticeId,
      schoolId,
      session,
    });
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

// Helper function to compute next session from a session string like "2024-2025"
// function getNextSession(currentSession) {
//   // Expecting format "YYYY-YYYY"
//   const parts = currentSession.split("-");
//   if (parts.length !== 2) {
//     throw new Error("Invalid session format");
//   }
//   const startYear = parseInt(parts[0], 10);
//   const endYear = parseInt(parts[1], 10);
//   if (isNaN(startYear) || isNaN(endYear)) {
//     throw new Error("Invalid session numbers");
//   }
//   const newStart = startYear + 1;
//   const newEnd = endYear + 1;
//   return `${newStart}-${newEnd}`;
// }

// Helper function to get next session
const getNextSession = (currentSession) => {
  const [startYear, endYear] = currentSession.split("-").map(Number);
  return `${startYear + 1}-${endYear + 1}`;
};

// Updated Promotion API
exports.promotionOfStudent = async (req, res) => {
  try {
    const { students, promotedClass, promotedSection, promotedSession } =
      req.body;

    if (!students || !promotedClass || !promotedSection || !promotedSession) {
      return res.status(400).json({
        success: false,
        message: "Missing Parameters (students, class, section, or session)",
      });
    }

    let parentIds = new Set();

    for (const studentId of students) {
      const student = await NewStudentModel.findById(studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: `Student Id ${studentId} not found`,
        });
      }

      // Save current session in history
      student.sessionHistory = student.sessionHistory || [];
      student.sessionHistory.push(student.session);

      // Update student's details with provided session instead of calculated next session
      student.session = promotedSession;
      student.class = promotedClass;
      student.section = promotedSection;

      await student.save();

      if (student.parentId) {
        parentIds.add(student.parentId);
      }
    }

    for (const parentId of parentIds) {
      const parent = await ParentModel.findOne({ parentId });
      if (parent) {
        parent.sessionHistory = parent.sessionHistory || [];
        parent.sessionHistory.push(parent.session);
        parent.session = promotedSession;
        await parent.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Selected Students Promoted Successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Promotion failed",
      error: error.message,
    });
  }
};

// New GET API to fetch students by session
// exports.getStudentsBySession = async (req, res) => {
//   try {
//     const { session } = req.query;

//     console.log("Received session query:", session); // Debug log

//     if (!session) {
//       return res.status(400).json({
//         success: false,
//         message: "Session parameter is required",
//       });
//     }

//     const students = await NewStudentModel.find({
//       $or: [
//         { session: session }, // Match current session
//         { sessionHistory: session } // Match session history
//       ]
//     }).select('studentName class section session sessionHistory admissionNumber');

//     console.log("Found students:", students); // Debug log

//     res.status(200).json({
//       success: true,
//       message: "Students retrieved successfully",
//       students,
//     });
//   } catch (error) {
//     console.error("Error in getStudentsBySession:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to retrieve students",
//       error: error.message,
//     });
//   }
// };
exports.getStudentsBySession = async (req, res) => {
  try {
    // Accept session from body first, then query as fallback
    const session = req.body.session || req.query.session;

    console.log("Received session:", session); // Debug log

    if (!session) {
      return res.status(400).json({
        success: false,
        message: "Session parameter is required",
      });
    }

    const students = await NewStudentModel.find({
      $or: [{ session: session }, { sessionHistory: session }],
    }).select(
      "studentName class section session sessionHistory admissionNumber"
    );

    console.log("Found students:", students); // Debug log

    res.status(200).json({
      success: true,
      message: "Students retrieved successfully",
      students,
    });
  } catch (error) {
    console.error("Error in getStudentsBySession:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve students",
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
    const file =
      req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

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
        folder: "syllabi", // adjust folder name if needed
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

    const existSyllabus = await Curriculum.findOne({
      schoolId,
      session,
      className,
      academicYear,
    });
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
    const file =
      req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    if (file) {
      console.log("Processing file:", file.mimetype, file.originalname);
      try {
        const fileDataUri = getDataUri(file);
        const syllabusFile = await cloudinary.v2.uploader.upload(
          fileDataUri.content,
          {
            resource_type: "auto",
            folder: "syllabi",
          }
        );
        updateData.file = {
          public_id: syllabusFile.public_id,
          url: syllabusFile.secure_url,
        };
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

    const syllabus = await Curriculum.findOneAndDelete({
      syllabusId,
      schoolId,
      session,
    });
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
    const { className, section, title, description, dueDate, subject } =
      req.body;
    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const updatedBy = req.user._id;
    // Support both single and multiple file uploads
    const file =
      req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

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

    const existTask = await Assignment.findOne({
      schoolId,
      session,
      className,
      section,
      title,
    });
    if (existTask) {
      return res.status(400).json({
        success: false,
        message:
          "Task with this title for this class and section already exists.",
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
    const file =
      req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    if (file) {
      console.log("Processing file:", file.mimetype, file.originalname);
      try {
        const fileDataUri = getDataUri(file);
        const taskFile = await cloudinary.v2.uploader.upload(
          fileDataUri.content,
          {
            resource_type: "auto",
            folder: "tasks",
          }
        );
        updateData.file = {
          public_id: taskFile.public_id,
          url: taskFile.secure_url,
        };
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

    const task = await Assignment.findOneAndDelete({
      taskId,
      schoolId,
      session,
    });
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
        message:
          "Book not found or does not belong to this school and session.",
      });
    }

    const student = await NewStudentModel.findOne({
      studentId,
      schoolId,
      session,
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found or does not belong to this school and session.",
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
        message:
          "Issue record not found or does not belong to this school and session.",
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

    const book = await BookModel.findOne({
      bookId: issueRecord.bookId,
      schoolId,
      session,
    });
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
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Only admins can create exams.' });
    }

    const {
      name,
      examType,
      classNames,
      sections,
      term,
      subjects,
      startDate,
      endDate,
      resultPublishDate,
      gradeSystem
    } = req.body;

    // Parse frontend date strings into Date objects
    const parsedStart = moment(startDate, 'DD-MM-YYYY').startOf('day').toDate();
    const parsedEnd   = moment(endDate,   'DD-MM-YYYY').endOf('day').toDate();
    const parsedResult = moment(resultPublishDate, 'DD-MM-YYYY').startOf('day').toDate();

    // Parse each assessment's examDate, startTime, endTime into a Date
    const parsedSubjects = subjects.map(subj => ({
      name: subj.name,
      assessments: subj.assessments.map(ass => {
        const examDateOnly = ass.examDate;
        const exDate = moment(examDateOnly, 'DD-MM-YYYY');
        return {
          name: ass.name,
          totalMarks: ass.totalMarks,
          passingMarks: ass.passingMarks,
          examDate: exDate.toDate(),
          startTime: moment(examDateOnly + ' ' + ass.startTime, 'DD-MM-YYYY hh:mm a').toDate(),
          endTime:   moment(examDateOnly + ' ' + ass.endTime,   'DD-MM-YYYY hh:mm a').toDate()
        };
      })
    }));

    const examData = {
      schoolId: req.user.schoolId,
      session:  req.user.session,
      createdBy: req.user._id,
      updatedBy: req.user._id,

      name,
      examType,
      term,
      classNames,
      sections,
      subjects: parsedSubjects,

      startDate: parsedStart,
      endDate:   parsedEnd,
      resultPublishDate: parsedResult,
      gradeSystem
    };

    // Check duplicates
    const exists = await Exam.findOne({
      schoolId: examData.schoolId,
      session:  examData.session,
      examType,
      classNames,
      sections,
      startDate: parsedStart,
      endDate: parsedEnd
    });
    if (exists) {
      return res.status(400).json({ success: false, message: 'An exam with these details already exists.' });
    }

    const exam = new Exam(examData);
    await exam.save();

    res.status(201).json({ success: true, message: 'Exam created successfully', exam });
  } catch (error) {
    console.error('Error in createAdminExam:', error);
    res.status(500).json({ success: false, message: 'Failed to create exam', error: error.message });
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
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { examId } = req.params;
    const raw = req.body;
    const updateData = { updatedBy: req.user._id, updatedAt: new Date() };

    // 1️⃣ Parse top‑level dates if provided
    if (raw.startDate) {
      updateData.startDate = moment(raw.startDate, 'DD-MM-YYYY')
                              .startOf('day').toDate();
    }
    if (raw.endDate) {
      updateData.endDate = moment(raw.endDate, 'DD-MM-YYYY')
                            .endOf('day').toDate();
    }
    if (raw.resultPublishDate) {
      updateData.resultPublishDate = moment(raw.resultPublishDate, 'DD-MM-YYYY')
                                      .startOf('day').toDate();
    }

    // 2️⃣ Parse subjects if provided
    if (raw.subjects) {
      updateData.subjects = raw.subjects.map(subj => ({
        name: subj.name,
        assessments: subj.assessments.map(ass => {
          const dateOnly = ass.examDate;
          return {
            name: ass.name,
            totalMarks: ass.totalMarks,
            passingMarks: ass.passingMarks,
            examDate: moment(dateOnly, 'DD-MM-YYYY').toDate(),
            startTime: moment(`${dateOnly} ${ass.startTime}`, 'DD-MM-YYYY hh:mm a').toDate(),
            endTime:   moment(`${dateOnly} ${ass.endTime}`,   'DD-MM-YYYY hh:mm a').toDate(),
          };
        })
      }));
    }

    // 3️⃣ Copy over any other simple fields (name, examType, term, classNames, sections, gradeSystem…)
    //    These will only overwrite if present in the body.
    [
      'name','examType','term',
      'classNames','sections','gradeSystem'
    ].forEach(field => {
      if (raw[field] !== undefined) {
        updateData[field] = raw[field];
      }
    });

    // 4️⃣ Run the update
    const exam = await Exam.findOneAndUpdate(
      { examId, schoolId: req.user.schoolId, session: req.user.session },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }
    res.status(200).json({ success: true, message: 'Exam updated', exam });

  } catch (error) {
    console.error('Error in updateAdminExam:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update exam',
      error: error.message
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
          const examSubject = exam.subjects.find(
            (s) => s.name === m.subjectName
          );
          if (!examSubject)
            throw new Error(`Subject ${m.subjectName} not found in exam.`);
          if (m.marks > examSubject.totalMarks)
            throw new Error(`Marks exceed total for ${m.subjectName}.`);
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
