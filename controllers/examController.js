const Exam = require('../models/exam');

exports.createExam = async (req, res) => {
    try {
        const examData = {
            ...req.body,
            schoolId: req.user.schoolId,
            createdBy: req.user._id,
            className: req.body.className || req.user.classTeacher,
            section: req.body.section || req.user.section
        };

        // Log exam data for debugging
        console.log("Exam Data:", examData);

        // Check if exam already exists for the same class and type
        const existingExam = await Exam.findOne({
            schoolId: examData.schoolId,
            className: examData.className,
            section: examData.section,
            examType: req.body.examType,
            startDate: req.body.startDate,
            endDate: req.body.endDate
        });

        if (existingExam) {
            return res.status(400).json({
                success: false,
                message: "An exam with these details already exists"
            });
        }

        const exam = new Exam(examData);
        await exam.save();
        res.status(201).json({ success: true, exam });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(400).json({ success: false, message: error.message });
    }
};


exports.getExams = async (req, res) => {
    try {
        // Log the user object and query for debugging
        console.log("req.user:", req.user);
        const query = {
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        };
        console.log("Query:", query);

        const exams = await Exam.find(query)
            .sort({ startDate: -1 });

        // Log the result before sending the response
        console.log("Found Exams:", exams);

        res.status(200).json({ success: true, exams });
    } catch (error) {
        console.error("Error in getExams:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Single Exam
exports.getExamById = async (req, res) => {
    try {
        const exam = await Exam.findOne({
            _id: req.params.id,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found"
            });
        }

        res.status(200).json({ success: true, exam });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update Exam
exports.updateExam = async (req, res) => {
    try {
        const exam = await Exam.findOne({
            _id: req.params.id,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found"
            });
        }

        // Validate dates if they are being updated
        if (req.body.startDate || req.body.endDate || req.body.resultPublishDate) {
            validateExamDates(
                req.body.startDate || exam.startDate,
                req.body.endDate || exam.endDate,
                req.body.resultPublishDate || exam.resultPublishDate
            );
        }

        Object.assign(exam, req.body);
        await exam.save();

        res.status(200).json({ success: true, exam });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// Delete Exam
exports.deleteExam = async (req, res) => {
    try {
        const exam = await Exam.findOneAndDelete({
            _id: req.params.id,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Exam deleted successfully"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Additional Exam Controllers
exports.getUpcomingExams = async (req, res) => {
    try {
        const upcomingExams = await Exam.find({
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section,
            startDate: { $gt: new Date() }
        }).sort({ startDate: 1 });

        res.status(200).json({ success: true, exams: upcomingExams });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Add additional helper function to validate exam dates
const validateExamDates = (startDate, endDate, resultDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const result = new Date(resultDate);

    if (end < start) {
        throw new Error('End date cannot be before start date');
    }
    if (result < end) {
        throw new Error('Result publish date cannot be before exam end date');
    }
};


// Additional controller functions for examController.js
exports.submitExamResults = async (req, res) => {
    try {
        const exam = await Exam.findOne({
            _id: req.params.id,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found"
            });
        }

        // Add your exam results submission logic here
        // This could involve creating mark entries for multiple students

        res.status(200).json({
            success: true,
            message: "Exam results submitted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.generateReportCard = async (req, res) => {
    try {
        const { examId, studentId } = req.params;

        // Find the mark record
        const markRecord = await Mark.findOne({
            examId,
            studentId,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        }).populate('studentId', 'name rollNo');

        if (!markRecord) {
            return res.status(404).json({
                success: false,
                message: "Mark record not found"
            });
        }

        res.status(200).json({
            success: true,
            reportCard: markRecord
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getExamAnalytics = async (req, res) => {
    try {
        const examId = req.params.id;

        // Get all marks for this exam
        const marks = await Mark.find({
            examId,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        // Calculate analytics
        const analytics = {
            totalStudents: marks.length,
            passPercentage: (marks.filter(m => m.isPassed).length / marks.length) * 100,
            highestScore: Math.max(...marks.map(m => m.percentage)),
            lowestScore: Math.min(...marks.map(m => m.percentage)),
            averageScore: marks.reduce((acc, curr) => acc + curr.percentage, 0) / marks.length,
            gradeDistribution: {
                'A+': marks.filter(m => m.grade === 'A+').length,
                'A': marks.filter(m => m.grade === 'A').length,
                'B': marks.filter(m => m.grade === 'B').length,
                'C': marks.filter(m => m.grade === 'C').length,
                'D': marks.filter(m => m.grade === 'D').length,
                'F': marks.filter(m => m.grade === 'F').length
            }
        };

        res.status(200).json({
            success: true,
            analytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Additional controller functions for markController.js
exports.getStudentMarks = async (req, res) => {
    try {
        const marks = await Mark.find({
            studentId: req.params.studentId,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        }).populate('examId', 'name examType');

        res.status(200).json({
            success: true,
            marks
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getClassPerformance = async (req, res) => {
    try {
        const marks = await Mark.find({
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        const performance = {
            totalStudents: marks.length,
            classAverage: marks.reduce((acc, curr) => acc + curr.percentage, 0) / marks.length,
            passPercentage: (marks.filter(m => m.isPassed).length / marks.length) * 100,
            subjectWisePerformance: {}
        };

        res.status(200).json({
            success: true,
            performance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.bulkUploadMarks = async (req, res) => {
    try {
        const { examId, marks } = req.body;

        // Validate exam
        const exam = await Exam.findOne({
            _id: examId,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found"
            });
        }

        // Process bulk marks
        const markRecords = marks.map(mark => ({
            ...mark,
            examId,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        }));

        const insertedMarks = await Mark.insertMany(markRecords);

        res.status(201).json({
            success: true,
            message: `Successfully uploaded marks for ${insertedMarks.length} students`,
            marks: insertedMarks
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get exams by class and section
exports.getExamsByClass = async (req, res) => {
    try {
        const { className, section } = req.params;
        
        const exams = await Exam.find({
            schoolId: req.user.schoolId,
            className,
            section
        }).sort({ startDate: -1 });

        res.status(200).json({ 
            success: true, 
            count: exams.length,
            exams 
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get published exams (where current date is after resultPublishDate)
exports.getPublishedExams = async (req, res) => {
    try {
        const currentDate = new Date();
        
        const exams = await Exam.find({
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section,
            resultPublishDate: { $lte: currentDate }
        }).sort({ resultPublishDate: -1 });

        res.status(200).json({
            success: true,
            count: exams.length,
            exams
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



