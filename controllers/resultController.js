const Exam = require("../models/exam");
const ResultModel = require("../models/resultModel");
const NewStudentModel = require("../models/newStudentModel");
const xlsx = require("xlsx");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

exports.createResults = async (req, res) => {
  try {
    const { resultsRecords, examName, className, section } = req.body;

    const updatePromises = resultsRecords.map(
      async ({ studentId, studentName, rollNo, subjects }) => {
        const query = { schoolId: req.user.schoolId, studentId, examName, session: req.user.session };
        const update = {
          $set: {
            schoolId: req.user.schoolId,
            studentId,
            rollNo,
            studentName,
            className,
            section,
            examName,
            subjects,
            session: req.user.session,
          },
        };
        const options = { upsert: true, new: true, setDefaultsOnInsert: true };
        return ResultModel.findOneAndUpdate(query, update, options);
      }
    );

    const updatedResults = await Promise.all(updatePromises);
    res.status(201).json({ success: true, data: updatedResults });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create/update Results", error: error.message });
  }
};

exports.getResults = async (req, res) => {
  try {
    const { examId, className, section } = req.query;
    const query = { schoolId: req.user.schoolId, session: req.user.session };

    if (examId) query.examId = examId;
    if (className) query.className = className;
    if (section) query.section = section;

    const results = await ResultModel.find(query);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateResult = async (req, res) => {
  try {
    const { examId, studentId, subjects } = req.body;
    await ResultModel.findOneAndUpdate(
      { examId, studentId, schoolId: req.user.schoolId, session: req.user.session },
      { $set: { subjects } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.downloadTemplate = async (req, res) => {
  try {
    const { examId, className, section } = req.query;
    const exam = await Exam.findOne({ examId, schoolId: req.user.schoolId, session: req.user.session });
    const students = await NewStudentModel.find({ className, section });

    const worksheetData = students.map((student) => ({
      studentId: student._id,
      studentName: student.fullName,
      rollNo: student.rollNo,
      ...exam.subjects.reduce((acc, subject) => {
        acc[subject.name] = "";
        return acc;
      }, {}),
    }));

    const ws = xlsx.utils.json_to_sheet(worksheetData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Student Marks");

    const buffer = xlsx.write(wb, { bookType: "xlsx", type: "buffer" });
    res.setHeader("Content-Disposition", "attachment; filename=marks_template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.uploadResults = async (req, res) => {
  try {
    const file = req.file;
    const { examId, className, section } = req.body;

    const workbook = xlsx.readFile(file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const studentsData = xlsx.utils.sheet_to_json(worksheet);

    const exam = await Exam.findOne({ examId, schoolId: req.user.schoolId, session: req.user.session });

    for (const data of studentsData) {
      const { studentId, studentName, rollNo, ...marks } = data;
      const subjects = Object.keys(marks).map((subjectName) => ({
        subjectName,
        marks: marks[subjectName],
      }));

      await ResultModel.findOneAndUpdate(
        { examId, studentId, schoolId: req.user.schoolId, session: req.user.session },
        { $set: { studentName, rollNo, className, section, examName: exam.name, subjects } },
        { upsert: true }
      );
    }

    fs.unlinkSync(file.path);
    res.json({ success: true, message: "Results uploaded successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.generateBulkReportCards = async (req, res) => {
  try {
    const { examId, className, section } = req.query;
    const exam = await Exam.findOne({ examId, schoolId: req.user.schoolId, session: req.user.session });
    const students = await NewStudentModel.find({ className, section });
    const results = await ResultModel.find({ examId, className, section, schoolId: req.user.schoolId, session: req.user.session });

    const doc = new PDFDocument();
    const filePath = path.join(__dirname, `../../uploads/report_cards_${examId}.pdf`);
    doc.pipe(fs.createWriteStream(filePath));

    students.forEach((student) => {
      const studentResult = results.find((result) => result.studentId.toString() === student._id.toString());
      if (studentResult) {
        doc.addPage();
        doc.fontSize(16).text(`Report Card - ${student.fullName}`, { align: "center" });
        doc.fontSize(12).text(`Exam: ${exam.name}`);
        doc.text(`Class: ${student.className} | Section: ${student.section}`);
        doc.text(`Roll No: ${student.rollNo}`);
        doc.text("Subjects and Marks:");
        studentResult.subjects.forEach((subject) => {
          doc.text(`${subject.subjectName}: ${subject.marks}`);
        });
        doc.text("--------------------------------------");
      }
    });

    doc.end();

    doc.on("finish", () => {
      res.download(filePath, (err) => {
        if (err) res.status(500).json({ success: false, error: "Error downloading the report card" });
        else fs.unlinkSync(filePath);
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};