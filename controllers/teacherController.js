const studyMaterial = require("../models/studyMaterial");
const cloudinary = require("cloudinary");
const getDataUri = require("../utils/dataUri");
const Attendance = require("../models/attendance");
const { startOfMonth, endOfMonth } = require("date-fns");
const teacherPayment = require("../models/teacherPayment");
const AssignmentModel = require("../models/assignmentModel");
const ExamModel = require("../models/exam");

exports.createStudyMaterial = async (req, res) => {
  try {
    const { title, type, link } = req.body;
    console.log("ui", req.user.schoolId);
    console.log("uo", type);
    const file = req.file;

    let study;

    if (type == "youtube" || type == "Video") {
      study = await studyMaterial.create({
        schoolId: req.user.schoolId,
        session: req.user.session, // Added session
        className: req.user.classTeacher,
        title,
        type,
        link,
      });
    } else {
      const fileDataUri = getDataUri(file);
      const mycloud = await cloudinary.v2.uploader.upload(fileDataUri.content);
      study = await studyMaterial.create({
        schoolId: req.user.schoolId,
        session: req.user.session, // Added session
        className: req.user.classTeacher,
        title,
        type,
        file: {
          public_id: mycloud.public_id,
          url: mycloud.secure_url,
        },
      });
    }
    res.status(201).json({
      success: true,
      message: "Study Material is successfully created",
      study,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Study Material is not created due to error",
      error: error.message,
    });
  }
};

exports.getStudyMaterial = async (req, res) => {
  try {
    //   const {studyId} = req.query;

    //   const filter = {
    //     ...(studyId ? {_id: studyId} : {})
    //   }


    let className;

    if (req.user.role === 'teacher') {
      className = req.user.classTeacher;
    } else if (req.user.role === 'student') {
      className = req.user.class;
    }

    const study = await studyMaterial.find({ 
      schoolId: req.user.schoolId, 
      session: req.user.session, // Added session
      className: className 
    });

    res.status(200).json({
      success: true,
      message: "Study Material is fetch is successfully",
      study,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Study Material is not get due to error",
      error: error.message,
    });
  }
};

exports.deleteStudyMaterial = async (req, res) => {
  try {
    const { studyId } = req.params;
    console.log("io", req.params);
    console.log("yId", studyId);

    const existStudy = await studyMaterial.findOne({
      schoolId: req.user.schoolId,
      session: req.user.session, // Added session
      _id: studyId,
    });

    if (!existStudy) {
      return res.status(400).json({
        success: false,
        message: "Study Material does not exist",
      });
    }

    const deleteStudy = await studyMaterial.deleteOne({ 
      _id: studyId,
      schoolId: req.user.schoolId,
      session: req.user.session // Added session
    });

    res.status(200).json({
      success: true,
      message: "Study Material deleted successfully",
      deleteStudy,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Study Material is not deleted due to error",
      error: error.message,
    });
  }
};

exports.createAttendance = async (req, res) => {
  try {
    const { attendanceRecords } = req.body;

    console.log("req.user", req.user);
    console.log("req.user._id", req.user._id);

    const startOfDay = new Date(attendanceRecords[0].date);
    startOfDay.setHours(0, 0, 0, 0); // Set time to the beginning of the day

    const endOfDay = new Date(attendanceRecords[0].date);
    endOfDay.setHours(23, 59, 59, 999); // Set time to the end of the day

    const attendanceDateCheck = await Attendance.find({
      schoolId: req.user.schoolId,
      session: req.user.session, // Added session
      date: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
    });

    console.log("attendanceDateCheck", attendanceDateCheck);
    if (attendanceDateCheck.length != 0) {
      return res.status(400).send({
        success: true,
        message: "This Date attendance already created",
      });
    }

    // Create an array of attendance records
    const attendanceData = attendanceRecords.map(
      ({ studentId, present, rollNo, date }) => ({
        className: req.user.classTeacher,
        section: req.user.section,
        schoolId: req.user.schoolId,
        session: req.user.session, // Added session
        studentId: studentId,
        rollNo: rollNo,
        date: new Date(attendanceRecords[0].date),
        present,
      })
    );

    const insertedAttendance = await Attendance.insertMany(attendanceData);

    return res.status(201).json({ success: true, insertedAttendance });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to create attendance", message: error.message });
  }
};

exports.getAttendanceByMonth = async (req, res) => {
  try {
    const { year, month } = req.query;
    console.log(req.query);
    // Create a date range for the specified month
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);

    console.log("yo", startDate);
    console.log("y1", endDate);

    const attendance = await Attendance.aggregate([
      {
        $match: {
          schoolId: req.user.schoolId,
          session: req.user.session, // Added session
          className: req.user.classTeacher,
          section: req.user.section,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            studentId: "$studentId",
          },
          attendanceData: {
            $push: {
              date: "$date",
              present: "$present",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          studentId: "$_id.studentId",
          attendanceData: 1,
        },
      },
    ]);

    res.status(200).json({ message: true, data: attendance });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch attendance records by month" });
  }
};

exports.getAttendanceForStudent = async (req, res) => {
  try {
    const { year, month } = req.query;
    console.log(req.query);

    let studentId;

    if (req.user.role === 'parent') {
      studentId = req.user.studentId;
    } else if (req.user.role === 'student') {
      studentId = req.user._id;
    }
    // Create a date range for the specified month
    const startDate = startOfMonth(new Date(year, month - 1));
    const endDate = endOfMonth(startDate);

    console.log("yo", startDate);
    console.log("y1", endDate);

    const attendance = await Attendance.aggregate([
      {
        $match: {
          schoolId: req.user.schoolId,
          session: req.user.session, // Added session
          studentId: studentId,
          className: req.user.class,
          section: req.user.section,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            studentId: "$studentId",
          },
          attendanceData: {
            $push: {
              date: "$date",
              present: "$present",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          studentId: "$_id.studentId",
          attendanceData: 1,
        },
      },
    ]);

    res.status(200).json({ message: true, data: attendance });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch attendance records by month" });
  }
};

exports.updateAttendance = async (req, res) => {
  try {
    const { attendanceId, present } = req.body;
    const attendance = await Attendance.findOneAndUpdate(
      { 
        _id: attendanceId, 
        schoolId: req.user.schoolId, 
        session: req.user.session // Added session
      },
      { present },
      { new: true }
    );
    res.status(200).json(attendance);
  } catch (error) {
    res.status(500).json({ error: "Failed to update attendance" });
  }
};

exports.createSalaryPayment = async (req, res) => {
  try {
    const { teacherId, salaryHistory } = req.body;

    year = new Date().getFullYear().toString();
    const existingPayment = await teacherPayment.findOne({
      schoolId: req.user.schoolId,
      session: req.user.session, // Added session
      teacherId,
      year,
    });

    if (existingPayment) {
      const existSameMonthData = existingPayment.salaryHistory.find((item) => {
        return item.month === salaryHistory[0].month;
      });

      if (existSameMonthData) {
        return res.status(400).json({
          success: false,
          message: "Salary of this month is already Paid"
        });
      }
    }

    if (existingPayment) {
      existingPayment.salaryHistory.push(...salaryHistory);
      const updatedPayment = await existingPayment.save();
      res.status(201).json({
        success: true,
        message: "Payment Saved Successfully",
        data: updatedPayment,
      });
    } else {
      const newPayment = new teacherPayment({
        schoolId: req.user.schoolId,
        session: req.user.session, // Added session
        year: year,
        ...req.body,
      });
      const savedPayment = await newPayment.save();
      res.status(201).json({
        success: true,
        message: "Payment Saved Successfully",
        data: savedPayment,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Payment is not created Successfully",
      error: error.message,
    });
  }
};

exports.getPayment = async (req, res) => {
  try {
    const { teacherId } = req.query;

    const filter = {
      ...(teacherId ? { teacherId: teacherId } : {}),
    };

    const paymentData = await teacherPayment.find({
      schoolId: req.user.schoolId,
      session: req.user.session, // Added session
      ...filter,
    });

    console.log("paymentData", paymentData);

    res.status(200).json({
      success: true,
      message: "Payment Data Get Successfully",
      data: paymentData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Payment Details are not getting Successfully",
      error: error.message,
    });
  }
};

// Get assignments for teacher's class and section
exports.getTeacherAssignments = async (req, res) => {
  try {
    const { className, section } = req.query;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    // Use teacher's class if not provided in query
    const teacherClass = className || req.user.classTeacher;
    const teacherSection = section || req.user.section;

    const filter = {
      schoolId,
      session,
      ...(teacherClass ? { className: teacherClass } : {}),
      ...(teacherSection ? { section: teacherSection } : {}),
    };

    const assignments = await AssignmentModel.find(filter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: "Assignments fetched successfully",
      assignments,
    });
  } catch (error) {
    console.error("Error in getTeacherAssignments:", error);
    res.status(500).json({
      success: false,
      message: "Assignments not fetched due to error",
      error: error.message,
    });
  }
};

// Get exams for teacher's class and section
exports.getTeacherExams = async (req, res) => {
  try {
    const { className, section } = req.query;
    const schoolId = req.user.schoolId;
    const session = req.user.session;

    // Use teacher's class if not provided in query
    const teacherClass = className || req.user.classTeacher;
    const teacherSection = section || req.user.section;

    const filter = {
      schoolId,
      session,
      ...(teacherClass ? { className: teacherClass } : {}),
      ...(teacherSection ? { section: teacherSection } : {}),
    };

    const exams = await ExamModel.find(filter)
      .sort({ startDate: -1 })
      .populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: "Exams fetched successfully",
      exams,
    });
  } catch (error) {
    console.error("Error in getTeacherExams:", error);
    res.status(500).json({
      success: false,
      message: "Exams not fetched due to error",
      error: error.message,
    });
  }
};

// Create exam for teacher
exports.createTeacherExam = async (req, res) => {
  try {
    const {
      name,
      examType,
      term,
      className,
      section,
      subjects,
      startDate,
      endDate,
      resultPublishDate,
      gradeSystem
    } = req.body;

    const schoolId = req.user.schoolId;
    const session = req.user.session;
    const createdBy = req.user._id;

    // Validate required fields
    if (!name || !examType || !term || !className || !section || !subjects || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    // Create the exam
    const newExam = new ExamModel({
      schoolId,
      session,
      createdBy,
      name,
      examType,
      term,
      classNames: [className],
      sections: [section],
      subjects: subjects.map(subject => ({
        name: subject.name,
        assessments: subject.assessments || []
      })),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      resultPublishDate: resultPublishDate ? new Date(resultPublishDate) : new Date(endDate),
      gradeSystem: gradeSystem || 'Standard'
    });

    const savedExam = await newExam.save();

    res.status(201).json({
      success: true,
      message: "Exam created successfully",
      exam: savedExam
    });
  } catch (error) {
    console.error("Error in createTeacherExam:", error);
    res.status(500).json({
      success: false,
      message: "Exam creation failed due to error",
      error: error.message
    });
  }
};