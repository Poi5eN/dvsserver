const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: [true, "Please Enter Title of Notice"]
    },
    content: {
        type: String,
        required: [true, "Please Enter Content of Notice"]
    },
    class: {
        type: String
    },
    section: {
        type: String
    },
    role: {
        type: String
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    file: {
        public_id: {
            type: String,
            // required: true
        },
        url: {
            type: String,
            // required: true
        }
    }
});

module.exports = mongoose.model("Notice", noticeSchema);
