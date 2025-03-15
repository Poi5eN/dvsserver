const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: [true, "Please Enter the Password"],
        minlength: [8, "Password cannot exceed more than 8 characters"],
        select: false
    },
    role: {
        type: String,
        required: true,
        // default: 'account'
    },
    dateOfBirth: {
        type: Date,
        required: true,
        validate: {
            validator: function (value) {
                return value <= new Date()
            },
            message: 'Date of birth cannot be in the future'
        }
    },
    gender: {
        type: String,
        required: true,
    },
    fatherName: {
        type: String,
    },
    joiningDate: {
        type: Date,
        required: true
    },
    salary: {
        type: Number,
        required: true,
    },
    contact: {
        type: Number,
        required: true,
    },
    address: {
        type: String,
        required: true,
    },
    experience: {
        type: String,
        required: true,
    },
    qualification: {
        type: String,
        required: true,
    },
    image:{
        public_id:{
            type:String,
            required:true
        },
        url:{
            type:String,
            required:true
        }
    },
    // session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
})

const accountUser = mongoose.model('accountUser', userSchema)

module.exports = accountUser