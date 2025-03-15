const mongoose = require("mongoose");

const studyMaterial = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true
    },
    className: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: [true, "Please Enter Title of Notice"]
    },
    type: {
        type: String,
        required: true
    },
    link: {
        type: String
    },
    file: {
        public_id: {
            type: String
        },
        url: {
            type: String
        }
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
});

module.exports = mongoose.model("studyMaterial", studyMaterial);