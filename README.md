# DigitalVidyaSaarthi Backend (dvsserver)

## 🎯 Overview

The backend API server for DigitalVidyaSaarthi school management system. Built with Node.js and Express, it provides a comprehensive RESTful API for all school management operations.

## 🔧 Technology Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: Cloudinary, AWS S3
- **Security**: bcrypt, CORS, Rate Limiting
- **Validation**: Express Validator
- **Documentation**: API Documentation with examples

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (v5.0 or higher)
- npm or yarn

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Environment Setup:**
```bash
cp .env.example .env
```

3. **Configure Environment Variables:**
```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/DigitalVidyaSaarthi
DB_URI=mongodb://localhost:27017/DigitalVidyaSaarthi

# Authentication
JWT_SECRET=your_super_secret_jwt_key_here

# File Storage - Cloudinary
CLOUDINARY_CLIENT_NAME=your_cloudinary_name
CLOUDINARY_CLIENT_API=your_api_key
CLOUDINARY_CLIENT_SECRET=your_api_secret

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# AWS S3 (Alternative Storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_BUCKET_NAME=your_bucket_name
AWS_REGION=us-east-1
```

4. **Start Development Server:**
```bash
npm run dev
```

The server will start on `http://localhost:4000`

## 📁 Project Structure

```
dvsserver/
├── config/
│   ├── database.js          # Database connection
│   └── minio.js             # File storage config
├── controllers/
│   ├── adminController.js   # Admin operations
│   ├── authController.js    # Authentication
│   ├── examController.js    # Examination system
│   ├── feeController.js     # Fee management
│   └── ...                  # Other controllers
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── multer.js            # File upload handling
│   └── validation.js        # Input validation
├── models/
│   ├── adminModel.js        # Admin schema
│   ├── studentModel.js      # Student schema
│   ├── teacherModel.js      # Teacher schema
│   └── ...                  # Other models
├── routes/
│   ├── adminRoute.js        # Admin routes
│   ├── authRoutes.js        # Authentication routes
│   ├── exam.js              # Exam routes
│   └── ...                  # Other route files
├── utils/
│   ├── numberGenerator.js   # Utility functions
│   └── helpers.js           # Helper functions
├── app.js                   # Express app configuration
├── server.js                # Server entry point
└── package.json             # Dependencies and scripts
```

## 🔐 Authentication & Authorization

The API uses JWT-based authentication with role-based access control:

### Roles
- **Super Admin**: Full system access
- **Admin**: School-level administration
- **Teacher**: Class and student management
- **Student**: Personal academic data access
- **Parent**: Child's academic data access
- **Third Party**: Limited integration access
- **Receptionist**: Registration and basic operations
- **Accountant**: Financial operations

### Authentication Flow
1. User logs in with credentials
2. Server validates and returns JWT token
3. Client includes token in Authorization header
4. Server validates token for protected routes

## 📊 API Endpoints Overview

### Authentication
- `POST /login` - User authentication
- `GET /logout` - User logout

### Admin Operations
- `GET /adminRoute/studentparent` - Get all students
- `POST /adminRoute/studentparent` - Create student
- `PUT /adminRoute/studentparent/:id` - Update student
- `DELETE /adminRoute/studentparent/:id` - Delete student

### Teacher Management
- `GET /adminRoute/teacher` - Get all teachers
- `POST /adminRoute/teacher` - Create teacher
- `PUT /adminRoute/teacher/:id` - Update teacher

### Examination System
- `POST /exam/exams` - Create exam
- `GET /exam/exams` - Get exams
- `POST /exam/exams/:id/results` - Submit results

### Fee Management
- `GET /fees/getFeeStatus` - Get fee status
- `POST /fees/createOrUpdateFeePayment` - Process payment
- `GET /fees/getFeeHistory` - Get payment history

For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## 🗄️ Database Schema

### Key Collections
- **admins**: School administrators
- **students**: Student records
- **teachers**: Teacher information
- **classes**: Class definitions
- **exams**: Examination data
- **fees**: Fee structure and payments
- **attendance**: Daily attendance records
- **results**: Exam results and grades

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt for password security
- **Input Validation**: Comprehensive data validation
- **Rate Limiting**: API request rate limiting
- **CORS Configuration**: Cross-origin request handling
- **File Upload Security**: Secure file handling
- **SQL Injection Prevention**: MongoDB injection protection

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --grep "Auth"
```

## 🚀 Deployment

### Production Build
```bash
# Install production dependencies
npm ci --only=production

# Start production server
npm start
```

### Docker Deployment
```bash
# Build Docker image
docker build -t dvsserver .

# Run container
docker run -p 4000:4000 --env-file .env dvsserver
```

### Environment-specific Configurations

#### Development
```bash
npm run dev
```

#### Production
```bash
NODE_ENV=production npm start
```

## 📈 Monitoring & Logging

- **Error Logging**: Comprehensive error tracking
- **Request Logging**: HTTP request logging
- **Performance Monitoring**: Response time tracking
- **Database Monitoring**: MongoDB performance metrics

## 🔧 Scripts

```bash
# Development
npm run dev          # Start with nodemon
npm start           # Start production server
npm test            # Run tests
npm run lint        # Code linting
npm run format      # Code formatting

# Database
npm run migrate     # Run database migrations
npm run seed        # Seed database with sample data

# Build
npm run build       # Build for production
npm run obfuscate   # Obfuscate code for security
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Check MongoDB is running
   - Verify connection string in .env
   - Ensure database permissions

2. **JWT Token Issues**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Validate token format

3. **File Upload Problems**
   - Check Cloudinary credentials
   - Verify file size limits
   - Ensure proper MIME types

4. **CORS Errors**
   - Update CORS origins in app.js
   - Check frontend URL configuration

## 📞 Support

For backend-specific issues:
- Check logs in `logs/` directory
- Review error messages in console
- Verify environment configuration
- Check database connectivity

## 🔄 API Versioning

Current API version: `v2.0.0`

Version history:
- `v2.0.0`: Modern UI integration, enhanced security
- `v1.5.0`: Exam system, bulk operations
- `v1.0.0`: Initial release
