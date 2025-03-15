// const multer = require('multer')
// const storage = multer.memoryStorage()

// const singleUpload = multer({storage}).single('image')
// const uploads = multer({storage}).any()

// module.exports = {singleUpload, uploads}

// TRYING SOLUTION CODE START
const multer = require('multer');
const storage = multer.memoryStorage();

const singleUpload = multer({ storage }).single('image');
const uploads = multer({ storage }).any();

module.exports = { singleUpload, uploads };

// TRYING SOLUTION CODE END

// const multer = require('multer');
// const path = require('path');

// // Disk storage configuration
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/'); // Directory for storing files
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname)); // Adding timestamp to the file name
//   }
// });

// // Create multer instance
// const upload = multer({ storage });

// // Middleware to handle single file uploads
// const singleUpload = upload.single('image');

// // Middleware to handle multiple file uploads (array with field name 'images')
// const multipleUploads = upload.array('images', 10); // Adjust limit if necessary

// // Middleware to handle bulk uploads (files can be accessed in req.files)
// const bulkUploads = upload.any();

// module.exports = { singleUpload, multipleUploads, bulkUploads };



// const multer = require('multer');
// const path = require('path');

// // Disk storage configuration
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/'); // Directory for storing files
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname)); // Adding timestamp to the file name
//   }
// });

// const upload = multer({ storage });

// // Middleware to handle single file uploads
// const singleUpload = upload.single('image');

// // Middleware to handle multiple files uploads
// const uploads = upload.any();

// module.exports = { singleUpload, uploads };
