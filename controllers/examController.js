const Exam = require("../models/exam");
const Mark = require("../models/mark");
const mongoose = require("mongoose");

exports.createExam = async (req, res) => {
  try {
    const { classNames, sections } = req.body;
    const session = req.user.session;

    if (!classNames || !sections || classNames.length === 0 || sections.length === 0) {
      return res.status(400).json({ success: false, message: "classNames and sections are required" });
    }

    const examData = { ...req.body, schoolId: req.user.schoolId, createdBy: req.user._id, session };
    const existingExam = await Exam.findOne({
      schoolId: examData.schoolId,
      name: examData.name,
      term: examData.term,
      session,
    });
    if (existingExam) return res.status(400).json({ success: false, message: "An exam with these details already exists" });

    examData.subjects.forEach((subject) => {
      subject.totalMarks = subject.assessments.reduce((sum, a) => sum + a.totalMarks, 0);
    });

    const exam = new Exam(examData);
    await exam.save();
    res.status(201).json({ success: true, exam });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getExams = async (req, res) => {
  try {
    const { examId, className, section, upcoming, published } = req.query;
    const query = { schoolId: req.user.schoolId, session: req.user.session };

    if (examId) query.examId = examId;
    if (className) query.classNames = className;
    if (section) query.sections = section;
    if (upcoming === "true") query.startDate = { $gt: new Date() };
    if (published === "true") query.resultPublishDate = { $lte: new Date() };

    const exams = await Exam.find(query).sort({ startDate: -1 });
    res.status(200).json({ success: true, count: exams.length, exams });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateExam = async (req, res) => {
  try {
    const exam = await Exam.findOne({
      examId: req.params.id,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    Object.assign(exam, req.body);
    if (req.body.subjects) {
      exam.subjects.forEach((subject) => {
        subject.totalMarks = subject.assessments.reduce((sum, a) => sum + a.totalMarks, 0);
      });
    }
    await exam.save();
    res.status(200).json({ success: true, exam });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findOneAndDelete({
      examId: req.params.id,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
    res.status(200).json({ success: true, message: "Exam deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitExamResults = async (req, res) => {
  try {
    const exam = await Exam.findOne({
      examId: req.params.id,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    res.status(200).json({ success: true, message: "Exam results submitted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateReportCard = async (req, res) => {
  try {
    const { examId, studentId } = req.params;
    const markRecord = await Mark.findOne({
      examId,
      studentId,
      schoolId: req.user.schoolId,
      session: req.user.session,
    }).populate("studentId", "name rollNo");

    if (!markRecord) return res.status(404).json({ success: false, message: "Mark record not found" });

    res.status(200).json({ success: true, reportCard: markRecord });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateFullReportCard = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { session = req.user.session } = req.query;

    const student = await mongoose.model("Student").findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const marks = await Mark.find({
      studentId,
      schoolId: req.user.schoolId,
      session,
    }).populate("examId", "term name");

    if (!marks.length) return res.status(404).json({ success: false, message: "No marks found" });

    const subjects = {};
    marks.forEach((mark) => {
      const term = mark.examId.term.toLowerCase().replace(" ", "");
      mark.marks.forEach((subjectMark) => {
        if (!subjects[subjectMark.subjectName]) subjects[subjectMark.subjectName] = {};
        const assessments = {};
        subjectMark.assessments.forEach((a) => {
          assessments[a.assessmentName] = a.marksObtained;
        });
        subjects[subjectMark.subjectName][term] = {
          ...assessments,
          total: subjectMark.total,
          grade: subjectMark.grade,
        };
      });
    });

    const coScholastic = marks.map((mark) => ({
      term: mark.examId.term,
      ...mark.coScholasticMarks.reduce((acc, curr) => {
        acc[curr.areaName] = curr.grade;
        return acc;
      }, {}),
    }));

    const reportCard = {
      name: student.name,
      dob: student.dob,
      class: `${student.className} - ${student.section}`,
      gender: student.gender,
      admNo: student.admNo,
      rollNo: student.rollNo,
      motherName: student.motherName,
      fatherName: student.fatherName,
      subjects,
      coScholastic,
    };

    res.status(200).json({ success: true, reportCard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getExamAnalytics = async (req, res) => {
    try {
      const marks = await Mark.find({
        examId: req.params.id,
        schoolId: req.user.schoolId,
        session: req.user.session,
      });
  
      const analytics = {
        totalStudents: marks.length,
        passPercentage: marks.length ? (marks.filter((m) => m.total >= 33).length / marks.length) * 100 : 0,
        highestScore: marks.length ? Math.max(...marks.map((m) => m.total)) : 0,
        lowestScore: marks.length ? Math.min(...marks.map((m) => m.total)) : 0,
        averageScore: marks.length ? marks.reduce((acc, curr) => acc + curr.total, 0) / marks.length : 0,
        gradeDistribution: {
          "A1": marks.filter((m) => m.grade === "A1").length,
          "A2": marks.filter((m) => m.grade === "A2").length,
          "B1": marks.filter((m) => m.grade === "B1").length,
          "B2": marks.filter((m) => m.grade === "B2").length,
          "C1": marks.filter((m) => m.grade === "C1").length,
          "C2": marks.filter((m) => m.grade === "C2").length,
          "D": marks.filter((m) => m.grade === "D").length,
          "E": marks.filter((m) => m.grade === "E").length,
        },
      };
  
      res.status(200).json({ success: true, analytics });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };