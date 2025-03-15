const mongoose = require("mongoose");

const Attendance = new mongoose.Schema({
  schoolId: {
    type: String,
    required: true,
  },
  className:{
    type: String,
    required: true,
  },
  section:{
    type: String,
    required: true,
  },
  studentId: {
    type: String,
    required: true,
  },
  rollNo: {
    type: String,
  },
  date: {
    type: Date,
    required: true,
  },
  present: {
    type: Boolean,
    default: false,
  },
  session: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now()
}
  // attendance: [
  //     {
  //         date: {
  //             type: Date,
  //             required: true
  //         },
  //         status: {
  //             type: String,
  //             required: true
  //         }
  //     }
  // ],
  // year: [String],
  // month: [String]
});
module.exports = mongoose.model("Attendance", Attendance);
