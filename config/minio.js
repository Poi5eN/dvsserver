const AWS = require('aws-sdk');
require('dotenv').config(); // Load environment variables

const s3 = new AWS.S3({
  endpoint: process.env.MINIO_ENDPOINT || 'http://147.93.106.220:9000',
  accessKeyId: process.env.MINIO_ACCESS_KEY,
  secretAccessKey: process.env.MINIO_SECRET_KEY,
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
});

// console.log('s3 initialized in minio.js:', s3); // Debug log
module.exports = s3;