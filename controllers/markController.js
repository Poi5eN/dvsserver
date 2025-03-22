const Mark = require("../models/mark");
const Exam = require("../models/exam");

exports.addMark = async (req, res) => {
  try {
    const { studentId, examId, marks, coScholasticMarks, className, section } = req.body;

    if (!className || !section) return res.status(400).json({ success: false, message: "className and section are required" });

    const exam = await Exam.findOne({ examId, schoolId: req.user.schoolId, session: req.user.session });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    if (!exam.classNames.includes(className) || !exam.sections.includes(section)) {
      return res.status(400).json({ success: false, message: "Class or section not part of the exam" });
    }

    let studentMark = await Mark.findOne({
      studentId,
      examId,
      schoolId: req.user.schoolId,
      className,
      section,
      session: req.user.session,
    });

    if (studentMark) {
      marks.forEach((newSubjectMark) => {
        const examSubject = exam.subjects.find((s) => s.name === newSubjectMark.subjectName);
        if (!examSubject) throw new Error(`Subject ${newSubjectMark.subjectName} not found`);
        newSubjectMark.assessments.forEach((newAss) => {
          const examAss = examSubject.assessments.find((a) => a.name === newAss.assessmentName);
          if (!examAss) throw new Error(`Assessment ${newAss.assessmentName} not found`);
          if (newAss.marksObtained > examAss.totalMarks) throw new Error(`Marks exceed total for ${newAss.assessmentName}`);
          newAss.totalMarks = examAss.totalMarks;
        });
        const idx = studentMark.marks.findIndex((m) => m.subjectName === newSubjectMark.subjectName);
        if (idx !== -1) studentMark.marks[idx] = newSubjectMark;
        else studentMark.marks.push(newSubjectMark);
      });
      if (coScholasticMarks?.length > 0) studentMark.coScholasticMarks = coScholasticMarks;
    } else {
      studentMark = new Mark({
        studentId,
        examId,
        schoolId: req.user.schoolId,
        className,
        section,
        marks: marks.map((m) => ({
          subjectName: m.subjectName,
          assessments: m.assessments.map((a) => ({
            assessmentName: a.assessmentName,
            marksObtained: a.marksObtained,
            totalMarks: exam.subjects.find((s) => s.name === m.subjectName)
              .assessments.find((ass) => ass.name === a.assessmentName).totalMarks,
          })),
        })),
        coScholasticMarks: coScholasticMarks || [],
        session: req.user.session,
      });
    }

    await studentMark.save();
    res.status(201).json({ success: true, mark: studentMark });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getMarks = async (req, res) => {
  try {
    const { studentId, examId, className, section, performance } = req.query;
    const query = { schoolId: req.user.schoolId, session: req.user.session };

    if (studentId) query.studentId = studentId;
    if (examId) query.examId = examId;
    if (className) query.className = className;
    if (section) query.section = section;

    const marks = await Mark.find(query).populate("studentId", "name rollNo").populate("examId", "name examType startDate endDate");

    if (performance === "true") {
      if (!className || !section) return res.status(400).json({ success: false, message: "className and section required for performance" });

      const performanceData = {
        totalStudents: marks.length,
        classAverage: marks.length ? marks.reduce((acc, curr) => acc + curr.total, 0) / marks.length : 0,
        passPercentage: marks.length ? (marks.filter((m) => m.total >= 33).length / marks.length) * 100 : 0,
        subjectWisePerformance: {},
      };

      marks.forEach((mark) => {
        mark.marks.forEach((subject) => {
          if (!performanceData.subjectWisePerformance[subject.subjectName]) {
            performanceData.subjectWisePerformance[subject.subjectName] = {
              totalMarks: 0,
              totalStudents: 0,
              average: 0,
            };
          }
          const subjectData = performanceData.subjectWisePerformance[subject.subjectName];
          subjectData.totalMarks += subject.total;
          subjectData.totalStudents += 1;
          subjectData.average = subjectData.totalMarks / subjectData.totalStudents;
        });
      });

      res.status(200).json({ success: true, performance: performanceData });
    } else {
      res.status(200).json({ success: true, marks });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMark = async (req, res) => {
  try {
    const mark = await Mark.findOne({
      marksId: req.params.id,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });
    if (!mark) return res.status(404).json({ success: false, message: "Mark record not found" });

    const exam = await Exam.findOne({ examId: mark.examId });
    if (!exam) return res.status(404).json({ success: false, message: "Associated exam not found" });

    if (req.body.marks) {
      req.body.marks.forEach((newMark) => {
        const examSubject = exam.subjects.find((s) => s.name === newMark.subjectName);
        if (!examSubject) throw new Error(`Subject ${newMark.subjectName} not found`);
        newMark.assessments.forEach((newAss) => {
          const examAss = examSubject.assessments.find((a) => a.name === newAss.assessmentName);
          if (!examAss) throw new Error(`Assessment ${newAss.assessmentName} not found`);
          if (newAss.marksObtained > examAss.totalMarks) throw new Error(`Marks exceed total for ${newAss.assessmentName}`);
          newAss.totalMarks = examAss.totalMarks;
        });
      });
    }

    Object.assign(mark, req.body);
    await mark.save();
    res.status(200).json({ success: true, mark });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteMark = async (req, res) => {
  try {
    const mark = await Mark.findOneAndDelete({
      marksId: req.params.id,
      schoolId: req.user.schoolId,
      session: req.user.session,
    });
    if (!mark) return res.status(404).json({ success: false, message: "Mark record not found" });

    res.status(200).json({ success: true, message: "Mark record deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkUploadMarks = async (req, res) => {
  try {
    const { examId, studentsMarks } = req.body;

    const exam = await Exam.findOne({ examId, schoolId: req.user.schoolId, session: req.user.session });
    if (!exam) return res.status(404).json({ success: false, message: "Exam not found" });

    const results = [];
    const errors = [];

    for (const studentData of studentsMarks) {
      try {
        if (!studentData.className || !studentData.section) {
          throw new Error("className and section are required for each student");
        }
        if (!exam.classNames.includes(studentData.className) || !exam.sections.includes(studentData.section)) {
          throw new Error(`Class ${studentData.className} or section ${studentData.section} not part of exam`);
        }

        let studentMark = await Mark.findOne({
          studentId: studentData.studentId,
          examId,
          schoolId: req.user.schoolId,
          className: studentData.className,
          section: studentData.section,
          session: req.user.session,
        });

        if (studentMark) {
          studentData.marks.forEach((newSubjectMark) => {
            const examSubject = exam.subjects.find((s) => s.name === newSubjectMark.subjectName);
            if (!examSubject) throw new Error(`Subject ${newSubjectMark.subjectName} not found`);
            newSubjectMark.assessments.forEach((newAss) => {
              const examAss = examSubject.assessments.find((a) => a.name === newAss.assessmentName);
              if (!examAss) throw new Error(`Assessment ${newAss.assessmentName} not found`);
              if (Number(newAss.marksObtained) > examAss.totalMarks) {
                throw new Error(`Marks exceed total for ${newAss.assessmentName}`);
              }
              newAss.totalMarks = examAss.totalMarks;
            });
            const idx = studentMark.marks.findIndex((m) => m.subjectName === newSubjectMark.subjectName);
            if (idx !== -1) studentMark.marks[idx] = newSubjectMark;
            else studentMark.marks.push(newSubjectMark);
          });
        } else {
          studentMark = new Mark({
            studentId: studentData.studentId,
            examId,
            schoolId: req.user.schoolId,
            className: studentData.className,
            section: studentData.section,
            marks: studentData.marks.map((m) => ({
              subjectName: m.subjectName,
              assessments: m.assessments.map((a) => ({
                assessmentName: a.assessmentName,
                marksObtained: a.marksObtained,
                totalMarks: exam.subjects.find((s) => s.name === m.subjectName)
                  .assessments.find((ass) => ass.name === a.assessmentName).totalMarks,
              })),
            })),
            coScholasticMarks: studentData.coScholasticMarks || [],
            session: req.user.session,
          });
        }

        await studentMark.save();
        results.push(studentMark);
      } catch (error) {
        errors.push({ studentId: studentData.studentId, error: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};