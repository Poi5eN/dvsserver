const mongoose = require('mongoose');

const Event = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true
    },
    Subject: {
        type: String
    },
    Location: {
        type: String
    },
    StartTime: {
        type: Date,
    },
    EndTime: {
        type: Date,
    },
    // repeat: {
    //     type: String,
    // },
    Description: {
        type: String
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
})
module.exports = mongoose.model('Event', Event)