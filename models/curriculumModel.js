const mongoose = require("mongoose");

const curriculumSchema = new mongoose.Schema({
    schoolId : {
        type: String,
        required: true
    },
    className: {
        type: String,
        required: [true, "Please Enter Title of Notice"]
    },
    academicYear: {
        type: String,
        required: [true, "Please Enter Content of Notice"]
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
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
});

module.exports = mongoose.model("Curriculum", curriculumSchema);