const express = require('express');
const router = express.Router();
const ContactUs = require('../models/ContactUs'); 
const sendEmail = require('../utils/email');
// const nodemailer = require('nodemailer');


exports.contactUs = async (req, res) => {
    try {
    
        const { name, email, contact, schoolName, message } = req.body;
    
        const newContactUs = new ContactUs({
          name,
          email,
          contact,
          schoolName, // Optional
          message,
        });
    
        await newContactUs.save();
    
        // const transporter = nodemailer.createTransport({
        //   service: 'Gmail',
        //   auth: {
        //     user: 'your@email.com',
        //     pass: 'yourpassword',
        //   },
        // });
    
        // const mailOptions = {
        //   from: 'your@email.com',
        //   to: 'recipient@email.com',
        //   subject: 'New Contact Us Submission',
        //   text: `Name: ${name}\nEmail: ${email}\nContact: ${contact}\nSchool Name: ${schoolName || 'Not provided'}\nMessage: ${message}`,
        // };
    
        // await transporter.sendMail(mailOptions);


        const subject = `New Inquiry from [Client Name ${name}]`;

        const content = `
        <html>
            <body style="background-color: #f4f4f4; padding: 20px; margin: 0;">
                <h2 style="color: #333;">New Inquiry: Contact Information</h2>
                <p style="margin-bottom: 10px;"><strong style="color: #555;">Name:</strong> ${name}</p>
                <p style="margin-bottom: 10px;"><strong style="color: #555;">Email:</strong> ${email}</p>
                <p style="margin-bottom: 10px;"><strong style="color: #555;">Contact:</strong> ${contact}</p>
                <p style="margin-bottom: 10px;"><strong style="color: #555;">School Name:</strong> ${schoolName}</p>
                <p style="margin-bottom: 10px;"><strong style="color: #555;">Message:</strong> ${message}</p>
            </body>
        </html>        
        `;



        await sendEmail(process.env.SMTP_MAIL, subject, content);
    
        res.status(201).json({ message: 'ContactUs record created and email sent successfully' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
      }
  };


  exports.getContactUs = async(req,res)=>{
    try {
        const contactUsEntries = await ContactUs.find();
        res.status(200).json(contactUsEntries);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
      }
  }