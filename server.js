const app = require('./app');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary');
const s3 = require('./config/minio'); // Import from new file
const connectToDatabase = require('./config/database');

dotenv.config();

connectToDatabase();

// Cloudinary config
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLIENT_NAME,
  api_key: process.env.CLOUDINARY_CLIENT_API,
  api_secret: process.env.CLOUDINARY_CLIENT_SECRET,
});

// console.log('s3 defined in server.js:', s3); // Debug log
app.listen(process.env.PORT, () => {
  console.log(`Server is running on ${process.env.PORT}`);
});

module.exports = { app, s3 };