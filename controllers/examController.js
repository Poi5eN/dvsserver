const mongoose = require("mongoose");
const Mark = require("../models/mark");
const NewStudentModel = require("../models/newStudentModel");
const Exam = require("../models/exam"); // Import Exam model
const GradingScheme = require("../models/gradingScheme");

exports.createExam = async (req, res) => {
  try {
    const { classNames, sections } = req.body;
    const session = req.user.session;

    if (
      !classNames ||
      !sections ||
      classNames.length === 0 ||
      sections.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "classNames and sections are required",
      });
    }

    const examData = {
      ...req.body,
      schoolId: req.user.schoolId,
      createdBy: req.user._id,
      session,
    };
    const existingExam = await Exam.findOne({
      schoolId: examData.schoolId,
      name: examData.name,
      term: examData.term,
      session,
    });
    if (existingExam)
      return res.status(400).json({
        success: false,
        message: "An exam with these details already exists",
      });

    // Calculate totalMarks for each subject based on assessments
    examData.subjects.forEach((subject) => {
      subject.totalMarks = subject.assessments.reduce(
        (sum, a) => sum + a.totalMarks,
        0
      );
      // Ensure startTime and endTime are parsed as Dates if provided
      subject.assessments.forEach((assessment) => {
        if (assessment.startTime)
          assessment.startTime = new Date(assessment.startTime);
        if (assessment.endTime)
          assessment.endTime = new Date(assessment.endTime);
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
    if (!exam)
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });

    Object.assign(exam, req.body);
    if (req.body.subjects) {
      exam.subjects.forEach((subject) => {
        subject.totalMarks = subject.assessments.reduce(
          (sum, a) => sum + a.totalMarks,
          0
        );
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
    if (!exam)
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    res
      .status(200)
      .json({ success: true, message: "Exam deleted successfully" });
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
    if (!exam)
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });

    // Validate student
    const student = await NewStudentModel.findOne({ studentId });
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    // Build the mark record
    const markData = {
      examId: exam.examId,
      studentId,
      schoolId: req.user.schoolId,
      session: req.user.session,
      className: exam.classNames[0], // Assuming single class for simplicity
      section: exam.sections[0], // Assuming single section for simplicity
      marks: marks.map((subjectMark) => {
        const examSubject = exam.subjects.find(
          (s) => s.name === subjectMark.subjectName
        );
        if (!examSubject)
          throw new Error(
            `Subject ${subjectMark.subjectName} not found in exam`
          );

        return {
          subjectName: subjectMark.subjectName,
          assessments: examSubject.assessments.map((examAssessment) => ({
            assessmentName: examAssessment.name,
            marksObtained:
              subjectMark.assessments.find(
                (a) => a.assessmentName === examAssessment.name
              )?.marksObtained || 0,
            totalMarks: examAssessment.totalMarks,
            passingMarks: examAssessment.passingMarks || 0,
            startTime: examAssessment.startTime, // Copy from Exam
            endTime: examAssessment.endTime, // Copy from Exam
          })),
          total: subjectMark.total,
          grade: subjectMark.grade,
        };
      }),
      coScholasticMarks: coScholasticMarks || [],
      remarks: req.body.remarks || "",
    };

    const mark = new Mark(markData);
    await mark.save();

    res.status(200).json({
      success: true,
      message: "Exam results submitted successfully",
      mark,
    });
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

    if (!markRecord)
      return res
        .status(404)
        .json({ success: false, message: "Mark record not found" });

    res.status(200).json({ success: true, reportCard: markRecord });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateFullReportCard = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { session = req.user.session, examIds } = req.query;

    // Fetch student
    const student = await NewStudentModel.findOne({ studentId });
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    // Fetch marks
    let marksQuery = {
      studentId,
      schoolId: req.user.schoolId,
      session,
    };
    if (examIds) {
      const examIdArray = examIds.split(",").map((id) => id.trim());
      marksQuery.examId = { $in: examIdArray };
    }

    const marks = await Mark.find(marksQuery);
    if (!marks.length) {
      return res.status(404).json({
        success: false,
        message: "No marks found for this student, school, and session",
      });
    }

    // Log raw marks data for debugging
    console.log("Marks fetched:", JSON.stringify(marks, null, 2));

    // Fetch all relevant exams based on examIds from marks
    const examIdsFromMarks = marks.map((mark) => mark.examId);
    const exams = await Exam.find({ examId: { $in: examIdsFromMarks } });
    const examMap = new Map(exams.map((exam) => [exam.examId, exam]));

    // Fetch grading scheme
    const gradingScheme = await GradingScheme.findOne({
      schoolId: req.user.schoolId,
    });

    // Build subjects array
    const subjectMap = new Map();
    marks.forEach((mark) => {
      const exam = examMap.get(mark.examId);
      if (!exam || !exam.term) {
        console.warn(
          `Skipping mark with invalid or missing exam: ${mark._id}, examId: ${mark.examId}`
        );
        return;
      }

      const termKey = exam.term.toLowerCase().replace(/[\s-]/g, "");
      console.log(
        `Processing exam with term: ${exam.term}, normalized termKey: ${termKey}`
      );

      mark.marks.forEach((subjectMark) => {
        if (!subjectMap.has(subjectMark.subjectName)) {
          subjectMap.set(subjectMark.subjectName, {
            name: subjectMark.subjectName,
            terms: {},
          });
        }

        const subjectEntry = subjectMap.get(subjectMark.subjectName);
        const assessments = {};
        subjectMark.assessments.forEach((a) => {
          const percentage = a.totalMarks
            ? (a.marksObtained / a.totalMarks) * 100
            : 0;
          const assessmentGrade = gradingScheme
            ? getGrade(percentage, gradingScheme)
            : defaultGrade(percentage);
          assessments[a.assessmentName] = {
            marksObtained: a.marksObtained,
            totalMarks: a.totalMarks,
            passingMarks: a.passingMarks || 0,
            grade: assessmentGrade,
          };
        });

        subjectEntry.terms[termKey] = {
          ...assessments,
          total: subjectMark.total,
          grade: subjectMark.grade,
        };
      });
    });

    const subjects = Array.from(subjectMap.values()).map((subjectEntry) => {
      const subject = {
        name: subjectEntry.name,
        term1: null,
        term2: null,
      };
      Object.keys(subjectEntry.terms).forEach((termKey) => {
        subject[termKey] = subjectEntry.terms[termKey];
      });
      return subject;
    });

    const coScholastic = marks
      .map((mark) => {
        const exam = examMap.get(mark.examId);
        if (!exam || !exam.term) return null;
        return {
          term: exam.term,
          remarks: mark.remarks,
          ...mark.coScholasticMarks.reduce((acc, curr) => {
            acc[curr.areaName.toLowerCase()] = curr.grade;
            return acc;
          }, {}),
        };
      })
      .filter(Boolean);

    const reportCard = {
      studentId,
      name: student.studentName,
      dob: student.dateOfBirth,
      class: `${student.class} - ${student.section || ""}`,
      gender: student.gender,
      admNo: student.admissionNumber,
      rollNo: student.rollNo || "---",
      motherName: student.motherName,
      fatherName: student.fatherName,
      subjects,
      coScholastic,
    };

    res.status(200).json({ success: true, reportCard });
  } catch (error) {
    console.error("Error in generateFullReportCard:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Grading functions (copied from Mark model for clarity)
function getGrade(percentage, gradingScheme) {
  for (const range of gradingScheme.grades) {
    if (
      percentage >= range.minPercentage &&
      percentage <= range.maxPercentage
    ) {
      return range.grade;
    }
  }
  return "N/A";
}

function defaultGrade(percentage) {
  if (percentage >= 91) return "A1";
  if (percentage >= 81) return "A2";
  if (percentage >= 71) return "B1";
  if (percentage >= 61) return "B2";
  if (percentage >= 51) return "C1";
  if (percentage >= 41) return "C2";
  if (percentage >= 33) return "D";
  return "E";
}

exports.getExamAnalytics = async (req, res) => {
  try {
    const { id: examId } = req.params;
    const { session = req.user.session } = req.query;

    const marks = await Mark.find({
      examId,
      schoolId: req.user.schoolId,
      session,
    });

    if (!marks.length) {
      return res.status(404).json({
        success: false,
        message: "No marks found for this exam, school, and session",
      });
    }

    const analytics = {
      totalStudents: marks.length,
      passPercentage: marks.length
        ? (marks.filter((m) => m.total >= 33).length / marks.length) * 100
        : 0,
      highestScore: marks.length ? Math.max(...marks.map((m) => m.total)) : 0,
      lowestScore: marks.length ? Math.min(...marks.map((m) => m.total)) : 0,
      averageScore: marks.length
        ? marks.reduce((acc, curr) => acc + curr.total, 0) / marks.length
        : 0,
      gradeDistribution: {
        A1: marks.filter((m) => m.grade === "A1").length,
        A2: marks.filter((m) => m.grade === "A2").length,
        B1: marks.filter((m) => m.grade === "B1").length,
        B2: marks.filter((m) => m.grade === "B2").length,
        C1: marks.filter((m) => m.grade === "C1").length,
        C2: marks.filter((m) => m.grade === "C2").length,
        D: marks.filter((m) => m.grade === "D").length,
        E: marks.filter((m) => m.grade === "E").length,
      },
    };

    res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error("Error in getExamAnalytics:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.generateClassReport = async (req, res) => {
  try {
    const {
      className,
      section,
      session = req.user.session,
      examIds,
    } = req.query;

    if (!className || !section) {
      return res.status(400).json({
        success: false,
        message: "className and section are required",
      });
    }

    const students = await NewStudentModel.find({
      class: className,
      section,
      schoolId: req.user.schoolId,
    });

    if (!students.length) {
      return res.status(404).json({
        success: false,
        message: "No students found for this class and section",
      });
    }

    const studentIds = students.map((student) => student.studentId);
    let marksQuery = {
      studentId: { $in: studentIds },
      schoolId: req.user.schoolId,
      session,
    };
    if (examIds) {
      const examIdArray = examIds.split(",").map((id) => id.trim());
      marksQuery.examId = { $in: examIdArray };
    }

    const marks = await Mark.find(marksQuery);
    if (!marks.length) {
      return res.status(404).json({
        success: false,
        message: "No marks found for this class, section, and session",
      });
    }

    const examIdsFromMarks = marks.map((mark) => mark.examId);
    const exams = await Exam.find({ examId: { $in: examIdsFromMarks } });
    const examMap = new Map(exams.map((exam) => [exam.examId, exam]));

    const gradingScheme = await GradingScheme.findOne({
      schoolId: req.user.schoolId,
    });

    const reportCards = await Promise.all(
      students.map(async (student) => {
        const studentMarks = marks.filter(
          (mark) => mark.studentId === student.studentId
        );
        if (!studentMarks.length) return null;

        const subjectMap = new Map();
        studentMarks.forEach((mark) => {
          const exam = examMap.get(mark.examId);
          if (!exam || !exam.term) return;

          const termKey = exam.term.toLowerCase().replace(/[\s-]/g, "");
          mark.marks.forEach((subjectMark) => {
            if (!subjectMap.has(subjectMark.subjectName)) {
              subjectMap.set(subjectMark.subjectName, {
                name: subjectMark.subjectName,
                terms: {},
              });
            }

            const subjectEntry = subjectMap.get(subjectMark.subjectName);
            const assessments = {};
            subjectMark.assessments.forEach((a) => {
              const percentage = a.totalMarks
                ? (a.marksObtained / a.totalMarks) * 100
                : 0;
              const assessmentGrade = gradingScheme
                ? getGrade(percentage, gradingScheme)
                : defaultGrade(percentage);
              assessments[a.assessmentName] = {
                marksObtained: a.marksObtained,
                totalMarks: a.totalMarks,
                passingMarks: a.passingMarks || 0,
                grade: assessmentGrade,
                startTime: a.startTime,
                endTime: a.endTime,
              };
            });

            subjectEntry.terms[termKey] = {
              ...assessments,
              total: subjectMark.total,
              grade: subjectMark.grade,
            };
          });
        });

        const subjects = Array.from(subjectMap.values()).map((subjectEntry) => {
          const subject = {
            name: subjectEntry.name,
            term1: null,
            term2: null,
          };
          Object.keys(subjectEntry.terms).forEach((termKey) => {
            subject[termKey] = subjectEntry.terms[termKey];
          });
          return subject;
        });

        const coScholastic = studentMarks
          .map((mark) => {
            const exam = examMap.get(mark.examId);
            if (!exam || !exam.term) return null;
            return {
              term: exam.term,
              remarks: mark.remarks,
              ...mark.coScholasticMarks.reduce((acc, curr) => {
                acc[curr.areaName.toLowerCase()] = curr.grade;
                return acc;
              }, {}),
            };
          })
          .filter(Boolean);

        return {
          studentId: student.studentId,
          name: student.studentName,
          dob: student.dateOfBirth,
          class: `${student.class} - ${student.section || ""}`,
          gender: student.gender,
          admNo: student.admissionNumber,
          rollNo: student.rollNo || "---",
          motherName: student.motherName,
          fatherName: student.fatherName,
          subjects,
          coScholastic,
        };
      })
    );

    const filteredReportCards = reportCards.filter((report) => report !== null);

    if (!filteredReportCards.length) {
      return res.status(404).json({
        success: false,
        message: "No report cards generated for this class and section",
      });
    }

    res.status(200).json({ success: true, reportCards: filteredReportCards });
  } catch (error) {
    console.error("Error in generateClassReport:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateReportCard = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { reportCard } = req.body;
    const { session = req.user.session } = req.query;

    const marks = await Mark.find({
      studentId,
      schoolId: req.user.schoolId,
      session,
    });

    if (!marks.length) {
      return res.status(404).json({
        success: false,
        message: "No marks found for this student, school, and session",
      });
    }

    const examIds = marks.map((mark) => mark.examId);
    const exams = await Exam.find({ examId: { $in: examIds } });
    const examMap = new Map(exams.map((exam) => [exam.examId, exam]));

    for (const mark of marks) {
      const exam = examMap.get(mark.examId);
      if (!exam || !exam.term) continue;

      const termKey = exam.term.toLowerCase().replace(/[\s-]/g, "");
      const subjectsToUpdate = reportCard.subjects
        .map((subject) => {
          const termData = subject[termKey];
          if (!termData) return null;

          return {
            subjectName: subject.name,
            assessments: Object.keys(termData)
              .filter((key) => key !== "total" && key !== "grade")
              .map((assessmentName) => ({
                assessmentName,
                marksObtained: termData[assessmentName].marksObtained,
                totalMarks: termData[assessmentName].totalMarks,
                passingMarks: termData[assessmentName].passingMarks,
                startTime: termData[assessmentName].startTime,
                endTime: termData[assessmentName].endTime,
              })),
            total: termData.total,
            grade: termData.grade,
          };
        })
        .filter(Boolean);

      if (subjectsToUpdate.length) {
        mark.marks = subjectsToUpdate;
      }

      const coScholasticEntry = reportCard.coScholastic.find(
        (cs) => cs.term === exam.term
      );
      if (coScholasticEntry) {
        mark.coScholasticMarks = Object.keys(coScholasticEntry)
          .filter((key) => key !== "term" && key !== "remarks")
          .map((areaName) => ({
            areaName,
            grade: coScholasticEntry[areaName],
          }));
        mark.remarks = coScholasticEntry.remarks;
      }

      await mark.save();
    }

    res
      .status(200)
      .json({ success: true, message: "Report card updated successfully" });
  } catch (error) {
    console.error("Error in updateReportCard:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPerformanceAnalytics = async (req, res) => {
  try {
    const {
      className,
      section,
      studentId,
      session = req.user.session,
      examIds,
    } = req.query;

    let query = {
      schoolId: req.user.schoolId,
      session,
    };

    if (studentId) {
      query.studentId = studentId;
    } else if (className && section) {
      const students = await NewStudentModel.find({
        class: className,
        section,
        schoolId: req.user.schoolId,
      });
      const studentIds = students.map((student) => student.studentId);
      query.studentId = { $in: studentIds };
    } else {
      return res.status(400).json({
        success: false,
        message: "Either studentId or className and section must be provided",
      });
    }

    if (examIds) {
      const examIdArray = examIds.split(",").map((id) => id.trim());
      query.examId = { $in: examIdArray };
    }

    const marks = await Mark.find(query);
    if (!marks.length) {
      return res.status(404).json({
        success: false,
        message: "No marks found for the given criteria",
      });
    }

    const examIdsFromMarks = marks.map((mark) => mark.examId);
    const exams = await Exam.find({ examId: { $in: examIdsFromMarks } });
    const examMap = new Map(exams.map((exam) => [exam.examId, exam]));

    const analytics = {
      totalStudents: studentId
        ? 1
        : new Set(marks.map((m) => m.studentId)).size,
      subjectWisePerformance: {},
      overallPerformance: {
        averageTotal: 0,
        passPercentage: 0,
        gradeDistribution: {},
      },
      studentWisePerformance: studentId ? {} : [],
    };

    const subjects = [
      ...new Set(marks.flatMap((mark) => mark.marks.map((m) => m.subjectName))),
    ];
    subjects.forEach((subject) => {
      analytics.subjectWisePerformance[subject] = {
        averageMarks: 0,
        highestMarks: 0,
        lowestMarks: Infinity,
        termWiseTrend: {},
      };
    });

    const grades = ["A1", "A2", "B1", "B2", "C1", "C2", "D", "E"];
    grades.forEach((grade) => {
      analytics.overallPerformance.gradeDistribution[grade] = 0;
    });

    const studentTotals = {};
    marks.forEach((mark) => {
      const exam = examMap.get(mark.examId);
      if (!exam || !exam.term) return;

      const termKey = exam.term.toLowerCase().replace(/[\s-]/g, "");
      const studentId = mark.studentId;

      if (!studentTotals[studentId]) {
        studentTotals[studentId] = {
          terms: {},
          total: 0,
          subjects: {},
        };
      }

      if (!studentTotals[studentId].terms[termKey]) {
        studentTotals[studentId].terms[termKey] = 0;
      }

      let studentTotalForTerm = 0;
      mark.marks.forEach((subjectMark) => {
        const subjectAnalytics =
          analytics.subjectWisePerformance[subjectMark.subjectName];
        subjectAnalytics.averageMarks += subjectMark.total;
        subjectAnalytics.highestMarks = Math.max(
          subjectAnalytics.highestMarks,
          subjectMark.total
        );
        subjectAnalytics.lowestMarks = Math.min(
          subjectAnalytics.lowestMarks,
          subjectMark.total
        );
        if (!subjectAnalytics.termWiseTrend[termKey]) {
          subjectAnalytics.termWiseTrend[termKey] = 0;
        }
        subjectAnalytics.termWiseTrend[termKey] += subjectMark.total;

        studentTotalForTerm += subjectMark.total;

        if (!studentTotals[studentId].subjects[subjectMark.subjectName]) {
          studentTotals[studentId].subjects[subjectMark.subjectName] = {};
        }
        if (
          !studentTotals[studentId].subjects[subjectMark.subjectName][termKey]
        ) {
          studentTotals[studentId].subjects[subjectMark.subjectName][
            termKey
          ] = 0;
        }
        studentTotals[studentId].subjects[subjectMark.subjectName][termKey] =
          subjectMark.total;
      });

      studentTotals[studentId].terms[termKey] = studentTotalForTerm;
      studentTotals[studentId].total += studentTotalForTerm;

      if (mark.grade) {
        analytics.overallPerformance.gradeDistribution[mark.grade] =
          (analytics.overallPerformance.gradeDistribution[mark.grade] || 0) + 1;
      }
    });

    const totalRecordsPerSubject = studentId
      ? 1
      : new Set(marks.map((m) => m.studentId)).size;
    Object.keys(analytics.subjectWisePerformance).forEach((subject) => {
      const subjectAnalytics = analytics.subjectWisePerformance[subject];
      subjectAnalytics.averageMarks /= totalRecordsPerSubject;
      Object.keys(subjectAnalytics.termWiseTrend).forEach((termKey) => {
        subjectAnalytics.termWiseTrend[termKey] /= totalRecordsPerSubject;
      });
      if (subjectAnalytics.lowestMarks === Infinity)
        subjectAnalytics.lowestMarks = 0;
    });

    const totalStudents = Object.keys(studentTotals).length;
    let overallTotal = 0;
    let passedStudents = 0;

    Object.keys(studentTotals).forEach((studentId) => {
      const studentData = studentTotals[studentId];
      const averageTotal =
        studentData.total / Object.keys(studentData.terms).length;
      overallTotal += averageTotal;
      if (averageTotal >= 33) passedStudents++;

      if (studentId === req.query.studentId) {
        analytics.studentWisePerformance = {
          total: averageTotal,
          subjects: studentData.subjects,
        };
      } else {
        analytics.studentWisePerformance.push({
          studentId,
          total: averageTotal,
          subjects: studentData.subjects,
        });
      }
    });

    analytics.overallPerformance.averageTotal = overallTotal / totalStudents;
    analytics.overallPerformance.passPercentage =
      (passedStudents / totalStudents) * 100;

    res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error("Error in getPerformanceAnalytics:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
