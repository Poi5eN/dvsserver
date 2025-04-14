const AdminInfo = require('../models/adminModel');
const PhotoModel = require('../models/photoModel');
const NewStudentModel = require('../models/newStudentModel');
const classModel = require('../models/classModel');
const ParentModel = require('../models/parentModel');
const sendEmail = require("../utils/email");
const { hashPassword } = require('./authController');
const cloudinary = require('cloudinary');
const s3 = require('../config/minio');
const getDataUri = require("../utils/dataUri");
const { generateStructuredNumber } = require('../utils/numberGenerator');
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Generate Admission Number
const generateAdmissionNumber = async (schoolId, Model) => {
  return generateStructuredNumber(schoolId, Model, 'admissionNumber');
};

/**
 * Create Admission (Third-Party)
 */
exports.createAdmission = async (req, res) => {
  try {
    const { schoolId } = req.body;
    const session = req.user.session;
    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to create admissions for this school.",
      });
    }

    const {
      studentFullName, studentEmail, studentPassword, studentDateOfBirth, studentGender, studentJoiningDate,
      studentAddress, studentContact, studentClass, studentSection, studentCountry, studentSubject,
      fatherName, motherName, guardianName, remarks, transport, parentEmail, parentPassword, parentContact,
      parentIncome, parentQualification, religion, caste, nationality, pincode, state, city,
      studentAdmissionNumber, parentAdmissionNumber, rollNo,
      // UDISE+ fields
      stu_id, studentUdiseClass, studentUdiseSection, roll_no, student_name, studentUdiseGender, DOB,
      aadhar_no, aadhar_name, paddress, udisePlusPincode, mobile_no, alt_mobile_no, email_id,
      mothere_tougue, category, minority, is_bpl, is_aay, ews_aged_group, is_cwsn, cwsn_imp_type,
      ind_national, mainstramed_child, adm_no, adm_date, stu_stream, pre_year_schl_status, pre_year_class,
      stu_ward, pre_class_exam_app, result_pre_exam, perc_pre_class, att_pre_class, fac_free_uniform,
      fac_free_textbook, received_central_scholarship, name_central_scholarship, received_state_scholarship,
      received_other_scholarship, scholarship_amount, fac_provided_cwsn, SLD_type, aut_spec_disorder,
      ADHD, inv_ext_curr_activity, vocational_course, trade_sector_id, job_role_id, pre_app_exam_vocationalsubject,
      bpl_card_no, ann_card_no,
    } = req.body;

    // Validation
    if (!studentFullName) return res.status(400).json({ success: false, message: "Student name is required." });
    if (!studentEmail) return res.status(400).json({ success: false, message: "Student email is required." });
    if (!studentPassword) return res.status(400).json({ success: false, message: "Student password is required." });
    if (!studentJoiningDate) return res.status(400).json({ success: false, message: "Student joining date is required." });
    if (!studentClass) return res.status(400).json({ success: false, message: "Student class is required." });
    if (!fatherName) return res.status(400).json({ success: false, message: "Father's name is required." });
    if (!parentEmail) return res.status(400).json({ success: false, message: "Parent email is required." });
    if (!parentPassword) return res.status(400).json({ success: false, message: "Parent password is required." });

    const existingStudent = await NewStudentModel.findOne({ email: studentEmail, schoolId });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student already exists with this email in this school.",
      });
    }

    const studentHashedPassword = await hashPassword(studentPassword);
    const parentHashedPassword = await hashPassword(parentPassword);

    const files = req.files || [];
    let studentImageResult = {}, fatherImageResult = {}, motherImageResult = {}, guardianImageResult = {};
    const studentFile = files.studentPhoto || files.find(f => f.fieldname === "studentImage");
    const fatherFile = files.find(f => f.fieldname === "fatherImage");
    const motherFile = files.find(f => f.fieldname === "motherImage");
    const guardianFile = files.find(f => f.fieldname === "guardianImage");

    if (studentFile) {
      const fileKey = `students/${Date.now()}-${studentFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: studentFile.buffer, ContentType: studentFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      studentImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (fatherFile) {
      const fileKey = `students/father/${Date.now()}-${fatherFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: fatherFile.buffer, ContentType: fatherFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      fatherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (motherFile) {
      const fileKey = `students/mother/${Date.now()}-${motherFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: motherFile.buffer, ContentType: motherFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      motherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianFile) {
      const fileKey = `students/guardian/${Date.now()}-${guardianFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: guardianFile.buffer, ContentType: guardianFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      guardianImageResult = { public_id: fileKey, url: minioData.Location };
    }

    const studentAdmissionNumberToUse = studentAdmissionNumber && studentAdmissionNumber.trim() !== "" 
      ? studentAdmissionNumber 
      : await generateAdmissionNumber(schoolId, NewStudentModel);

    // Match NewStudentModel schema
    const studentData = await NewStudentModel.create({
      studentId: uuidv4(),
      schoolId,
      session,
      studentName: studentFullName, // Changed from fullName
      email: studentEmail,
      password: studentHashedPassword,
      dateOfBirth: studentDateOfBirth,
      motherName,
      fatherName,
      parentContact: parentContact, // Added for schema
      role: "student", // Default per schema
      rollNo,
      status: "active", // Default per schema
      gender: studentGender,
      joiningDate: studentJoiningDate,
      address: studentAddress,
      contact: studentContact,
      class: studentClass,
      section: studentSection,
      country: studentCountry,
      subject: studentSubject ? studentSubject.split(",") : [],
      guardianName,
      remarks,
      transport,
      base64: undefined, // Not provided in request
      studentImage: studentImageResult.url ? studentImageResult : { public_id: "", url: "" },
      fatherImage: fatherImageResult.url ? fatherImageResult : { public_id: "", url: "" },
      motherImage: motherImageResult.url ? motherImageResult : { public_id: "", url: "" },
      guardianImage: guardianImageResult.url ? guardianImageResult : { public_id: "", url: "" },
      admissionNumber: studentAdmissionNumberToUse,
      isGenerated: !studentAdmissionNumber,
      religion,
      caste,
      nationality,
      pincode,
      state,
      city,
      approvalStatus: "pending",
      isNewAdmission: true, // Default per schema
      assignedThirdParty: req.user.userId,
      udisePlusDetails: {
        stu_id,
        class: studentUdiseClass,
        section: studentUdiseSection,
        roll_no,
        student_name,
        gender: studentUdiseGender,
        DOB,
        mother_name: motherName,
        father_name: fatherName,
        guardian_name: guardianName,
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
        { admissionNumber: parentAdmissionNumber, schoolId },
        { $push: { studentIds: studentData._id }, $addToSet: { studentNames: studentFullName } },
        { new: true }
      );
      if (!parentData) {
        return res.status(400).json({
          success: false,
          message: "Parent with provided admission number does not exist.",
        });
      }
    } else {
      const parentFile = files.find(f => f.fieldname === "parentImage");
      let parentImageResult = {};
      if (parentFile) {
        const fileKey = `parents/${Date.now()}-${parentFile.originalname}`;
        const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: parentFile.buffer, ContentType: parentFile.mimetype, ACL: "public-read" };
        const minioData = await s3.upload(params).promise();
        parentImageResult = { public_id: fileKey, url: minioData.Location };
      }

      const parentAdmissionNumberGenerated = await generateAdmissionNumber(schoolId, ParentModel);
      // Match ParentModel schema
      parentData = await ParentModel.create({
        parentId: uuidv4(),
        schoolId,
        session,
        studentIds: [studentData._id],
        studentNames: [studentFullName],
        fatherName, // Changed from fullName
        motherName,
        email: parentEmail,
        password: parentHashedPassword,
        status: "active", // Default per schema
        contact: parentContact,
        role: "parent", // Default per schema
        parentImage: parentImageResult.url ? parentImageResult : { public_id: "", url: "" },
        fatherImage: fatherImageResult.url ? fatherImageResult : { public_id: "", url: "" },
        motherImage: motherImageResult.url ? motherImageResult : { public_id: "", url: "" },
        guardianImage: guardianImageResult.url ? guardianImageResult : { public_id: "", url: "" },
        admissionNumber: parentAdmissionNumberGenerated,
        base64: undefined, // Not provided in request
        income: parentIncome ? Number(parentIncome) : undefined,
        qualification: parentQualification,
        guardianName,
        createdBy: req.user._id || mongoose.Types.ObjectId(req.user.userId),
      });
    }

    if (parentData) {
      studentData.parentId = parentData._id.toString();
      studentData.parentAdmissionNumber = parentData.admissionNumber;
      await studentData.save();

      const parentEmailContent = `<p>Your login credentials are as follows:</p><p>Email: ${parentEmail}</p><p>Password: ${parentPassword}</p>`;
      await sendEmail(parentEmail, "Parent Login Credentials", parentEmailContent);
    }

    const schoolDetails = await AdminInfo.findOne({ schoolId }).select('schoolName image.url');
    const schoolName = schoolDetails?.schoolName || 'Your School';
    const schoolImageUrl = schoolDetails?.image?.url || 'https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg';
    const softwareLogoUrl = 'https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png';

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
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">We’re thrilled to welcome you to ${schoolName}! Your admission has been submitted and is awaiting approval.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Admission Details</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Student Name:</strong> ${studentFullName}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Class:</strong> ${studentClass}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Admission Number:</strong> ${studentAdmissionNumberToUse}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Status:</strong> <span style="color: #ff5600; font-weight: bold;">Pending Approval</span></p>
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Hang tight! We’re reviewing your details and will notify you once approved. Your journey starts on ${studentJoiningDate}.</p>
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
    await sendEmail(studentEmail, "Admission Confirmation", studentEmailContent);

    return res.status(201).json({
      success: true,
      message: "Admission created successfully and is pending admin approval.",
      student: studentData,
      parent: parentData,
    });
  } catch (error) {
    console.error("Error in createAdmission:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create admission.",
      error: error.message,
    });
  }
};

/**
 * Edit Admission (Third-Party)
 */
exports.editAdmission = async (req, res) => {
  try {
    const { studentId } = req.params; // Now studentId is UUID
    const { schoolId } = req.body;

    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to edit admissions for this school.",
      });
    }

    const student = await NewStudentModel.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    if (student.schoolId !== schoolId) {
      return res.status(403).json({
        success: false,
        message: "This admission does not belong to the specified school.",
      });
    }

    const formData = req.body;
    const files = req.files || [];

    if (!process.env.MINIO_BUCKET) {
      throw new Error("MinIO bucket configuration is missing.");
    }

    let studentImageResult = student.studentImage || { public_id: "", url: "" };
    let fatherImageResult = student.fatherImage || { public_id: "", url: "" };
    let motherImageResult = student.motherImage || { public_id: "", url: "" };
    let guardianImageResult = student.guardianImage || { public_id: "", url: "" };

    const studentFile = files.find(f => f.fieldname === "studentImage");
    const fatherFile = files.find(f => f.fieldname === "fatherImage");
    const motherFile = files.find(f => f.fieldname === "motherImage");
    const guardianFile = files.find(f => f.fieldname === "guardianImage");

    if (studentFile) {
      if (studentImageResult.public_id) {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: studentImageResult.public_id }).promise();
      }
      const fileKey = `students/${Date.now()}-${studentFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: studentFile.buffer, ContentType: studentFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      studentImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (fatherFile) {
      if (fatherImageResult.public_id) {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: fatherImageResult.public_id }).promise();
      }
      const fileKey = `students/father/${Date.now()}-${fatherFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: fatherFile.buffer, ContentType: fatherFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      fatherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (motherFile) {
      if (motherImageResult.public_id) {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: motherImageResult.public_id }).promise();
      }
      const fileKey = `students/mother/${Date.now()}-${motherFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: motherFile.buffer, ContentType: motherFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      motherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianFile) {
      if (guardianImageResult.public_id) {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: guardianImageResult.public_id }).promise();
      }
      const fileKey = `students/guardian/${Date.now()}-${guardianFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: guardianFile.buffer, ContentType: guardianFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      guardianImageResult = { public_id: fileKey, url: minioData.Location };
    }

    let studentHashPassword = student.password;
    if (formData.studentPassword) {
      if (formData.studentPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Student password must be at least 8 characters long.",
        });
      }
      studentHashPassword = await hashPassword(formData.studentPassword);
    }

    // Match NewStudentModel schema
    const updateStudentFields = {
      studentName: formData.studentFullName || student.studentName,
      email: formData.studentEmail || student.email,
      password: studentHashPassword,
      dateOfBirth: formData.studentDateOfBirth || student.dateOfBirth,
      motherName: formData.motherName || student.motherName,
      fatherName: formData.fatherName || student.fatherName,
      parentContact: formData.studentContact ? Number(formData.studentContact) : student.parentContact,
      rollNo: formData.rollNo || student.rollNo,
      gender: formData.studentGender || student.gender,
      joiningDate: formData.studentJoiningDate || student.joiningDate,
      address: formData.studentAddress || student.address,
      contact: formData.studentContact ? Number(formData.studentContact) : student.contact,
      class: formData.studentClass || student.class,
      section: formData.studentSection || student.section,
      country: formData.studentCountry || student.country,
      subject: formData.studentSubject ? formData.studentSubject.split(",") : student.subject,
      guardianName: formData.guardianName || student.guardianName,
      remarks: formData.remarks || student.remarks,
      transport: formData.transport || student.transport,
      base64: formData.base64 || student.base64,
      studentImage: studentImageResult,
      fatherImage: fatherImageResult,
      motherImage: motherImageResult,
      guardianImage: guardianImageResult,
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
        mother_name: formData.motherName || student.udisePlusDetails?.mother_name,
        father_name: formData.fatherName || student.udisePlusDetails?.father_name,
        guardian_name: formData.guardianName || student.udisePlusDetails?.guardian_name,
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
      { studentId },
      updateStudentFields,
      { new: true, runValidators: true }
    );

    if (formData.parentId) {
      const parent = await ParentModel.findOne({ parentId: formData.parentId });
      if (!parent) {
        return res.status(404).json({ success: false, message: "Parent not found." });
      }

      let parentImageResult = parent.parentImage || { public_id: "", url: "" };
      let pFatherImageResult = parent.fatherImage || { public_id: "", url: "" };
      let pMotherImageResult = parent.motherImage || { public_id: "", url: "" };
      let pGuardianImageResult = parent.guardianImage || { public_id: "", url: "" };

      const parentFile = files.find(f => f.fieldname === "parentImage");
      if (parentFile) {
        if (parentImageResult.public_id) {
          await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: parentImageResult.public_id }).promise();
        }
        const fileKey = `parents/${Date.now()}-${parentFile.originalname}`;
        const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: parentFile.buffer, ContentType: parentFile.mimetype, ACL: "public-read" };
        const minioData = await s3.upload(params).promise();
        parentImageResult = { public_id: fileKey, url: minioData.Location };
      }
      if (fatherFile) {
        if (pFatherImageResult.public_id) {
          await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: pFatherImageResult.public_id }).promise();
        }
        const fileKey = `parents/father/${Date.now()}-${fatherFile.originalname}`;
        const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: fatherFile.buffer, ContentType: fatherFile.mimetype, ACL: "public-read" };
        const minioData = await s3.upload(params).promise();
        pFatherImageResult = { public_id: fileKey, url: minioData.Location };
      }
      if (motherFile) {
        if (pMotherImageResult.public_id) {
          await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: pMotherImageResult.public_id }).promise();
        }
        const fileKey = `parents/mother/${Date.now()}-${motherFile.originalname}`;
        const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: motherFile.buffer, ContentType: motherFile.mimetype, ACL: "public-read" };
        const minioData = await s3.upload(params).promise();
        pMotherImageResult = { public_id: fileKey, url: minioData.Location };
      }
      if (guardianFile) {
        if (pGuardianImageResult.public_id) {
          await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: pGuardianImageResult.public_id }).promise();
        }
        const fileKey = `parents/guardian/${Date.now()}-${guardianFile.originalname}`;
        const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: guardianFile.buffer, ContentType: guardianFile.mimetype, ACL: "public-read" };
        const minioData = await s3.upload(params).promise();
        pGuardianImageResult = { public_id: fileKey, url: minioData.Location };
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

      // Match ParentModel schema
      const updateParentFields = {
        fatherName: formData.fatherName || parent.fatherName,
        motherName: formData.motherName || parent.motherName,
        email: formData.parentEmail || parent.email,
        password: parentHashPassword,
        contact: formData.parentContact || parent.contact,
        income: formData.parentIncome ? Number(formData.parentIncome) : parent.income,
        qualification: formData.parentQualification || parent.qualification,
        guardianName: formData.guardianName || parent.guardianName,
        parentImage: parentImageResult,
        fatherImage: pFatherImageResult,
        motherImage: pMotherImageResult,
        guardianImage: pGuardianImageResult,
      };

      await ParentModel.findOneAndUpdate(
        { parentId: formData.parentId },
        updateParentFields,
        { new: true, runValidators: true }
      );
    }

    res.status(200).json({
      success: true,
      message: "Admission updated successfully",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Error in editAdmission:", error);
    res.status(500).json({ success: false, message: "Failed to update admission.", error: error.message });
  }
};

/**
 * Get All Students for Third-Party (Admissions)
 */
exports.getAllStudentsForThirdParty = async (req, res) => {
  try {
    if (!req.user || !req.user.assignedSchools) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed or no assigned schools',
      });
    }

    const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
    let filterSchoolIds = assignedSchoolIds;

    if (req.query.schoolId) {
      const requestedSchoolId = req.query.schoolId;
      if (!assignedSchoolIds.includes(requestedSchoolId)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this school',
        });
      }
      filterSchoolIds = [requestedSchoolId];
    }

    const page = parseInt(req.query.page) || 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const skip = limit ? (page - 1) * limit : 0;

    const query = NewStudentModel.find({
      schoolId: { $in: filterSchoolIds },
    })
      .select(
        'studentId schoolId session studentName email dateOfBirth motherName fatherName parentContact rollNo parentId parentAdmissionNumber status gender joiningDate address contact class section country subject guardianName remarks transport base64 studentImage fatherImage motherImage guardianImage admissionNumber isGenerated religion caste nationality pincode state city approvalStatus isNewAdmission assignedThirdParty createdAt udisePlusDetails'
      )
      .sort({ createdAt: -1 });

    if (limit) {
      query.skip(skip).limit(limit);
    }

    const students = await query.lean().exec();
    const totalStudents = await NewStudentModel.countDocuments({
      schoolId: { $in: filterSchoolIds },
    });

    // Manually fetch parent data for each student
    for (let student of students) {
      if (student.parentId) {
        const parent = await ParentModel.findOne({ parentId: student.parentId }).select(
          'parentId schoolId session studentIds studentNames fatherName motherName email status contact role parentImage fatherImage motherImage guardianImage admissionNumber income qualification guardianName createdBy createdAt'
        ).lean();
        student.parent = parent || null; // Add parent data or null if not found
      } else {
        student.parent = null;
      }
    }

    const count = limit ? students.length : totalStudents;

    return res.status(200).json({
      success: true,
      message: 'Students fetched successfully',
      count,
      data: students,
      pagination: limit ? {
        currentPage: page,
        totalPages: Math.ceil(totalStudents / limit),
        totalStudents,
      } : { totalStudents },
    });
  } catch (error) {
    console.error('Error fetching students for third-party:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message,
    });
  }
};

/**
 * Get Students by School
 */
exports.getStudentsBySchool = async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) {
      return res.status(400).json({ success: false, message: "Please provide a schoolId" });
    }
    const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
    if (!assignedSchoolIds.includes(schoolId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this school."
      });
    }
    const students = await NewStudentModel.find({ schoolId });
    return res.status(200).json({
      success: true,
      message: "Students fetched successfully",
      data: students
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get Students by Class and Section (Third-Party)
 */
exports.getStudentsByClassSectionThirdParty = async (req, res) => {
  try {
    const { schoolId, studentClass, studentSection } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    if (schoolId) {
      const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this school."
        });
      }
      query.schoolId = schoolId;
    } else {
      query.schoolId = { $in: req.user.assignedSchools.map(s => s.schoolId) };
    }

    if (studentClass) query.class = studentClass;
    if (studentSection) query.section = studentSection;

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
        totalStudents
      }
    });
  } catch (error) {
    console.error("Error in getStudentsByClassSectionThirdParty:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get My Admissions
 */
exports.getMyAdmissions = async (req, res) => {
  try {
    const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);

    const students = await NewStudentModel.find({
      schoolId: { $in: assignedSchoolIds },
      assignedThirdParty: req.user.userId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Your admissions fetched successfully',
      data: students,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get My Admissions by School
 */
exports.getMyAdmissionsBySchool = async (req, res) => {
  try {
    const { schoolId, class: studentClass, section: studentSection } = req.query;
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'Please provide a schoolId' });
    }

    const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
    if (!assignedSchoolIds.includes(schoolId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this school',
      });
    }

    const query = {
      schoolId,
      assignedThirdParty: req.user.userId,
    };
    if (studentClass) query.class = studentClass;
    if (studentSection) query.section = studentSection;

    const students = await NewStudentModel.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Your admissions for the school fetched successfully',
      data: students,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update My Student
 */
exports.updateMyStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const updateData = req.body;

    const student = await NewStudentModel.findOne({studentId});
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
    if (!assignedSchoolIds.includes(student.schoolId) || student.assignedThirdParty !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this student',
      });
    }

    delete updateData.schoolId;
    delete updateData.assignedThirdParty;
    delete updateData.approvalStatus;

    // Match NewStudentModel schema
    if (updateData.studentFullName) student.studentName = updateData.studentFullName;
    if (updateData.studentEmail) student.email = updateData.studentEmail;
    if (updateData.studentPassword) {
      if (updateData.studentPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters long.",
        });
      }
      student.password = await hashPassword(updateData.studentPassword);
    }
    if (updateData.studentDateOfBirth) student.dateOfBirth = updateData.studentDateOfBirth;
    if (updateData.motherName) student.motherName = updateData.motherName;
    if (updateData.fatherName) student.fatherName = updateData.fatherName;
    if (updateData.studentContact) student.parentContact = Number(updateData.studentContact);
    if (updateData.rollNo) student.rollNo = updateData.rollNo;
    if (updateData.studentGender) student.gender = updateData.studentGender;
    if (updateData.studentJoiningDate) student.joiningDate = updateData.studentJoiningDate;
    if (updateData.studentAddress) student.address = updateData.studentAddress;
    if (updateData.studentContact) student.contact = Number(updateData.studentContact);
    if (updateData.studentClass) student.class = updateData.studentClass;
    if (updateData.studentSection) student.section = updateData.studentSection;
    if (updateData.studentCountry) student.country = updateData.studentCountry;
    if (updateData.studentSubject) student.subject = updateData.studentSubject.split(",");
    if (updateData.guardianName) student.guardianName = updateData.guardianName;
    if (updateData.remarks) student.remarks = updateData.remarks;
    if (updateData.transport) student.transport = updateData.transport;
    if (updateData.base64) student.base64 = updateData.base64;
    if (updateData.religion) student.religion = updateData.religion;
    if (updateData.caste) student.caste = updateData.caste;
    if (updateData.nationality) student.nationality = updateData.nationality;
    if (updateData.pincode) student.pincode = updateData.pincode;
    if (updateData.state) student.state = updateData.state;
    if (updateData.city) student.city = updateData.city;
    if (updateData.udisePlusDetails) {
      Object.assign(student.udisePlusDetails, updateData.udisePlusDetails);
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      student,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update Any Student
 */
exports.updateAnyStudent = async (req, res) => {
  try {
    const { studentId } = req.params; // UUID
    const updateData = req.body;

    const student = await NewStudentModel.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
    if (!assignedSchoolIds.includes(student.schoolId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to edit students from this school',
      });
    }

    delete updateData.schoolId;
    delete updateData.assignedThirdParty;
    delete updateData.approvalStatus;

    // Match NewStudentModel schema
    if (updateData.studentFullName) student.studentName = updateData.studentFullName;
    if (updateData.studentEmail) student.email = updateData.studentEmail;
    if (updateData.studentPassword) {
      if (updateData.studentPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters long.",
        });
      }
      student.password = await hashPassword(updateData.studentPassword);
    }
    if (updateData.studentDateOfBirth) student.dateOfBirth = updateData.studentDateOfBirth;
    if (updateData.motherName) student.motherName = updateData.motherName;
    if (updateData.fatherName) student.fatherName = updateData.fatherName;
    if (updateData.studentContact) student.parentContact = Number(updateData.studentContact);
    if (updateData.rollNo) student.rollNo = updateData.rollNo;
    if (updateData.studentGender) student.gender = updateData.studentGender;
    if (updateData.studentJoiningDate) student.joiningDate = updateData.studentJoiningDate;
    if (updateData.studentAddress) student.address = updateData.studentAddress;
    if (updateData.studentContact) student.contact = Number(updateData.studentContact);
    if (updateData.studentClass) student.class = updateData.studentClass;
    if (updateData.studentSection) student.section = updateData.studentSection;
    if (updateData.studentCountry) student.country = updateData.studentCountry;
    if (updateData.studentSubject) student.subject = updateData.studentSubject.split(",");
    if (updateData.guardianName) student.guardianName = updateData.guardianName;
    if (updateData.remarks) student.remarks = updateData.remarks;
    if (updateData.transport) student.transport = updateData.transport;
    if (updateData.base64) student.base64 = updateData.base64;
    if (updateData.religion) student.religion = updateData.religion;
    if (updateData.caste) student.caste = updateData.caste;
    if (updateData.nationality) student.nationality = updateData.nationality;
    if (updateData.pincode) student.pincode = updateData.pincode;
    if (updateData.state) student.state = updateData.state;
    if (updateData.city) student.city = updateData.city;
    if (updateData.udisePlusDetails) {
      Object.assign(student.udisePlusDetails, updateData.udisePlusDetails);
    }

    await student.save();

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      student,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get My Students by School
 */
exports.getMyStudentsBySchool = async (req, res) => {
  try {
    const { schoolId } = req.query;
    if (!schoolId) {
      return res.status(400).json({ success: false, message: 'Please provide a schoolId' });
    }

    const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
    if (!assignedSchoolIds.includes(schoolId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this school',
      });
    }

    const students = await NewStudentModel.find({
      schoolId,
      assignedThirdParty: req.user.userId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Your students for the school fetched successfully',
      data: students,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Classes for School
 */
exports.getClassesForSchool = async (req, res) => {
  try {
    const schoolId = req.query.schoolId;
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID is required",
      });
    }

    const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
    if (!assignedSchoolIds.includes(schoolId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this school",
      });
    }

    const classList = await classModel.find({ schoolId });

    const formattedClassList = classList.map(classItem => ({
      ...classItem._doc,
      sections: classItem.sections.join(", "),
      subjects: classItem.subjects.join(", "),
    }));

    res.status(200).json({
      success: true,
      message: "Class list fetched successfully",
      classList: formattedClassList,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Class list not fetched due to an error",
      error: error.message,
    });
  }
};

/**
 * Create Student Only (Third-Party)
 */
exports.createStudentOnlyThirdParty = async (req, res) => {
  try {
    const { schoolId } = req.body;
    const session = req.user.session;
    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to create students for this school.",
      });
    }

    const {
      studentFullName, studentEmail, studentPassword, studentDateOfBirth, studentGender, studentJoiningDate,
      studentAddress, studentContact, studentClass, studentSection, studentCountry, studentSubject,
      fatherName, motherName, guardianName, remarks, transport, religion, caste, nationality, pincode, state, city,
      studentAdmissionNumber, rollNo,
      // UDISE+ fields
      stu_id, studentUdiseClass, studentUdiseSection, roll_no, student_name, studentUdiseGender, DOB,
      aadhar_no, aadhar_name, paddress, udisePlusPincode, mobile_no, alt_mobile_no, email_id,
      mothere_tougue, category, minority, is_bpl, is_aay, ews_aged_group, is_cwsn, cwsn_imp_type,
      ind_national, mainstramed_child, adm_no, adm_date, stu_stream, pre_year_schl_status, pre_year_class,
      stu_ward, pre_class_exam_app, result_pre_exam, perc_pre_class, att_pre_class, fac_free_uniform,
      fac_free_textbook, received_central_scholarship, name_central_scholarship, received_state_scholarship,
      received_other_scholarship, scholarship_amount, fac_provided_cwsn, SLD_type, aut_spec_disorder,
      ADHD, inv_ext_curr_activity, vocational_course, trade_sector_id, job_role_id, pre_app_exam_vocationalsubject,
      bpl_card_no, ann_card_no,
    } = req.body;

    if (!studentFullName) return res.status(400).json({ success: false, message: "Student name is required." });
    if (!studentEmail) return res.status(400).json({ success: false, message: "Student email is required." });
    if (!studentPassword) return res.status(400).json({ success: false, message: "Student password is required." });
    if (!studentJoiningDate) return res.status(400).json({ success: false, message: "Student joining date is required." });
    if (!studentClass) return res.status(400).json({ success: false, message: "Student class is required." });

    const existingStudent = await NewStudentModel.findOne({ email: studentEmail, schoolId });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student already exists with this email in this school.",
      });
    }

    const studentHashedPassword = await hashPassword(studentPassword);

    const files = req.files || [];
    let studentImageResult = {}, fatherImageResult = {}, motherImageResult = {}, guardianImageResult = {};
    const studentFile = files.studentPhoto || files.find(f => f.fieldname === "studentImage");
    const fatherFile = files.find(f => f.fieldname === "fatherImage");
    const motherFile = files.find(f => f.fieldname === "motherImage");
    const guardianFile = files.find(f => f.fieldname === "guardianImage");

    if (studentFile) {
      const fileKey = `students/${Date.now()}-${studentFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: studentFile.buffer, ContentType: studentFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      studentImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (fatherFile) {
      const fileKey = `students/father/${Date.now()}-${fatherFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: fatherFile.buffer, ContentType: fatherFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      fatherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (motherFile) {
      const fileKey = `students/mother/${Date.now()}-${motherFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: motherFile.buffer, ContentType: motherFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      motherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianFile) {
      const fileKey = `students/guardian/${Date.now()}-${guardianFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: guardianFile.buffer, ContentType: guardianFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      guardianImageResult = { public_id: fileKey, url: minioData.Location };
    }

    const studentAdmissionNumberToUse = studentAdmissionNumber && studentAdmissionNumber.trim() !== "" 
      ? studentAdmissionNumber 
      : await generateAdmissionNumber(schoolId, NewStudentModel);

    // Match NewStudentModel schema
    const studentData = await NewStudentModel.create({
      studentId: uuidv4(),
      schoolId,
      session,
      studentName: studentFullName,
      email: studentEmail,
      password: studentHashedPassword,
      dateOfBirth: studentDateOfBirth,
      motherName,
      fatherName,
      parentContact: Number(studentContact),
      role: "student",
      rollNo,
      status: "active",
      gender: studentGender,
      joiningDate: studentJoiningDate,
      address: studentAddress,
      contact: Number(studentContact),
      class: studentClass,
      section: studentSection,
      country: studentCountry,
      subject: studentSubject ? studentSubject.split(",") : [],
      guardianName,
      remarks,
      transport,
      base64: undefined,
      studentImage: studentImageResult.url ? studentImageResult : { public_id: "", url: "" },
      fatherImage: fatherImageResult.url ? fatherImageResult : { public_id: "", url: "" },
      motherImage: motherImageResult.url ? motherImageResult : { public_id: "", url: "" },
      guardianImage: guardianImageResult.url ? guardianImageResult : { public_id: "", url: "" },
      admissionNumber: studentAdmissionNumberToUse,
      isGenerated: !studentAdmissionNumber,
      religion,
      caste,
      nationality,
      pincode,
      state,
      city,
      approvalStatus: "pending",
      isNewAdmission: true,
      assignedThirdParty: req.user.userId,
      udisePlusDetails: {
        stu_id,
        class: studentUdiseClass,
        section: studentUdiseSection,
        roll_no,
        student_name,
        gender: studentUdiseGender,
        DOB,
        mother_name: motherName,
        father_name: fatherName,
        guardian_name: guardianName,
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

    const schoolDetails = await AdminInfo.findOne({ schoolId }).select('schoolName image.url');
    const schoolName = schoolDetails?.schoolName || 'Your School';
    const studentEmailContent = `Admission created for ${studentFullName} at ${schoolName}. Awaiting approval.`;
    await sendEmail(studentEmail, "Student Admission Confirmation", studentEmailContent);

    return res.status(201).json({
      success: true,
      message: "Student created successfully and is pending admin approval.",
      student: studentData,
    });
  } catch (error) {
    console.error("Error in createStudentOnlyThirdParty:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create student.",
      error: error.message,
    });
  }
};

/**
 * Create Parent Only (Third-Party)
 */
exports.createParentOnlyThirdParty = async (req, res) => {
  try {
    const { schoolId } = req.body;
    const session = req.user.session;
    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to create parents for this school.",
      });
    }

    const {
      fatherName, motherName, guardianName, parentEmail, parentPassword, parentContact,
      parentIncome, parentQualification, parentAdmissionNumber,
    } = req.body;

    if (!fatherName) return res.status(400).json({ success: false, message: "Father's name is required." });
    if (!parentEmail) return res.status(400).json({ success: false, message: "Parent email is required." });
    if (!parentPassword) return res.status(400).json({ success: false, message: "Parent password is required." });

    const existingParent = await ParentModel.findOne({ email: parentEmail, schoolId });
    if (existingParent) {
      return res.status(400).json({
        success: false,
        message: "Parent already exists with this email in this school.",
      });
    }

    const parentHashedPassword = await hashPassword(parentPassword);

    const files = req.files || [];
    let parentImageResult = {}, fatherImageResult = {}, motherImageResult = {}, guardianImageResult = {};
    const parentFile = files.find(f => f.fieldname === "parentImage");
    const fatherFile = files.find(f => f.fieldname === "fatherImage");
    const motherFile = files.find(f => f.fieldname === "motherImage");
    const guardianFile = files.find(f => f.fieldname === "guardianImage");

    if (parentFile) {
      const fileKey = `parents/${Date.now()}-${parentFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: parentFile.buffer, ContentType: parentFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      parentImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (fatherFile) {
      const fileKey = `parents/father/${Date.now()}-${fatherFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: fatherFile.buffer, ContentType: fatherFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      fatherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (motherFile) {
      const fileKey = `parents/mother/${Date.now()}-${motherFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: motherFile.buffer, ContentType: motherFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      motherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianFile) {
      const fileKey = `parents/guardian/${Date.now()}-${guardianFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: guardianFile.buffer, ContentType: guardianFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      guardianImageResult = { public_id: fileKey, url: minioData.Location };
    }

    const parentAdmissionNumberToUse = parentAdmissionNumber && parentAdmissionNumber.trim() !== "" 
      ? parentAdmissionNumber 
      : await generateAdmissionNumber(schoolId, ParentModel);

    // Match ParentModel schema
    const parentData = await ParentModel.create({
      parentId: uuidv4(),
      schoolId,
      session,
      studentIds: [],
      studentNames: [],
      fatherName,
      motherName,
      email: parentEmail,
      password: parentHashedPassword,
      status: "active",
      contact: parentContact,
      role: "parent",
      parentImage: parentImageResult.url ? parentImageResult : { public_id: "", url: "" },
      fatherImage: fatherImageResult.url ? fatherImageResult : { public_id: "", url: "" },
      motherImage: motherImageResult.url ? motherImageResult : { public_id: "", url: "" },
      guardianImage: guardianImageResult.url ? guardianImageResult : { public_id: "", url: "" },
      admissionNumber: parentAdmissionNumberToUse,
      base64: undefined,
      income: parentIncome ? Number(parentIncome) : undefined,
      qualification: parentQualification,
      guardianName,
      createdBy: req.user._id || mongoose.Types.ObjectId(req.user.userId),
    });

    const parentEmailContent = `<p>Your login credentials are as follows:</p><p>Email: ${parentEmail}</p><p>Password: ${parentPassword}</p>`;
    await sendEmail(parentEmail, "Parent Account Created", parentEmailContent);

    return res.status(201).json({
      success: true,
      message: "Parent created successfully.",
      parent: parentData,
    });
  } catch (error) {
    console.error("Error in createParentOnlyThirdParty:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create parent.",
      error: error.message,
    });
  }
};

/**
 * Link Student to Parent (Third-Party)
 */
exports.linkStudentToParentThirdParty = async (req, res) => {
  try {
    const { studentId, parentId } = req.body; // UUIDs
    const session = req.user.session;

    const student = await NewStudentModel.findOne({ studentId });
    const parent = await ParentModel.findOne({ parentId });

    if (!student || !parent) {
      return res.status(404).json({ success: false, message: "Student or parent not found." });
    }

    const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
    if (!assignedSchoolIds.includes(student.schoolId) || !assignedSchoolIds.includes(parent.schoolId)) {
      return res.status(403).json({ success: false, message: "You do not have access to link students or parents from this school." });
    }

    if (student.session !== session || parent.session !== session) {
      return res.status(400).json({ success: false, message: "Student and parent must belong to the same session." });
    }

    if (student.parentId) {
      return res.status(400).json({ success: false, message: "Student is already linked to a parent." });
    }

    student.parentId = parentId; // Use parentId (UUID)
    student.parentAdmissionNumber = parent.admissionNumber;
    await student.save();

    parent.studentIds.push(studentId); // Use studentId (UUID)
    parent.studentNames.push(student.studentName);
    await parent.save();

    return res.status(200).json({ success: true, message: "Student linked to parent successfully", student, parent });
  } catch (error) {
    console.error("Error in linkStudentToParentThirdParty:", error);
    return res.status(500).json({ success: false, message: "Failed to link student to parent.", error: error.message });
  }
};





exports.createInitialStudentPhoto = async (req, res) => {
  try {
    const { schoolId, studentName, class: studentClass, section } = req.body;
    const session = req.user.session;
    const assignedThirdParty = req.user.userId;

    // Check access
    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to create records for this school.",
      });
    }

    // Validation
    if (!studentName) return res.status(400).json({ success: false, message: "Student name is required." });
    if (!studentClass) return res.status(400).json({ success: false, message: "Class is required." });
    if (!section) return res.status(400).json({ success: false, message: "Section is required." });

    // Handle image upload
    const files = req.files || [];
    const studentFile = files.find(f => f.fieldname === "studentImage");
    let studentImageResult = { public_id: "", url: "" };

    if (studentFile) {
      const fileKey = `students/photos/${Date.now()}-${studentFile.originalname}`;
      const params = {
        Bucket: process.env.MINIO_BUCKET,
        Key: fileKey,
        Body: studentFile.buffer,
        ContentType: studentFile.mimetype,
        ACL: "public-read",
      };
      const minioData = await s3.upload(params).promise();
      studentImageResult = { public_id: fileKey, url: minioData.Location };
    } else {
      return res.status(400).json({ success: false, message: "Student image is required." });
    }

    // Create record in PhotoModel
    const photoData = await PhotoModel.create({
      photoId: uuidv4(),
      schoolId,
      session,
      studentName,
      class: studentClass,
      section,
      studentImage: studentImageResult,
      assignedThirdParty,
    });

    return res.status(201).json({
      success: true,
      message: "Initial student photo record created successfully.",
      data: photoData,
    });
  } catch (error) {
    console.error("Error in createInitialStudentPhoto:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create initial student photo record.",
      error: error.message,
    });
  }
};

/**
 * Complete Admission from Photo (Third-Party)
 */
exports.completeAdmissionFromPhoto = async (req, res) => {
  try {
    const { photoId, schoolId } = req.body;
    const session = req.user.session;

    // Check access
    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to create admissions for this school.",
      });
    }

    // Find photo record
    const photo = await PhotoModel.findOne({ photoId, schoolId });
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: "Photo record not found.",
      });
    }

    const {
      studentEmail, studentPassword, studentDateOfBirth, studentGender, studentJoiningDate,
      studentAddress, studentContact, studentCountry, studentSubject,
      fatherName, motherName, guardianName, remarks, transport, parentEmail, parentPassword, parentContact,
      parentIncome, parentQualification, religion, caste, nationality, pincode, state, city,
      studentAdmissionNumber, parentAdmissionNumber, rollNo,
      // UDISE+ fields
      stu_id, studentUdiseClass, studentUdiseSection, roll_no, student_name, studentUdiseGender, DOB,
      aadhar_no, aadhar_name, paddress, udisePlusPincode, mobile_no, alt_mobile_no, email_id,
      mothere_tougue, category, minority, is_bpl, is_aay, ews_aged_group, is_cwsn, cwsn_imp_type,
      ind_national, mainstramed_child, adm_no, adm_date, stu_stream, pre_year_schl_status, pre_year_class,
      stu_ward, pre_class_exam_app, result_pre_exam, perc_pre_class, att_pre_class, fac_free_uniform,
      fac_free_textbook, received_central_scholarship, name_central_scholarship, received_state_scholarship,
      received_other_scholarship, scholarship_amount, fac_provided_cwsn, SLD_type, aut_spec_disorder,
      ADHD, inv_ext_curr_activity, vocational_course, trade_sector_id, job_role_id, pre_app_exam_vocationalsubject,
      bpl_card_no, ann_card_no,
    } = req.body;

    // Validation
    if (!studentEmail) return res.status(400).json({ success: false, message: "Student email is required." });
    if (!studentPassword) return res.status(400).json({ success: false, message: "Student password is required." });
    if (!studentJoiningDate) return res.status(400).json({ success: false, message: "Student joining date is required." });
    if (!fatherName) return res.status(400).json({ success: false, message: "Father's name is required." });
    if (!parentEmail) return res.status(400).json({ success: false, message: "Parent email is required." });
    if (!parentPassword) return res.status(400).json({ success: false, message: "Parent password is required." });

    // Check for existing student
    const existingStudent = await NewStudentModel.findOne({ email: studentEmail, schoolId });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student already exists with this email in this school.",
      });
    }

    // Hash passwords
    const studentHashedPassword = await hashPassword(studentPassword);
    const parentHashedPassword = await hashPassword(parentPassword);

    // Handle additional images
    const files = req.files || [];
    let fatherImageResult = {}, motherImageResult = {}, guardianImageResult = {};
    const fatherFile = files.find(f => f.fieldname === "fatherImage");
    const motherFile = files.find(f => f.fieldname === "motherImage");
    const guardianFile = files.find(f => f.fieldname === "guardianImage");

    if (fatherFile) {
      const fileKey = `students/father/${Date.now()}-${fatherFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: fatherFile.buffer, ContentType: fatherFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      fatherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (motherFile) {
      const fileKey = `students/mother/${Date.now()}-${motherFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: motherFile.buffer, ContentType: motherFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      motherImageResult = { public_id: fileKey, url: minioData.Location };
    }
    if (guardianFile) {
      const fileKey = `students/guardian/${Date.now()}-${guardianFile.originalname}`;
      const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: guardianFile.buffer, ContentType: guardianFile.mimetype, ACL: "public-read" };
      const minioData = await s3.upload(params).promise();
      guardianImageResult = { public_id: fileKey, url: minioData.Location };
    }

    // Generate admission numbers
    const studentAdmissionNumberToUse = studentAdmissionNumber && studentAdmissionNumber.trim() !== ""
      ? studentAdmissionNumber
      : await generateAdmissionNumber(schoolId, NewStudentModel);

    // Create student record
    const studentData = await NewStudentModel.create({
      studentId: uuidv4(),
      schoolId,
      session,
      studentName: photo.studentName,
      email: studentEmail,
      password: studentHashedPassword,
      dateOfBirth: studentDateOfBirth,
      motherName,
      fatherName,
      parentContact: parentContact,
      role: "student",
      rollNo,
      status: "active",
      gender: studentGender,
      joiningDate: studentJoiningDate,
      address: studentAddress,
      contact: studentContact,
      class: photo.class,
      section: photo.section,
      country: studentCountry,
      subject: studentSubject ? studentSubject.split(",") : [],
      guardianName,
      remarks,
      transport,
      base64: undefined,
      studentImage: photo.studentImage,
      fatherImage: fatherImageResult.url ? fatherImageResult : { public_id: "", url: "" },
      motherImage: motherImageResult.url ? motherImageResult : { public_id: "", url: "" },
      guardianImage: guardianImageResult.url ? guardianImageResult : { public_id: "", url: "" },
      admissionNumber: studentAdmissionNumberToUse,
      isGenerated: !studentAdmissionNumber,
      religion,
      caste,
      nationality,
      pincode,
      state,
      city,
      approvalStatus: "pending",
      isNewAdmission: true,
      assignedThirdParty: req.user.userId,
      photoId: photoId, // Link to photoId
      udisePlusDetails: {
        stu_id,
        class: studentUdiseClass,
        section: studentUdiseSection,
        roll_no,
        student_name,
        gender: studentUdiseGender,
        DOB,
        mother_name: motherName,
        father_name: fatherName,
        guardian_name: guardianName,
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

    // Create or update parent record
    let parentData = null;
    if (parentAdmissionNumber) {
      parentData = await ParentModel.findOneAndUpdate(
        { admissionNumber: parentAdmissionNumber, schoolId },
        { $push: { studentIds: studentData._id }, $addToSet: { studentNames: photo.studentName } },
        { new: true }
      );
      if (!parentData) {
        return res.status(400).json({
          success: false,
          message: "Parent with provided admission number does not exist.",
        });
      }
    } else {
      const parentFile = files.find(f => f.fieldname === "parentImage");
      let parentImageResult = {};
      if (parentFile) {
        const fileKey = `parents/${Date.now()}-${parentFile.originalname}`;
        const params = { Bucket: process.env.MINIO_BUCKET, Key: fileKey, Body: parentFile.buffer, ContentType: parentFile.mimetype, ACL: "public-read" };
        const minioData = await s3.upload(params).promise();
        parentImageResult = { public_id: fileKey, url: minioData.Location };
      }

      const parentAdmissionNumberGenerated = await generateAdmissionNumber(schoolId, ParentModel);
      parentData = await ParentModel.create({
        parentId: uuidv4(),
        schoolId,
        session,
        studentIds: [studentData._id],
        studentNames: [photo.studentName],
        fatherName,
        motherName,
        email: parentEmail,
        password: parentHashedPassword,
        status: "active",
        contact: parentContact,
        role: "parent",
        parentImage: parentImageResult.url ? parentImageResult : { public_id: "", url: "" },
        fatherImage: fatherImageResult.url ? fatherImageResult : { public_id: "", url: "" },
        motherImage: motherImageResult.url ? motherImageResult : { public_id: "", url: "" },
        guardianImage: guardianImageResult.url ? guardianImageResult : { public_id: "", url: "" },
        admissionNumber: parentAdmissionNumberGenerated,
        base64: undefined,
        income: parentIncome ? Number(parentIncome) : undefined,
        qualification: parentQualification,
        guardianName,
        createdBy: req.user._id || mongoose.Types.ObjectId(req.user.userId),
      });
    }

    // Link parent to student
    if (parentData) {
      studentData.parentId = parentData._id.toString();
      studentData.parentAdmissionNumber = parentData.admissionNumber;
      await studentData.save();

      const parentEmailContent = `<p>Your login credentials are as follows:</p><p>Email: ${parentEmail}</p><p>Password: ${parentPassword}</p>`;
      await sendEmail(parentEmail, "Parent Login Credentials", parentEmailContent);
    }

    // Send student email (same as createAdmission)
    const schoolDetails = await AdminInfo.findOne({ schoolId }).select('schoolName image.url');
    const schoolName = schoolDetails?.schoolName || 'Your School';
    const schoolImageUrl = schoolDetails?.image?.url || 'https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg';
    const softwareLogoUrl = 'https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png';

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
              <h2 style="color: #ff5600; font-size: 24px; margin: 0 0 20px; text-align: center;">Hello, ${photo.studentName}!</h2>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">We’re thrilled to welcome you to ${schoolName}! Your admission has been submitted and is awaiting approval.</p>
              <div style="background-color: #e0f7fa; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff5600;">
                <h3 style="color: #000000; font-size: 20px; margin: 0 0 10px;">Your Admission Details</h3>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Student Name:</strong> ${photo.studentName}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Class:</strong> ${photo.class}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Admission Number:</strong> ${studentAdmissionNumberToUse}</p>
                <p style="margin: 5px 0; font-size: 16px;"><strong>Status:</strong> <span style="color: #ff5600; font-weight: bold;">Pending Approval</span></p>
              </div>
              <p style="font-size: 16px; line-height: 1.5; color: #000000; text-align: center;">Hang tight! We’re reviewing your details and will notify you once approved. Your journey starts on ${studentJoiningDate}.</p>
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
    await sendEmail(studentEmail, "Admission Confirmation", studentEmailContent);

    // Optionally delete photo record after successful admission
    await PhotoModel.deleteOne({ photoId });

    return res.status(201).json({
      success: true,
      message: "Admission created successfully from photo record and is pending admin approval.",
      student: studentData,
      parent: parentData,
    });
  } catch (error) {
    console.error("Error in completeAdmissionFromPhoto:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to complete admission.",
      error: error.message,
    });
  }
};


/**
 * Get Photo Records (Third-Party)
 */
exports.getPhotoRecords = async (req, res) => {
  try {
    // Extract query parameters
    const { schoolId, studentName, class: studentClass, section, page = 1, limit = 10 } = req.query;

    // Validate user access
    const assignedSchoolIds = req.user.assignedSchools.map(s => s.schoolId);
    let filterSchoolIds = assignedSchoolIds;

    if (schoolId) {
      if (!assignedSchoolIds.includes(schoolId)) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this school.",
        });
      }
      filterSchoolIds = [schoolId];
    }

    // Build query
    const query = {
      schoolId: { $in: filterSchoolIds },
      session: req.user.session,
    };

    // Add optional filters
    if (studentName) {
      query.studentName = { $regex: studentName, $options: "i" }; // Case-insensitive search
    }
    if (studentClass) {
      query.class = studentClass;
    }
    if (section) {
      query.section = section;
    }

    // Pagination
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    // Execute query
    const photos = await PhotoModel.find(query)
      .select("photoId schoolId session studentName class section studentImage createdAt assignedThirdParty")
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const totalPhotos = await PhotoModel.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: "Photo records fetched successfully.",
      data: photos,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(totalPhotos / parsedLimit),
        totalRecords: totalPhotos,
      },
    });
  } catch (error) {
    console.error("Error in getPhotoRecords:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch photo records.",
      error: error.message,
    });
  }
};