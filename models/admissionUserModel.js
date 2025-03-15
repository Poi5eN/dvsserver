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
        minlength: [8, "Password cannot be less than 8 characters"],
        select: false
    },
    role: {
        type: String,
        required: true,
        // default: 'admission'
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
        type: String
    },
    fatherName: {
        type: String
    },
    joiningDate: {
        type: Date,
        required: true
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
    salary: {
        type: Number
    },
    contact: {
        type: Number,
        require: true
    },
    address: {
        type: String
    },
    experience: {
        type: String
    },
    qualification: {
        type: String
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    }
})

const admissionUser = mongoose.model('admissionUser', userSchema)

module.exports = admissionUser