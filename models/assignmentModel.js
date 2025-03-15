const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
    schoolId : {
        type: String,
        required: true
    },
    className: {
        type: String,
        required: [true, "Please Enter Class Name"]
    },
    section: {
        type: String,
        required: [true, "Please Enter Section Name"]
    },
    title: {
        type: String,
        required: [true, "Please Enter Title"]
    },
    description: {
        type: String,
        required: [true, "Please Enter Description"]
    },
    dueDate: {
        type: Date,
        required: [true, "Please Enter the Due Date"]
    },
    subject: {
        type: String,
        required: [true, "Please Enter Subject"]
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    file: {
        public_id: {
            type: String,
            required: true
        },
        url: {
            type: String,
            required: true
        }
    },
    session: { type: String, required: true }
});

module.exports = mongoose.model("Assignment", assignmentSchema);