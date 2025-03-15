// resultController.js
const ExamModel = require("../models/examModel");
const ResultModel = require("../models/resultModel");
const NewStudentModel = require("../models/newStudentModel");
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');


exports.createResults = async (req, res) => {
  try {
    const { resultsRecords, examName, className, section } = req.body;

    console.log("first", resultsRecords);
    
    const updatePromises = resultsRecords.map(
      async ({ studentId, studentName, rollNo, subjects }) => {
        const query = {
          schoolId: req.user.schoolId,
          studentId: studentId,
          examName: examName,
        };

        const update = {
          $set: {
            schoolId: req.user.schoolId,
            studentId: studentId,
            rollNo: rollNo,
            studentName: studentName,
            className: className,
            section: section,
            examName: examName,
            subjects,
          },
        };

        
        const options = { upsert: true, new: true, setDefaultsOnInsert: true };
        return Results.findOneAndUpdate(query, update, options);
      }
    );

   
    const updatedResults = await Promise.all(updatePromises);

    res.status(201).json({ success: true, data: updatedResults });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Failed to create/update Results",
      error: error.message,
    });
  }
};

exports.getResults = async (req, res) => {
  try {
    const { examId, class: className, section } = req.query;
    const results = await ResultModel.find({
      examId,
      class: className,
      section
    });
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateResult = async (req, res) => {
  try {
    const { examId, studentId, subjectCode, componentName, marks } = req.body;
    
    await ResultModel.findOneAndUpdate(
      { examId, studentId },
      {
        $set: {
          [`marks.${subjectCode}.${componentName}`]: marks
        }
      },
      { upsert: true }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.downloadTemplate = async (req, res) => {
  try {
    const { examId, class: className, section } = req.query;
    const exam = await ExamModel.findById(examId);
    const students = await NewStudentModel.find({ class: className, section });

    // Create Excel template with student list and mark columns
    const worksheetData = students.map(student => ({
      studentId: student._id,
      studentName: student.fullName,
      marks: exam.subjects.map(subject => ({ subjectCode: subject.code, marks: '' }))
    }));

    // Create Excel workbook
    const ws = xlsx.utils.json_to_sheet(worksheetData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Student Marks');

    // Write the workbook to a buffer
    const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

    // Set the response headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename=marks_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Send the file buffer as a response
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.uploadResults = async (req, res) => {
  try {
    const file = req.file;
    const { examId, class: className, section } = req.body;

    // Parse Excel file
    const workbook = xlsx.readFile(file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]; // Assuming the first sheet contains data
    const studentsData = xlsx.utils.sheet_to_json(worksheet);

    for (const data of studentsData) {
      const { studentId, marks } = data;

      // Validate marks against max marks
      const exam = await ExamModel.findById(examId);
      for (const subject of exam.subjects) {
        const subjectCode = subject.code;
        const maxMarks = subject.maxMarks;
        
        if (marks[subjectCode] > maxMarks) {
          return res.status(400).json({
            success: false,
            message: `Marks for ${subjectCode} cannot exceed ${maxMarks}`
          });
        }
      }

      // Update results in the database
      await ResultModel.findOneAndUpdate(
        { examId, studentId },
        { $set: { marks } },
        { upsert: true }
      );
    }

    // Delete the uploaded file from the server after processing
    fs.unlinkSync(file.path);

    res.json({ success: true, message: 'Results uploaded successfully' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.generateBulkReportCards = async (req, res) => {
  try {
    const { examId, class: className, section } = req.query;
    const exam = await ExamModel.findById(examId);
    const students = await NewStudentModel.find({ class: className, section });
    const results = await ResultModel.find({ examId, class: className, section });

    // Create a new PDF document
    const doc = new PDFDocument();

    // Stream the PDF to a file
    const filePath = path.join(__dirname, `../../uploads/report_cards_${examId}.pdf`);
    doc.pipe(fs.createWriteStream(filePath));

    // Generate report cards for each student
    students.forEach(student => {
      const studentResult = results.find(result => result.studentId.toString() === student._id.toString());
      if (studentResult) {
        doc.addPage();
        doc.fontSize(16).text(`Report Card - ${student.fullName}`, { align: 'center' });

        // Exam and student details
        doc.fontSize(12).text(`Exam: ${exam.name}`);
        doc.text(`Class: ${student.class} | Section: ${student.section}`);
        doc.text(`Date of Birth: ${student.dateOfBirth}`);
        
        // Marks and Grades
        doc.text('Subjects and Marks:');
        exam.subjects.forEach(subject => {
          const subjectCode = subject.code;
          const marks = studentResult.marks[subjectCode] || 'N/A';
          doc.text(`${subject.name}: ${marks}`);
        });

        // Page break after each report card
        doc.text('--------------------------------------');
      }
    });

    // Finalize the PDF document
    doc.end();

    // Wait for PDF file to be generated before sending it
    doc.on('finish', () => {
      res.download(filePath, (err) => {
        if (err) {
          res.status(500).json({ success: false, error: 'Error downloading the report card' });
        } else {
          // Optionally, delete the file after download
          fs.unlinkSync(filePath);
        }
      });
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
