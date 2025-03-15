const mongoose = require('mongoose');

const Attendance = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true
    },
    studentId: {
        type: String,
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    rollNo: {
        type: String,
        required: true
    },
    examName: {
        type: String,
        required: true
    },
    className:{
        type: String,
        required: true
    },
    section:{
        type: String,
        required: true
    },
    subjects: [
        {
            subjectName: {
                type: String,
                required: true
            },

            marks: {
                type: Number,
                required: true
            }
        }
    ],
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
    // resultData: [
    //     {
    //         studentName: {
    //             type: String,
    //             required: true
    //         },
    //         rollNo: {
    //             type: String,
    //             required: ture
    //         },
    //         studentId: {
    //             type: String,
    //             required: true
    //         },
    //         subjects: [
    //             {
    //                 subjectName: {
    //                     type: String,
    //                     required: true
    //                 },

    //                 marks: {
    //                     type: Number,
    //                     required: true
    //                 }
    //             }
    //         ]
    //     }
    // ]
})
module.exports = mongoose.model('Results', Attendance)