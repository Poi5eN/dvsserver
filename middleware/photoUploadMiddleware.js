const multer = require("multer");

const storage = multer.memoryStorage();

const photoUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "studentImage" && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error(file.fieldname === "studentImage" ? "Only image files are allowed" : "Invalid field name"), false);
    }
  },
}).single("studentImage");

module.exports = photoUpload;