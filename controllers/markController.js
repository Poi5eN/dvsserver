const Mark = require('../models/mark');
const Exam = require('../models/exam');

exports.addMark = async (req, res) => {
    try {
        const { studentId, examId, marks, coScholasticMarks } = req.body;

        // Verify the exam exists and belongs to the school
        const exam = await Exam.findOne({
            _id: examId,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found or access denied"
            });
        }

        let studentMark = await Mark.findOne({
            studentId,
            examId,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        if (studentMark) {
            // Update existing marks with validation
            marks.forEach(newSubjectMark => {
                // Validate against exam's subject configuration
                const examSubject = exam.subjects.find(s => s.name === newSubjectMark.subjectName);
                if (!examSubject) {
                    throw new Error(`Subject ${newSubjectMark.subjectName} not found in exam configuration`);
                }
                if (newSubjectMark.marks > examSubject.totalMarks) {
                    throw new Error(`Marks cannot exceed total marks for ${newSubjectMark.subjectName}`);
                }

                const existingSubjectIndex = studentMark.marks.findIndex(
                    m => m.subjectName === newSubjectMark.subjectName
                );

                if (existingSubjectIndex !== -1) {
                    studentMark.marks[existingSubjectIndex] = newSubjectMark;
                } else {
                    studentMark.marks.push(newSubjectMark);
                }
            });

            if (coScholasticMarks?.length > 0) {
                studentMark.coScholasticMarks = coScholasticMarks;
            }
        } else {
            // Create new student mark
            studentMark = new Mark({
                studentId,
                examId,
                schoolId: req.user.schoolId,
                className: req.user.classTeacher,
                section: req.user.section,
                marks,
                coScholasticMarks: coScholasticMarks || []
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
        const { studentId, examId } = req.query;
        const query = {
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        };

        if (studentId) query.studentId = studentId;
        if (examId) query.examId = examId;

        const marks = await Mark.find(query)
            .populate('studentId', 'name rollNo')
            .sort({ 'studentId.rollNo': 1 });

        res.status(200).json({ success: true, marks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateMark = async (req, res) => {
    try {
        const mark = await Mark.findOne({
            _id: req.params.id,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        if (!mark) {
            return res.status(404).json({
                success: false,
                message: "Mark record not found"
            });
        }

        // Validate new marks against exam configuration
        const exam = await Exam.findById(mark.examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Associated exam not found"
            });
        }

        // Update marks with validation
        if (req.body.marks) {
            req.body.marks.forEach(newMark => {
                const examSubject = exam.subjects.find(s => s.name === newMark.subjectName);
                if (!examSubject) {
                    throw new Error(`Subject ${newMark.subjectName} not found in exam configuration`);
                }
                if (newMark.marks > examSubject.totalMarks) {
                    throw new Error(`Marks cannot exceed total marks for ${newMark.subjectName}`);
                }
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
            _id: req.params.id,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        if (!mark) {
            return res.status(404).json({
                success: false,
                message: "Mark record not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Mark record deleted successfully"
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStudentMarks = async (req, res) => {
    try {
        const studentId = req.params.studentId;
        const marks = await Mark.find({
            studentId,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        }).populate('examId', 'name examType startDate endDate');

        if (!marks.length) {
            return res.status(404).json({
                success: false,
                message: "No marks found for this student"
            });
        }

        res.status(200).json({ success: true, marks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getExamMarks = async (req, res) => {
    try {
        const examId = req.params.examId;
        const marks = await Mark.find({
            examId,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        }).populate('studentId', 'name rollNo');

        if (!marks.length) {
            return res.status(404).json({
                success: false,
                message: "No marks found for this exam"
            });
        }

        res.status(200).json({ success: true, marks });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getClassPerformance = async (req, res) => {
    try {
        const marks = await Mark.find({
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        }).populate('examId', 'name examType');

        // Calculate class performance metrics
        const performance = {
            totalStudents: marks.length,
            classAverage: marks.reduce((acc, curr) => acc + curr.percentage, 0) / marks.length,
            passPercentage: (marks.filter(m => m.isPassed).length / marks.length) * 100,
            gradeDistribution: {
                'A+': marks.filter(m => m.grade === 'A+').length,
                'A': marks.filter(m => m.grade === 'A').length,
                'B': marks.filter(m => m.grade === 'B').length,
                'C': marks.filter(m => m.grade === 'C').length,
                'D': marks.filter(m => m.grade === 'D').length,
                'F': marks.filter(m => m.grade === 'F').length
            },
            subjectWisePerformance: {}
        };

        // Calculate subject-wise performance
        marks.forEach(mark => {
            mark.marks.forEach(subject => {
                if (!performance.subjectWisePerformance[subject.subjectName]) {
                    performance.subjectWisePerformance[subject.subjectName] = {
                        totalMarks: 0,
                        totalStudents: 0,
                        passCount: 0
                    };
                }
                const subjectData = performance.subjectWisePerformance[subject.subjectName];
                subjectData.totalMarks += subject.marks;
                subjectData.totalStudents += 1;
                if (subject.isPassed) subjectData.passCount += 1;
            });
        });

        // Calculate averages for each subject
        Object.keys(performance.subjectWisePerformance).forEach(subject => {
            const data = performance.subjectWisePerformance[subject];
            data.average = data.totalMarks / data.totalStudents;
            data.passPercentage = (data.passCount / data.totalStudents) * 100;
        });

        res.status(200).json({ success: true, performance });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.bulkUploadMarks = async (req, res) => {
    try {
        const { examId, studentsMarks } = req.body;

        // Verify the exam exists and belongs to the school
        const exam = await Exam.findOne({
            _id: examId,
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: "Exam not found or access denied"
            });
        }

        const results = [];
        const errors = [];

        // Process each student's marks
        for (const studentData of studentsMarks) {
            try {
                // Find existing mark for the student
                let studentMark = await Mark.findOne({
                    studentId: studentData.studentId,
                    examId,
                    schoolId: req.user.schoolId,
                    className: req.user.classTeacher,
                    section: req.user.section
                });

                if (studentMark) {
                    // Update existing marks
                    studentData.marks.forEach(newSubjectMark => {
                        const examSubject = exam.subjects.find(s => s.name === newSubjectMark.subjectName);
                        if (!examSubject) {
                            throw new Error(`Subject ${newSubjectMark.subjectName} not found in exam configuration`);
                        }
                        if (Number(newSubjectMark.marks) > examSubject.totalMarks) {
                            throw new Error(`Marks cannot exceed total marks for ${newSubjectMark.subjectName}`);
                        }

                        const existingSubjectIndex = studentMark.marks.findIndex(
                            m => m.subjectName === newSubjectMark.subjectName
                        );

                        if (existingSubjectIndex !== -1) {
                            studentMark.marks[existingSubjectIndex] = newSubjectMark;
                        } else {
                            studentMark.marks.push(newSubjectMark);
                        }
                    });
                } else {
                    // Create new student mark
                    studentMark = new Mark({
                        studentId: studentData.studentId,
                        examId,
                        schoolId: req.user.schoolId,
                        className: req.user.classTeacher,
                        section: req.user.section,
                        marks: studentData.marks,
                        coScholasticMarks: studentData.coScholasticMarks || []
                    });
                }

                await studentMark.save();
                results.push(studentMark);
            } catch (error) {
                errors.push({
                    studentId: studentData.studentId,
                    error: error.message
                });
            }
        }

        res.status(201).json({
            success: true,
            message: `Successfully processed marks for ${results.length} students`,
            failedCount: errors.length,
            results,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};