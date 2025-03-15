const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true
    },
    bookName: {
        type: String,
        required: [true, "Please Enter Book Name"]
    },
    authorName: {
        type: String,
        required: [true, "Please Enter Author Name"]
    },
    quantity: {
        type: Number,
        required: true,
        default: 1
    },
    category: {
        type: String,
        required: true
    },
    className: {
        type: String,
    },
    subject: {
        type: String,
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
})


const BookModel = mongoose.model('BookModel', bookSchema);

module.exports = BookModel