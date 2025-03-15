const mongoose = require('mongoose');

const ContactUsModel = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email:{
    type: String,
    required: true,
  },
  contact: {
    type: Number,
    required: true
  },
  schoolName:{
    type: String,
    required:false
  },
  message:{
    type: String,
    required: true,
  },
  session: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now()
}
});

const ContactUs = mongoose.model('ContactUs', ContactUsModel);

module.exports = ContactUs;