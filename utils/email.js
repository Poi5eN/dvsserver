const nodemailer = require('nodemailer')


  
  const sendEmail = async (toEmail, subject, htmlContent) => {

    console.log(toEmail)

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_MAIL,
        pass: process.env.SMTP_PASSWORD
      },
    });

    try {
      const mailOptions = {
        from: process.env.SMTP_MAIL,
        to: toEmail,
        subject: subject,
        html: htmlContent,
      };
    
      await transporter.sendMail(mailOptions);
    }
    catch (error) {
      console.log(error);
    }

  };

module.exports = sendEmail