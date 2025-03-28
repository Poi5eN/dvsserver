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

    // Check for an existing exam with the same name, term, session, schoolId, classNames, and sections
    const existingExam = await Exam.findOne({
      schoolId: examData.schoolId,
      name: examData.name,
      term: examData.term,
      session,
      classNames: { $all: classNames, $size: classNames.length }, // Exact match for classNames array
      sections: { $all: sections, $size: sections.length }, // Exact match for sections array
    });

    if (existingExam) {
      return res.status(400).json({
        success: false,
        message: "An exam with these details already exists",
      });
    }

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
            startTime: examAssessment.startTime,
            endTime: examAssessment.endTime,
          })),
          total: subjectMark.total,
          grade: subjectMark.grade, // Uses grade from req.body
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

    // Fetch student and check status
    const student = await NewStudentModel.findOne({ studentId });
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }
    if (student.status === "deactivated") {
      return res.status(200).json({
        success: true,
        message: "Report card not available for deactivated student",
      });
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

    // Fetch all relevant exams based on examIds from marks
    const examIdsFromMarks = marks.map((mark) => mark.examId);
    const exams = await Exam.find({ examId: { $in: examIdsFromMarks } });
    const examMap = new Map(exams.map((exam) => [exam.examId, exam]));

    // Fetch grading scheme
    const gradingScheme = await GradingScheme.findOne({
      schoolId: req.user.schoolId,
    });

    // Build subjects array and calculate term totals
    const subjectMap = new Map();
    const termTotals = {};

    marks.forEach((mark) => {
      const exam = examMap.get(mark.examId);
      if (!exam || !exam.term) return;

      const termKey = exam.term.toLowerCase().replace(/[\s-]/g, "");
      if (!termTotals[termKey]) {
        termTotals[termKey] = {
          totalMarksObtained: 0,
          totalPossibleMarks: 0,
        };
      }

      mark.marks.forEach((subjectMark) => {
        if (!subjectMap.has(subjectMark.subjectName)) {
          subjectMap.set(subjectMark.subjectName, {
            name: subjectMark.subjectName,
            terms: {},
          });
        }

        const subjectEntry = subjectMap.get(subjectMark.subjectName);
        const assessments = {};
        let totalPossibleMarksForTerm = 0;

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
            percentage: parseFloat(percentage.toFixed(2)),
          };
          totalPossibleMarksForTerm += a.totalMarks;
        });

        const termPercentage = totalPossibleMarksForTerm
          ? (subjectMark.total / totalPossibleMarksForTerm) * 100
          : 0;
        const termGrade = gradingScheme
          ? getGrade(termPercentage, gradingScheme)
          : defaultGrade(termPercentage);

        subjectEntry.terms[termKey] = {
          ...assessments,
          total: subjectMark.total,
          grade: termGrade,
          percentage: parseFloat(termPercentage.toFixed(2)),
          totalPossibleMarks: totalPossibleMarksForTerm,
        };

        termTotals[termKey].totalMarksObtained += subjectMark.total;
        termTotals[termKey].totalPossibleMarks += totalPossibleMarksForTerm;
      });
    });

    // Calculate overall percentage and grade for each subject
    const subjects = Array.from(subjectMap.values()).map((subjectEntry) => {
      const subject = {
        name: subjectEntry.name,
      };

      let overallSubjectMarks = 0;
      let overallSubjectPossibleMarks = 0;

      Object.keys(subjectEntry.terms).forEach((termKey) => {
        subject[termKey] = subjectEntry.terms[termKey];
        overallSubjectMarks += subjectEntry.terms[termKey].total;
        overallSubjectPossibleMarks +=
          subjectEntry.terms[termKey].totalPossibleMarks;
      });

      const overallSubjectPercentage = overallSubjectPossibleMarks
        ? (overallSubjectMarks / overallSubjectPossibleMarks) * 100
        : 0;
      const overallSubjectGrade = gradingScheme
        ? getGrade(overallSubjectPercentage, gradingScheme)
        : defaultGrade(overallSubjectPercentage);

      subject.overallPercentage = parseFloat(
        overallSubjectPercentage.toFixed(2)
      );
      subject.overallGrade = overallSubjectGrade;
      return subject;
    });

    // Calculate overall totals and percentage for the entire report
    let overallReportMarks = 0;
    let overallReportPossibleMarks = 0;

    subjects.forEach((subject) => {
      Object.keys(subject).forEach((key) => {
        if (key.startsWith("term") && subject[key]) {
          overallReportMarks += subject[key].total;
          overallReportPossibleMarks += subject[key].totalPossibleMarks;
        }
      });
    });

    const overallReportPercentage = overallReportPossibleMarks
      ? (overallReportMarks / overallReportPossibleMarks) * 100
      : 0;
    const overallReportGrade = gradingScheme
      ? getGrade(overallReportPercentage, gradingScheme)
      : defaultGrade(overallReportPercentage);

    // Add percentage and grade to termTotals
    Object.keys(termTotals).forEach((termKey) => {
      const percentage = termTotals[termKey].totalPossibleMarks
        ? (termTotals[termKey].totalMarksObtained /
            termTotals[termKey].totalPossibleMarks) *
          100
        : 0;
      const grade = gradingScheme
        ? getGrade(percentage, gradingScheme)
        : defaultGrade(percentage);
      termTotals[termKey].percentage = parseFloat(percentage.toFixed(2));
      termTotals[termKey].grade = grade;
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
      termTotals,
      overallTotals: {
        totalMarksObtained: overallReportMarks,
        totalPossibleMarks: overallReportPossibleMarks,
      },
      overallPercentage: parseFloat(overallReportPercentage.toFixed(2)),
      overallGrade: overallReportGrade,
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

    // Fetch all students who should have taken this exam (to account for absent students)
    const studentIdsWithMarks = new Set(marks.map((mark) => mark.studentId));
    const exam = await Exam.findOne({ examId });
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    // Assuming the exam is linked to a class/section, fetch all students in that class
    // This depends on your data model; adjust accordingly
    const students = await NewStudentModel.find({
      schoolId: req.user.schoolId,
      class: exam.class, // Adjust based on your Exam model
      section: exam.section, // Adjust based on your Exam model
    });

    const totalStudents = students.length;
    const presentStudents = marks.length;
    const absentStudents = totalStudents - presentStudents;

    const analytics = {
      totalStudents,
      presentStudents,
      absentStudents,
      passPercentage: 0,
      highestScore: 0,
      lowestScore: Infinity,
      averageScore: 0,
      gradeDistribution: {
        A1: 0,
        A2: 0,
        B1: 0,
        B2: 0,
        C1: 0,
        C2: 0,
        D: 0,
        E: 0,
      },
    };

    if (presentStudents > 0) {
      const totals = marks
        .map((m) => m.total)
        .filter((total) => typeof total === "number");
      analytics.highestScore = totals.length ? Math.max(...totals) : 0;
      analytics.lowestScore = totals.length ? Math.min(...totals) : 0;
      analytics.averageScore = totals.length
        ? totals.reduce((acc, curr) => acc + curr, 0) / presentStudents
        : 0;
      analytics.passPercentage =
        (marks.filter((m) => m.total >= 33).length / totalStudents) * 100;

      marks.forEach((mark) => {
        if (
          mark.grade &&
          analytics.gradeDistribution.hasOwnProperty(mark.grade)
        ) {
          analytics.gradeDistribution[mark.grade]++;
        }
      });
    }

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

    // Fetch only active students
    const students = await NewStudentModel.find({
      class: className,
      section,
      schoolId: req.user.schoolId,
      status: "active",
    });

    if (!students.length) {
      return res.status(404).json({
        success: false,
        message: "No active students found for this class and section",
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

    const examIdsFromMarks = marks.map((mark) => mark.examId);
    const exams = await Exam.find({ examId: { $in: examIdsFromMarks } });
    const examMap = new Map(exams.map((exam) => [exam.examId, exam]));

    let termsToInclude = [];
    if (examIds) {
      const filteredExams = exams.filter((exam) =>
        examIdArray.includes(exam.examId)
      );
      termsToInclude = filteredExams.map((exam) =>
        exam.term.toLowerCase().replace(/[\s-]/g, "")
      );
    } else {
      termsToInclude = exams.map((exam) =>
        exam.term.toLowerCase().replace(/[\s-]/g, "")
      );
    }

    const expectedAssessmentsByTerm = {};
    termsToInclude.forEach((termKey) => {
      const termMarks = marks.filter(
        (mark) =>
          examMap.get(mark.examId)?.term.toLowerCase().replace(/[\s-]/g, "") ===
          termKey
      );
      const assessmentNames = [
        ...new Set(
          termMarks.flatMap((mark) =>
            mark.marks.flatMap((subjectMark) =>
              subjectMark.assessments.map((a) => a.assessmentName)
            )
          )
        ),
      ];
      expectedAssessmentsByTerm[termKey] = assessmentNames.length
        ? assessmentNames
        : ["PT-1", "PF-1", "HYE"];
    });

    const gradingScheme = await GradingScheme.findOne({
      schoolId: req.user.schoolId,
    });

    const reportCards = await Promise.all(
      students.map(async (student) => {
        const studentMarks = marks.filter(
          (mark) => mark.studentId === student.studentId
        );

        const subjectMap = new Map();
        const termTotals = {};

        termsToInclude.forEach((termKey) => {
          termTotals[termKey] = {
            totalMarksObtained: 0,
            totalPossibleMarks: 0,
          };
        });

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
            let totalPossibleMarksForTerm = 0;

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
                percentage: parseFloat(percentage.toFixed(2)),
                startTime: a.startTime,
                endTime: a.endTime,
              };
              totalPossibleMarksForTerm += a.totalMarks;
            });

            const termPercentage = totalPossibleMarksForTerm
              ? (subjectMark.total / totalPossibleMarksForTerm) * 100
              : 0;
            const termGrade = gradingScheme
              ? getGrade(termPercentage, gradingScheme)
              : defaultGrade(termPercentage);

            subjectEntry.terms[termKey] = {
              ...assessments,
              total: subjectMark.total,
              grade: termGrade,
              percentage: parseFloat(termPercentage.toFixed(2)),
              totalPossibleMarks: totalPossibleMarksForTerm,
            };

            termTotals[termKey].totalMarksObtained += subjectMark.total;
            termTotals[termKey].totalPossibleMarks += totalPossibleMarksForTerm;
          });
        });

        const allSubjects = [
          ...new Set(
            marks.flatMap((mark) =>
              mark.marks.map((subjectMark) => subjectMark.subjectName)
            )
          ),
        ];

        const subjects = allSubjects.map((subjectName) => {
          const subjectEntry = subjectMap.get(subjectName) || {
            name: subjectName,
            terms: {},
          };
          const subject = {
            name: subjectName,
          };

          let overallSubjectMarks = 0;
          let overallSubjectPossibleMarks = 0;

          termsToInclude.forEach((termKey) => {
            if (subjectEntry.terms[termKey]) {
              subject[termKey] = subjectEntry.terms[termKey];
              overallSubjectMarks += subjectEntry.terms[termKey].total;
              overallSubjectPossibleMarks +=
                subjectEntry.terms[termKey].totalPossibleMarks;
            } else {
              subject[termKey] = {
                total: "--",
                grade: "--",
                percentage: "--",
                totalPossibleMarks: 0,
              };
              const expectedAssessments = expectedAssessmentsByTerm[termKey];
              expectedAssessments.forEach((assessmentName) => {
                subject[termKey][assessmentName] = {
                  marksObtained: "--",
                  totalMarks: 0,
                  passingMarks: 0,
                  grade: "--",
                  percentage: "--",
                };
              });
            }
          });

          const overallSubjectPercentage = overallSubjectPossibleMarks
            ? (overallSubjectMarks / overallSubjectPossibleMarks) * 100
            : "--";
          const overallSubjectGrade =
            overallSubjectPercentage === "--"
              ? "--"
              : gradingScheme
              ? getGrade(overallSubjectPercentage, gradingScheme)
              : defaultGrade(overallSubjectPercentage);

          subject.overallPercentage =
            overallSubjectPercentage === "--"
              ? "--"
              : parseFloat(overallSubjectPercentage.toFixed(2));
          subject.overallGrade = overallSubjectGrade;
          return subject;
        });

        let overallReportMarks = 0;
        let overallReportPossibleMarks = 0;
        let termsWithMarks = 0;

        subjects.forEach((subject) => {
          Object.keys(subject).forEach((key) => {
            if (key.startsWith("term") && subject[key]) {
              if (subject[key].total !== "--") {
                overallReportMarks += subject[key].total;
                overallReportPossibleMarks += subject[key].totalPossibleMarks;
                termsWithMarks++;
              }
            }
          });
        });

        const overallReportPercentage =
          termsWithMarks > 0 && overallReportPossibleMarks
            ? (overallReportMarks / overallReportPossibleMarks) * 100
            : "--";
        const overallReportGrade =
          overallReportPercentage === "--"
            ? "--"
            : gradingScheme
            ? getGrade(overallReportPercentage, gradingScheme)
            : defaultGrade(overallReportPercentage);

        Object.keys(termTotals).forEach((termKey) => {
          if (termTotals[termKey].totalPossibleMarks === 0) {
            termTotals[termKey] = {
              totalMarksObtained: "--",
              totalPossibleMarks: "--",
              percentage: "--",
              grade: "--",
            };
          } else {
            const percentage =
              (termTotals[termKey].totalMarksObtained /
                termTotals[termKey].totalPossibleMarks) *
              100;
            const grade = gradingScheme
              ? getGrade(percentage, gradingScheme)
              : defaultGrade(percentage);
            termTotals[termKey].percentage = parseFloat(percentage.toFixed(2));
            termTotals[termKey].grade = grade;
          }
        });

        const coScholastic = termsToInclude.map((termKey) => {
          const termName = exams.find(
            (exam) => exam.term.toLowerCase().replace(/[\s-]/g, "") === termKey
          )?.term;
          const mark = studentMarks.find(
            (m) =>
              examMap
                .get(m.examId)
                ?.term.toLowerCase()
                .replace(/[\s-]/g, "") === termKey
          );
          if (!mark) {
            return {
              term: termName || termKey,
              remarks: "--",
              workeducation: "--",
              arteducation: "--",
              yoga: "--",
              discipline: "--",
              scouts: "--",
              attendance: "--",
              ict: "--",
            };
          }
          return {
            term: termName,
            remarks: mark.remarks,
            ...mark.coScholasticMarks.reduce((acc, curr) => {
              acc[curr.areaName.toLowerCase()] = curr.grade;
              return acc;
            }, {}),
          };
        });

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
          termTotals,
          overallTotals: {
            totalMarksObtained:
              overallReportMarks === 0 && termsWithMarks === 0
                ? "--"
                : overallReportMarks,
            totalPossibleMarks:
              overallReportPossibleMarks === 0 && termsWithMarks === 0
                ? "--"
                : overallReportPossibleMarks,
          },
          overallPercentage:
            overallReportPercentage === "--"
              ? "--"
              : parseFloat(overallReportPercentage.toFixed(2)),
          overallGrade: overallReportGrade,
        };
      })
    );

    // Add total count of active students
    const totalActiveStudents = students.length;

    res.status(200).json({
      success: true,
      totalActiveStudents,
      reportCards,
    });
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

    let students = [];
    if (studentId) {
      query.studentId = studentId;
      const student = await NewStudentModel.findOne({ studentId });
      if (student) students = [student];
    } else if (className && section) {
      students = await NewStudentModel.find({
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

    const examIdsFromMarks = marks.map((mark) => mark.examId);
    const exams = await Exam.find({ examId: { $in: examIdsFromMarks } });
    const examMap = new Map(exams.map((exam) => [exam.examId, exam]));

    // Determine terms to include
    const termsToInclude = examIds
      ? exams
          .filter((exam) => examIdArray.includes(exam.examId))
          .map((exam) => exam.term.toLowerCase().replace(/[\s-]/g, ""))
      : exams.map((exam) => exam.term.toLowerCase().replace(/[\s-]/g, ""));

    const analytics = {
      totalStudents: students.length,
      presentStudents: new Set(marks.map((m) => m.studentId)).size,
      absentStudents: 0,
      subjectWisePerformance: {},
      overallPerformance: {
        averageTotal: 0,
        passPercentage: 0,
        gradeDistribution: {
          A1: 0,
          A2: 0,
          B1: 0,
          B2: 0,
          C1: 0,
          C2: 0,
          D: 0,
          E: 0,
        },
      },
      studentWisePerformance: studentId ? {} : [],
    };

    analytics.absentStudents =
      analytics.totalStudents - analytics.presentStudents;

    const subjects = [
      ...new Set(marks.flatMap((mark) => mark.marks.map((m) => m.subjectName))),
    ];

    // Initialize subject-wise performance
    subjects.forEach((subject) => {
      analytics.subjectWisePerformance[subject] = {
        averageMarks: 0,
        highestMarks: 0,
        lowestMarks: Infinity,
        termWiseTrend: {},
        studentCount: 0,
      };
      termsToInclude.forEach((term) => {
        analytics.subjectWisePerformance[subject].termWiseTrend[term] = 0;
      });
    });

    const studentDataMap = new Map();
    students.forEach((student) => {
      studentDataMap.set(student.studentId, {
        total: 0,
        terms: {},
        subjects: {},
        termCount: 0,
      });
      termsToInclude.forEach((term) => {
        studentDataMap.get(student.studentId).terms[term] = 0;
        subjects.forEach((subject) => {
          if (!studentDataMap.get(student.studentId).subjects[subject]) {
            studentDataMap.get(student.studentId).subjects[subject] = {};
          }
          studentDataMap.get(student.studentId).subjects[subject][term] = "--";
        });
      });
    });

    marks.forEach((mark) => {
      const exam = examMap.get(mark.examId);
      if (!exam || !exam.term) return;

      const termKey = exam.term.toLowerCase().replace(/[\s-]/g, "");
      const studentId = mark.studentId;

      const studentData = studentDataMap.get(studentId);
      let studentTotalForTerm = 0;

      mark.marks.forEach((subjectMark) => {
        const subjectAnalytics =
          analytics.subjectWisePerformance[subjectMark.subjectName];
        if (typeof subjectMark.total === "number") {
          subjectAnalytics.averageMarks += subjectMark.total;
          subjectAnalytics.highestMarks = Math.max(
            subjectAnalytics.highestMarks,
            subjectMark.total
          );
          subjectAnalytics.lowestMarks = Math.min(
            subjectAnalytics.lowestMarks,
            subjectMark.total
          );
          subjectAnalytics.studentCount++;
          subjectAnalytics.termWiseTrend[termKey] =
            (subjectAnalytics.termWiseTrend[termKey] || 0) + subjectMark.total;
        }

        studentTotalForTerm +=
          typeof subjectMark.total === "number" ? subjectMark.total : 0;
        studentData.subjects[subjectMark.subjectName][termKey] =
          subjectMark.total;
      });

      studentData.terms[termKey] = studentTotalForTerm;
      studentData.total += studentTotalForTerm;
      studentData.termCount++;
    });

    // Finalize subject-wise performance
    Object.keys(analytics.subjectWisePerformance).forEach((subject) => {
      const subjectAnalytics = analytics.subjectWisePerformance[subject];
      if (subjectAnalytics.studentCount > 0) {
        subjectAnalytics.averageMarks /= subjectAnalytics.studentCount;
        subjectAnalytics.averageMarks = parseFloat(
          subjectAnalytics.averageMarks.toFixed(2)
        );
        Object.keys(subjectAnalytics.termWiseTrend).forEach((termKey) => {
          const termTotal = subjectAnalytics.termWiseTrend[termKey];
          const studentCountForTerm = marks.filter(
            (m) =>
              examMap
                .get(m.examId)
                ?.term.toLowerCase()
                .replace(/[\s-]/g, "") === termKey &&
              m.marks.some((sm) => sm.subjectName === subject)
          ).length;
          subjectAnalytics.termWiseTrend[termKey] = studentCountForTerm
            ? parseFloat((termTotal / studentCountForTerm).toFixed(2))
            : "--";
        });
      } else {
        subjectAnalytics.averageMarks = "--";
        Object.keys(subjectAnalytics.termWiseTrend).forEach((termKey) => {
          subjectAnalytics.termWiseTrend[termKey] = "--";
        });
      }
      if (subjectAnalytics.lowestMarks === Infinity)
        subjectAnalytics.lowestMarks = 0;
    });

    // Calculate overall performance and student-wise performance
    let overallTotal = 0;
    let passedStudents = 0;

    studentDataMap.forEach((studentData, studentId) => {
      const termCount = studentData.termCount || 1;
      const averageTotal = studentData.total / termCount;
      overallTotal += studentData.total > 0 ? averageTotal : 0;

      if (studentData.total > 0 && averageTotal >= 33) passedStudents++;

      const studentPerformance = {
        studentId,
        total:
          studentData.total > 0 ? parseFloat(averageTotal.toFixed(2)) : "--",
        subjects: studentData.subjects,
      };

      if (studentId === req.query.studentId) {
        analytics.studentWisePerformance = studentPerformance;
      } else {
        analytics.studentWisePerformance.push(studentPerformance);
      }

      // Update grade distribution based on marks
      const studentMarks = marks.filter((m) => m.studentId === studentId);
      studentMarks.forEach((mark) => {
        if (
          mark.grade &&
          analytics.overallPerformance.gradeDistribution[mark.grade] !==
            undefined
        ) {
          analytics.overallPerformance.gradeDistribution[mark.grade]++;
        }
      });
    });

    analytics.overallPerformance.averageTotal =
      analytics.presentStudents > 0
        ? parseFloat((overallTotal / analytics.presentStudents).toFixed(2))
        : "--";
    analytics.overallPerformance.passPercentage =
      (passedStudents / analytics.totalStudents) * 100;

    res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error("Error in getPerformanceAnalytics:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
