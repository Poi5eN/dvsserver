const mongoose = require("mongoose");

const issueBookSchema = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "NewStudentModel",
        required: true
    },
    bookName: {
        type: String,
        required: true
    },
    // subject: {
    //     type: String,
    //     required: true
    // },
    issueDate: {
        type: Date,
        default: Date.now(),
        required: true
    },
    returnDate: {
        type: Date, // Add a field to store the return date
    },
    // className: {
    //     type: String,
    //     required: true
    // },
    bookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BookModel",
        required: true
    },
    status:{
        type: String,
        required: true,
        default: "issued"
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
})

module.exports = mongoose.model("IssueBook", issueBookSchema);