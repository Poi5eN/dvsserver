const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: [true, "Please Enter Full Name"]
    },
    employeeId: {
        type: String,
        required: [true, "Please Enter EmployeeId of Teacher"]
    },
    email: {
        type: String,
        required: [true, "Please Enter Email Address"]
    },
    password: {
        type: String,
        required: [true, "Please Enter Password"],
        minLength: [8, "Minimum 8 characters Required in Password"],
        select: false
    },
    dateOfBirth: {
        type: Date,
        required: true,
        validate: {
            validator: function(value) {
                return value <= new Date()
            },
            message: "Date of birth cannot be in the future"
        }
    },
    status:{
        type:String,
        required: true,
        default: "active"
    },
    qualification: {
        type: String,
        required: true
    },
    salary: {
        type: Number,
        required: true
    },
    gender: {
        type: String,
        required: true
    },
    joiningDate: {
        type: Date,
        required: true,
        default: Date.now()
    },
    address: {
        type: String,
        required: true
    },
    contact: {
        type: Number,
        required: true
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    image: {
        public_id: {
            type: String,
            required: true
        },
        url: {
            type: String,
            required: true
        }
    }
});

module.exports = mongoose.model("EmployeeModel", employeeSchema);