// Student Marks Model
const studentMarksSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    studentId: {
        type: String,
        required: true
    },
    className: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    subjectMarks: [{
        subjectName: String,
        subjectCode: String,
        componentWiseMarks: [{
            componentName: String,
            marksObtained: Number,
            maxMarks: Number
        }],
        totalMarks: Number,
        percentage: Number,
        grade: String,
        remarks: String
    }],
    totalMarks: Number,
    percentage: Number,
    grade: String,
    rank: Number,
    attendance: Number,
    teacherRemarks: String,
    status: {
        type: String,
        enum: ['DRAFT', 'FINALIZED'],
        default: 'DRAFT'
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
});

exports.ExamModel = mongoose.model("Exam", examSchema);
exports.StudentMarksModel = mongoose.model("StudentMarks", studentMarksSchema);