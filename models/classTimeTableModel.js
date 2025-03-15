const mongoose = require("mongoose");

const daySchema = {
    period1: { type: String, required: true },
    period2: { type: String, required: true },
    period3: { type: String, required: true },
    period4: { type: String, required: true },
    period5: { type: String, required: true },
    period6: { type: String, required: true },
    period7: { type: String, required: true },
    period8: { type: String, required: true },
};

const timeTableSchema = new mongoose.Schema({
    schoolId: {
        type: String,
        required: true
    },
    className: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    session: { type: String, required: true },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    monday: daySchema,
    tuesday: daySchema,
    wednesday: daySchema,
    thursday: daySchema,
    friday: daySchema,
    saturday: daySchema
})

module.exports = mongoose.model("ClassTimeTable", timeTableSchema);


// const mongoose = require("mongoose");

// const timeTableSchema = new mongoose.Schema({
//     schoolId: {
//         type: String,
//         required: true
//     },
//     className: {
//         type: String,
//         required: true
//     },
//     section: {
//         type: String,
//         required: true
//     },
//     days: {
//         type: [
//             {
//                 dayName: {
//                     type: String,
//                     required: true
//                 },
//                 periods: {
//                     type: [String],
//                     required: true
//                 }
//             }
//         ],
//         required: true
//     }
// });

// module.exports = mongoose.model("ClassTimeTable", timeTableSchema);
