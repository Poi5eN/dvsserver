const mongoose = require('mongoose');
const Mark = require('../models/mark');
const NewStudentModel = require('../models/newStudentModel');
const Exam = require('../models/exam'); // Import Exam model
const GradingScheme = require('../models/gradingScheme');

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
  
      // Calculate totalMarks for each subject based on assessments
      examData.subjects.forEach((subject) => {
        subject.totalMarks = subject.assessments.reduce((sum, a) => sum + a.totalMarks, 0);
        // Ensure startTime and endTime are parsed as Dates if provided
        subject.assessments.forEach((assessment) => {
          if (assessment.startTime) assessment.startTime = new Date(assessment.startTime);
          if (assessment.endTime) assessment.endTime = new Date(assessment.endTime);
        });
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
      const { examId } = req.params;
      const { studentId, marks, coScholasticMarks } = req.body; // Assume these are provided in the request
  
      const exam = await Exam.findOne({
        examId,
        schoolId: req.user.schoolId,
        session: req.user.session,
      });
      if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });
  
      // Validate student
      const student = await NewStudentModel.findOne({ studentId });
      if (!student) return res.status(404).json({ success: false, message: "Student not found" });
  
      // Build the mark record
      const markData = {
        examId: exam.examId,
        studentId,
        schoolId: req.user.schoolId,
        session: req.user.session,
        className: exam.classNames[0], // Assuming single class for simplicity
        section: exam.sections[0],     // Assuming single section for simplicity
        marks: marks.map((subjectMark) => {
          const examSubject = exam.subjects.find((s) => s.name === subjectMark.subjectName);
          if (!examSubject) throw new Error(`Subject ${subjectMark.subjectName} not found in exam`);
          
          return {
            subjectName: subjectMark.subjectName,
            assessments: examSubject.assessments.map((examAssessment) => ({
              assessmentName: examAssessment.name,
              marksObtained: subjectMark.assessments.find((a) => a.assessmentName === examAssessment.name)?.marksObtained || 0,
              totalMarks: examAssessment.totalMarks,
              passingMarks: examAssessment.passingMarks || 0,
              startTime: examAssessment.startTime, // Copy from Exam
              endTime: examAssessment.endTime      // Copy from Exam
            })),
            total: subjectMark.total,
            grade: subjectMark.grade,
          };
        }),
        coScholasticMarks: coScholasticMarks || [],
      };
  
      const mark = new Mark(markData);
      await mark.save();
  
      res.status(200).json({ success: true, message: "Exam results submitted successfully", mark });
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
  
      // Fetch student
      const student = await NewStudentModel.findOne({ studentId });
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }
  
      // Fetch marks
      const marks = await Mark.find({
        studentId,
        schoolId: req.user.schoolId,
        session,
      });
  
      if (!marks.length) {
        return res.status(404).json({ success: false, message: 'No marks found for this student, school, and session' });
      }
  
      // Log raw marks data
      console.log('Marks fetched:', JSON.stringify(marks, null, 2));
  
      // Fetch all relevant exams based on examIds from marks
      const examIds = marks.map((mark) => mark.examId);
      const exams = await Exam.find({ examId: { $in: examIds } });
      const examMap = new Map(exams.map((exam) => [exam.examId, exam]));
  
      // Fetch grading scheme
      const gradingScheme = await GradingScheme.findOne({ schoolId: req.user.schoolId });
  
      // Build subjects array
      const subjectMap = new Map(); // Map to aggregate subjects
      marks.forEach((mark) => {
        const exam = examMap.get(mark.examId);
        if (!exam || !exam.term) {
          console.warn(`Skipping mark with invalid or missing exam: ${mark._id}, examId: ${mark.examId}`);
          return;
        }
  
        const termKey = exam.term.toLowerCase().replace(' ', ''); // e.g., "term1"
        mark.marks.forEach((subjectMark) => {
          if (!subjectMap.has(subjectMark.subjectName)) {
            subjectMap.set(subjectMark.subjectName, {
              name: subjectMark.subjectName,
              term1: null,
              term2: null,
            });
          }
  
          const subjectEntry = subjectMap.get(subjectMark.subjectName);
          const assessments = {};
          subjectMark.assessments.forEach((a) => {
            const percentage = a.totalMarks ? (a.marksObtained / a.totalMarks) * 100 : 0;
            const assessmentGrade = gradingScheme ? getGrade(percentage, gradingScheme) : defaultGrade(percentage);
            assessments[a.assessmentName] = {
              marksObtained: a.marksObtained,
              totalMarks: a.totalMarks,
              passingMarks: a.passingMarks || 0,
              grade: assessmentGrade,
            };
          });
  
          subjectEntry[termKey] = {
            ...assessments,
            total: subjectMark.total,
            grade: subjectMark.grade,
          };
        });
      });
  
      const subjects = Array.from(subjectMap.values());
  
      // Build coScholastic array
      const coScholastic = marks
        .map((mark) => {
          const exam = examMap.get(mark.examId);
          if (!exam || !exam.term) return null;
          return {
            term: exam.term, // e.g., "Term-1"
            ...mark.coScholasticMarks.reduce((acc, curr) => {
              acc[curr.areaName.toLowerCase()] = curr.grade;
              return acc;
            }, {}),
          };
        })
        .filter(Boolean);
  
      const reportCard = {
        name: student.studentName,
        dob: student.dateOfBirth,
        class: `${student.class} - ${student.section || ''}`,
        gender: student.gender,
        admNo: student.admissionNumber,
        rollNo: student.rollNo || '---',
        motherName: student.motherName,
        fatherName: student.fatherName,
        subjects,
        coScholastic,
      };
  
      res.status(200).json({ success: true, reportCard });
    } catch (error) {
      console.error('Error in generateFullReportCard:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  };
  
  // Grading functions (copied from Mark model for clarity)
  function getGrade(percentage, gradingScheme) {
    for (const range of gradingScheme.grades) {
      if (percentage >= range.minPercentage && percentage <= range.maxPercentage) {
        return range.grade;
      }
    }
    return 'N/A';
  }
  
  function defaultGrade(percentage) {
    if (percentage >= 91) return 'A1';
    if (percentage >= 81) return 'A2';
    if (percentage >= 71) return 'B1';
    if (percentage >= 61) return 'B2';
    if (percentage >= 51) return 'C1';
    if (percentage >= 41) return 'C2';
    if (percentage >= 33) return 'D';
    return 'E';
  }

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