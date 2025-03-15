
// controllers/thirdpartyAdmissionController.js

const AdminInfo = require('../models/adminModel');
const NewStudentModel = require('../models/newStudentModel');
const classModel = require('../models/classModel'); // Import the class model
const ParentModel = require('../models/parentModel');
const sendEmail = require("../utils/email");
const { hashPassword } = require('./authController');
const cloudinary = require('cloudinary');
const s3 = require('../config/minio');
const getDataUri = require("../utils/dataUri"); // your helper for file conversion
const { generateStructuredNumber } = require('../utils/numberGenerator'); // Adjust path as needed

// Generate Admission Number
const generateAdmissionNumber = async (schoolId, Model) => {
  return generateStructuredNumber(schoolId, Model, 'admissionNumber');
};

/**
 * Create Admission (Third-Party)
 * Mirrors the admin createStudentParent logic with all fields.
 * Marks the admission as pending for admin approval.
 */
exports.createAdmission = async (req, res) => {
  try {
    const { schoolId } = req.body;
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

    // **Validation for Required Fields (unchanged except for studentAdmissionNumber)**
    if (!studentFullName) return res.status(400).json({ success: false, message: "Student full name is required." });
    if (!studentEmail) return res.status(400).json({ success: false, message: "Student email is required." });
    if (!studentPassword) return res.status(400).json({ success: false, message: "Student password is required." });
    if (!studentJoiningDate) return res.status(400).json({ success: false, message: "Student joining date is required." });
    if (!studentClass) return res.status(400).json({ success: false, message: "Student class is required." });
    if (!studentSection) return res.status(400).json({ success: false, message: "Student section is required." });
    if (!fatherName) return res.status(400).json({ success: false, message: "Father's name is required." });
    if (!parentEmail) return res.status(400).json({ success: false, message: "Parent email is required." });
    if (!parentPassword) return res.status(400).json({ success: false, message: "Parent password is required." });

    // **Check for Existing Student (unchanged)**
    const existingStudent = await NewStudentModel.findOne({ email: studentEmail, schoolId });
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: "Student already exists with this email in this school.",
      });
    }

    // **Password Hashing (unchanged)**
    const studentHashedPassword = await hashPassword(studentPassword);
    const parentHashedPassword = await hashPassword(parentPassword);

    // **Image Uploads to MinIO (unchanged)**
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

    // **Generate Admission Number if not provided or empty**
    const studentAdmissionNumberToUse = studentAdmissionNumber && studentAdmissionNumber.trim() !== "" 
      ? studentAdmissionNumber 
      : await generateAdmissionNumber(schoolId, NewStudentModel);

    // **Create Student (updated with studentAdmissionNumberToUse)**
    const studentData = await NewStudentModel.create({
      schoolId,
      fullName: studentFullName,
      email: studentEmail,
      password: studentHashedPassword,
      dateOfBirth: studentDateOfBirth,
      gender: studentGender,
      joiningDate: studentJoiningDate,
      address: studentAddress,
      contact: studentContact,
      class: studentClass,
      section: studentSection,
      country: studentCountry,
      subject: studentSubject,
      fatherName,
      motherName,
      guardianName,
      remarks,
      transport,
      admissionNumber: studentAdmissionNumberToUse,
      isGenerated: !studentAdmissionNumber,
      religion,
      caste,
      nationality,
      pincode,
      state,
      city,
      rollNo: rollNo || ((await NewStudentModel.countDocuments({ schoolId, class: studentClass, section: studentSection })) + 1).toString(),
      studentImage: studentImageResult.url ? studentImageResult : undefined,
      fatherImage: fatherImageResult.url ? fatherImageResult : undefined,
      motherImage: motherImageResult.url ? motherImageResult : undefined,
      guardianImage: guardianImageResult.url ? guardianImageResult : undefined,
      udisePlusDetails: {
        stu_id, class: studentUdiseClass, section: studentUdiseSection, roll_no, student_name,
        gender: studentUdiseGender, DOB, mother_name: motherName, father_name: fatherName, guardian_name: guardianName,
        aadhar_no, aadhar_name, paddress, pincode: udisePlusPincode, mobile_no, alt_mobile_no, email_id,
        mothere_tougue, category, minority, is_bpl, is_aay, ews_aged_group, is_cwsn, cwsn_imp_type,
        ind_national, mainstramed_child, adm_no, adm_date, stu_stream, pre_year_schl_status, pre_year_class,
        stu_ward, pre_class_exam_app, result_pre_exam, perc_pre_class, att_pre_class, fac_free_uniform,
        fac_free_textbook, received_central_scholarship, name_central_scholarship, received_state_scholarship,
        received_other_scholarship, scholarship_amount, fac_provided_cwsn, SLD_type, aut_spec_disorder,
        ADHD, inv_ext_curr_activity, vocational_course, trade_sector_id, job_role_id, pre_app_exam_vocationalsubject,
        bpl_card_no, ann_card_no,
      },
      approvalStatus: "pending",
      assignedThirdParty: req.user.userId,
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
      parentData = await ParentModel.create({
        schoolId,
        studentIds: [studentData._id],
        studentNames: [studentFullName],
        fullName: fatherName,
        motherName,
        guardianName,
        email: parentEmail,
        password: parentHashedPassword,
        contact: parentContact,
        admissionNumber: parentAdmissionNumberGenerated,
        income: parentIncome,
        qualification: parentQualification,
        parentImage: parentImageResult.url ? parentImageResult : undefined,
        fatherImage: fatherImageResult.url ? fatherImageResult : undefined,
        motherImage: motherImageResult.url ? motherImageResult : undefined,
        guardianImage: guardianImageResult.url ? guardianImageResult : undefined,
        createdBy: req.user._id || mongoose.Types.ObjectId(req.user.userId),
      });
    }

    if (parentData) {
      studentData.parentId = parentData._id;
      studentData.parentAdmissionNumber = parentData.admissionNumber;
      await studentData.save();

      const parentEmailContent = `<p>Your login credentials are as follows:</p><p>Email: ${parentEmail}</p><p>Password: ${parentPassword}</p>`;
      await sendEmail(parentEmail, "Parent Login Credentials", parentEmailContent);
    }

    // Fetch school details for email branding
    const schoolDetails = await AdminInfo.findOne({ schoolId }).select('schoolName image.url');
    const schoolName = schoolDetails?.schoolName || 'Your School';
    const schoolImageUrl = schoolDetails?.image?.url || 'https://digitalvidyasaarthi.in/static/media/welcome.8b61029bfec85910cb94.jpg';
    const softwareLogoUrl = 'https://digitalvidyasaarthi.in/static/media/digitalvidya.37858264ee730ad2cc10.png';

    console.log('School Image URL:', schoolImageUrl);
    console.log('Software Logo URL:', softwareLogoUrl);

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

exports.editAdmission = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { schoolId } = req.body;

    const hasAccess = req.user.assignedSchools.some(s => s.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to edit admissions for this school.",
      });
    }

    const student = await NewStudentModel.findById(studentId);
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

    // Validate MinIO Bucket configuration
    if (!process.env.MINIO_BUCKET) {
      throw new Error("MinIO bucket configuration is missing. Please set MINIO_BUCKET in environment variables.");
    }

    // **Image Handling with MinIO**
    let studentImageResult = student.studentImage || { public_id: "", url: "" };
    let fatherImageResult = student.fatherImage || { public_id: "", url: "" };
    let motherImageResult = student.motherImage || { public_id: "", url: "" };
    let guardianImageResult = student.guardianImage || { public_id: "", url: "" };

    const studentFile = files.find(f => f.fieldname === "studentImage");
    const fatherFile = files.find(f => f.fieldname === "fatherImage");
    const motherFile = files.find(f => f.fieldname === "motherImage");
    const guardianFile = files.find(f => f.fieldname === "guardianImage");

    if (studentFile) {
      if (studentImageResult.public_id && typeof studentImageResult.public_id === "string") {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: studentImageResult.public_id }).promise();
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
      if (fatherImageResult.public_id && typeof fatherImageResult.public_id === "string") {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: fatherImageResult.public_id }).promise();
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
      if (motherImageResult.public_id && typeof motherImageResult.public_id === "string") {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: motherImageResult.public_id }).promise();
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
      if (guardianImageResult.public_id && typeof guardianImageResult.public_id === "string") {
        await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: guardianImageResult.public_id }).promise();
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

    // **Password Handling**
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

    // **Update Student Fields**
    const updateStudentFields = {
      fullName: formData.studentFullName || student.fullName,
      email: formData.studentEmail || student.email,
      password: studentHashPassword,
      dateOfBirth: formData.studentDateOfBirth || student.dateOfBirth,
      gender: formData.studentGender || student.gender,
      joiningDate: formData.studentJoiningDate || student.joiningDate,
      rollNo: formData.rollNo || student.rollNo,
      address: formData.studentAddress || student.address,
      contact: formData.studentContact || student.contact,
      class: formData.studentClass || student.class,
      section: formData.studentSection || student.section,
      country: formData.studentCountry || student.country,
      subject: formData.studentSubject?.split(",") || student.subject,
      fatherName: formData.fatherName || student.fatherName,
      motherName: formData.motherName || student.motherName,
      guardianName: formData.guardianName || student.guardianName,
      remarks: formData.remarks || student.remarks,
      transport: formData.transport || student.transport,
      religion: formData.religion || student.religion,
      caste: formData.caste || student.caste,
      nationality: formData.nationality || student.nationality,
      pincode: formData.pincode || student.pincode,
      state: formData.state || student.state,
      city: formData.city || student.city,
      studentImage: studentImageResult,
      fatherImage: fatherImageResult,
      motherImage: motherImageResult,
      guardianImage: guardianImageResult,
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
        guardian_name: formData.guardianName || student.udisePlusDetails?.guardianName,
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
        received_central_scholarship:
          formData.received_central_scholarship || student.udisePlusDetails?.received_central_scholarship,
        name_central_scholarship:
          formData.name_central_scholarship || student.udisePlusDetails?.name_central_scholarship,
        received_state_scholarship:
          formData.received_state_scholarship || student.udisePlusDetails?.received_state_scholarship,
        received_other_scholarship:
          formData.received_other_scholarship || student.udisePlusDetails?.received_other_scholarship,
        scholarship_amount: formData.scholarship_amount || student.udisePlusDetails?.scholarship_amount,
        fac_provided_cwsn: formData.fac_provided_cwsn || student.udisePlusDetails?.fac_provided_cwsn,
        SLD_type: formData.SLD_type || student.udisePlusDetails?.SLD_type,
        aut_spec_disorder: formData.aut_spec_disorder || student.udisePlusDetails?.aut_spec_disorder,
        ADHD: formData.ADHD || student.udisePlusDetails?.ADHD,
        inv_ext_curr_activity: formData.inv_ext_curr_activity || student.udisePlusDetails?.inv_ext_curr_activity,
        vocational_course: formData.vocational_course || student.udisePlusDetails?.vocational_course,
        trade_sector_id: formData.trade_sector_id || student.udisePlusDetails?.trade_sector_id,
        job_role_id: formData.job_role_id || student.udisePlusDetails?.job_role_id,
        pre_app_exam_vocationalsubject:
          formData.pre_app_exam_vocationalsubject || student.udisePlusDetails?.pre_app_exam_vocationalsubject,
        bpl_card_no: formData.bpl_card_no || student.udisePlusDetails?.bpl_card_no,
        ann_card_no: formData.ann_card_no || student.udisePlusDetails?.ann_card_no,
      },
    };

    const updatedStudent = await NewStudentModel.findByIdAndUpdate(
      studentId,
      updateStudentFields,
      { new: true, runValidators: true }
    );

    if (formData.parentId) {
      const parent = await ParentModel.findById(formData.parentId);
      if (!parent) {
        return res.status(404).json({ success: false, message: "Parent not found." });
      }

      let parentImageResult = parent.parentImage || { public_id: "", url: "" };
      let pFatherImageResult = parent.fatherImage || { public_id: "", url: "" };
      let pMotherImageResult = parent.motherImage || { public_id: "", url: "" };
      let pGuardianImageResult = parent.guardianImage || { public_id: "", url: "" };

      const parentFile = files.find(f => f.fieldname === "parentImage");
      if (parentFile) {
        if (parentImageResult.public_id && typeof parentImageResult.public_id === "string") {
          await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: parentImageResult.public_id }).promise();
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
        if (pFatherImageResult.public_id && typeof pFatherImageResult.public_id === "string") {
          await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: pFatherImageResult.public_id }).promise();
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
        if (pMotherImageResult.public_id && typeof pMotherImageResult.public_id === "string") {
          await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: pMotherImageResult.public_id }).promise();
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
        if (pGuardianImageResult.public_id && typeof pGuardianImageResult.public_id === "string") {
          await s3.deleteObject({ Bucket: process.env.MINIO_BUCKET, Key: pGuardianImageResult.public_id }).promise();
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

      const updateParentFields = {
        fullName: formData.fatherName || parent.fullName,
        motherName: formData.motherName || parent.motherName,
        guardianName: formData.guardianName || parent.guardianName,
        email: formData.parentEmail || parent.email,
        password: parentHashPassword,
        contact: formData.parentContact || parent.contact,
        income: formData.parentIncome || parent.income,
        qualification: formData.parentQualification || parent.qualification,
        parentImage: parentImageResult,
        fatherImage: pFatherImageResult,
        motherImage: pMotherImageResult,
        guardianImage: pGuardianImageResult,
      };

      await ParentModel.findByIdAndUpdate(formData.parentId, updateParentFields, {
        new: true,
        runValidators: true,
      });
    }

    res.status(200).json({
      success: true,
      message: "Admission updated successfully.",
      student: updatedStudent,
    });
  } catch (error) {
    console.error("Error in editAdmission:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update admission.",
      error: error.message,
    });
  }
};
  
  /**
   * Get All Students for Third-Party (Admissions)
   * Returns all student records for the schools assigned to the third‑party user.
   * Supports optional pagination and filtering by schoolId.
   */
  exports.getAllStudentsForThirdParty = async (req, res) => {
    try {
        // Ensure req.user is populated by verifyToken
        if (!req.user || !req.user.assignedSchools) {
            return res.status(401).json({
                success: false,
                message: 'Authentication failed or no assigned schools',
            });
        }

        const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
        let filterSchoolIds = assignedSchoolIds;

        // Optional schoolId filter from query
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

        // Build the query with updated field selection
        const query = NewStudentModel.find({
            schoolId: { $in: filterSchoolIds },
            // assignedThirdParty: req.user.userId, // Optional: scope to third-party user's admissions
        })
            .select(
                'schoolId fullName email dateOfBirth gender joiningDate address contact class section country subject ' +
                'studentImage fatherImage motherImage guardianImage admissionNumber approvalStatus assignedThirdParty ' +
                'parentId parentAdmissionNumber createdAt udisePlusDetails rollNo transport guardianName remarks'
            )
            .populate('parentId', 'fullName motherName email contact admissionNumber parentImage fatherImage motherImage guardianImage')
            .sort({ createdAt: -1 });

        // Apply pagination only if limit is provided
        if (limit) {
            query.skip(skip).limit(limit);
        }

        const students = await query.lean().exec();
        const totalStudents = await NewStudentModel.countDocuments({
            schoolId: { $in: filterSchoolIds },
            // assignedThirdParty: req.user.userId, // Match the filter above
        });

        // Log image URLs for debugging
        console.log('Fetched students:', students.map(s => ({
            id: s._id,
            studentImage: s.studentImage,
            fatherImage: s.fatherImage,
            motherImage: s.motherImage,
            guardianImage: s.guardianImage,
        })));

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
   * Returns student records for a specific school.
   * Expects a query parameter "schoolId". The controller verifies the third-party user’s access.
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
 * getStudentsByClassSectionThirdParty
 *
 * Fetches student records filtered by school, class, and section.
 * For third‑party users, if a schoolId is provided the function verifies that
 * the school is among those the user is assigned to. If no schoolId is provided,
 * the query is restricted to all assigned schools.
 *
 * Query parameters:
 *  - schoolId (optional)
 *  - studentClass (optional)
 *  - studentSection (optional)
 *  - page (optional, default: 1)
 *  - limit (optional, default: 10)
 */
exports.getStudentsByClassSectionThirdParty = async (req, res) => {
    try {
      const { schoolId, studentClass, studentSection } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
  
      const query = {};
  
      // If a schoolId is provided, verify access for the third-party user
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
        // No schoolId provided: limit the query to all schools assigned to the third-party user
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







  exports.updateMyStudent = async (req, res) => {
    try {
      const { studentId } = req.params;
      const updateData = req.body;
  
      const student = await NewStudentModel.findById(studentId);
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
  
      // Prevent changing critical fields
      delete updateData.schoolId;
      delete updateData.assignedThirdParty;
      delete updateData.approvalStatus;
  
      Object.assign(student, updateData);
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




  exports.updateAnyStudent = async (req, res) => {
    try {
      const { studentId } = req.params;
      const updateData = req.body;
  
      const student = await NewStudentModel.findById(studentId);
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found',
        });
      }
  
      const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
      if (!assignedSchoolIds.includes(student.schoolId)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to edit students from this school',
        });
      }
  
      // Prevent changing critical fields
      delete updateData.schoolId;
      delete updateData.assignedThirdParty;
      delete updateData.approvalStatus;
  
      Object.assign(student, updateData);
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







exports.getClassesForSchool = async (req, res) => {
  try {
    // Extract schoolId from query parameters
    const schoolId = req.query.schoolId;
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID is required",
      });
    }

    // Get the list of school IDs assigned to the third-party user
    const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
    if (!assignedSchoolIds.includes(schoolId)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this school",
      });
    }

    // Fetch classes for the specified school
    const classList = await classModel.find({ schoolId });

    // Format sections and subjects as comma-separated strings, matching the admin API
    const formattedClassList = classList.map(classItem => ({
      ...classItem._doc,
      sections: classItem.sections.join(", "),
      subjects: classItem.subjects.join(", "),
    }));

    // Send the response
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