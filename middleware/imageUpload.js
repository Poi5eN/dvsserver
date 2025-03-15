// middlewares/imageUpload.js
const multer = require('multer');

// Use memory storage so that files are kept in memory (not saved to disk)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Specify the image fields to handle; each accepts one file
const imageFields = [
  { name: 'studentPhoto', maxCount: 1 },
  { name: 'motherPhoto', maxCount: 1 },
  { name: 'fatherPhoto', maxCount: 1 },
  { name: 'guardianPhoto', maxCount: 1 }
];

// This middleware will process the file uploads for the specified fields.
const uploadImages = upload.fields(imageFields);

// This middleware converts the uploaded file buffers into Base64 strings and
// attaches them to req.body so that your controller will receive Base64 strings.
const convertImagesToBase64 = (req, res, next) => {
  if (req.files) {
    if (req.files.studentPhoto && req.files.studentPhoto[0]) {
      const file = req.files.studentPhoto[0];
      req.body.studentPhoto = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }
    if (req.files.motherPhoto && req.files.motherPhoto[0]) {
      const file = req.files.motherPhoto[0];
      req.body.motherPhoto = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }
    if (req.files.fatherPhoto && req.files.fatherPhoto[0]) {
      const file = req.files.fatherPhoto[0];
      req.body.fatherPhoto = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }
    if (req.files.guardianPhoto && req.files.guardianPhoto[0]) {
      const file = req.files.guardianPhoto[0];
      req.body.guardianPhoto = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }
  }
  next();
};

module.exports = { uploadImages, convertImagesToBase64 };
