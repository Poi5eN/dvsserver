# DigitalVidyaSaarthi API Documentation

## Overview
This document provides comprehensive API documentation for the DigitalVidyaSaarthi backend server (dvsserver). The API is built with Node.js, Express, and MongoDB.

## Base URL
```
Production: https://api.digitalvidyasaarthi.in
Development: http://localhost:4000
```

## Authentication
All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Login Endpoint
```http
POST /login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "admin|teacher|student|parent|thirdparty|receptionist|accountant"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "role": "admin",
    "schoolId": "school_id",
    "session": "2024-25"
  }
}
```

## API Routes Overview

### 1. Admin Routes (`/adminRoute`)
Handles all administrative functions including student management, teacher management, fees, and school operations.

### 2. Authentication Routes (`/auth`)
Handles authentication for super admin and other special authentication flows.

### 3. Teacher Routes (`/teacher`)
Manages teacher-specific operations like study materials, attendance, and salary.

### 4. Student/Parent Routes
Integrated within admin routes for student and parent management.

### 5. Third Party Routes (`/thirdparty`)
Handles third-party integrations for admissions and photo services.

### 6. Exam Routes (`/exam`)
Manages examination system, results, and report cards.

### 7. Fee Routes (`/fees`)
Handles fee management, payments, and financial operations.

### 8. Marks Routes (`/marks`)
Manages marks entry, bulk uploads, and mark management.

### 9. Results Routes (`/results`)
Manages result processing, report card generation, and result analytics.

### 10. Super Admin Routes (`/superAdmin`)
Super admin functions for managing multiple schools and administrators.

### 11. Employee Routes (`/employee`)
Employee management including salary payments and HR functions.

### 12. Inventory Routes (`/inventory`)
Inventory management for school supplies and equipment.

### 13. Events Routes (`/events`)
School event management and scheduling.

### 14. Time Table Routes (`/timeTable`)
Class timetable creation and management.

### 15. Receptionist Routes (`/receptionist`)
Receptionist-specific functions for registration management.

### 8. Inventory Routes (`/inventory`)
Manages school inventory, sales, and purchase orders.

## Detailed API Endpoints

### Admin Routes

#### Student Management

**Get All Students**
```http
GET /adminRoute/studentparent
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "student_id",
      "studentName": "John Doe",
      "fatherName": "Father Name",
      "motherName": "Mother Name",
      "class": "10",
      "section": "A",
      "rollNumber": "001",
      "dateOfBirth": "2010-01-01",
      "gender": "Male",
      "address": "Student Address",
      "phoneNumber": "1234567890",
      "email": "student@example.com",
      "admissionDate": "2024-04-01",
      "isActive": true,
      "schoolId": "school_id",
      "session": "2024-25"
    }
  ]
}
```

**Create Student**
```http
POST /adminRoute/studentparent
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
```
studentName: "John Doe"
fatherName: "Father Name"
motherName: "Mother Name"
class: "10"
section: "A"
rollNumber: "001"
dateOfBirth: "2010-01-01"
gender: "Male"
address: "Student Address"
phoneNumber: "1234567890"
email: "student@example.com"
studentImage: [file]
```

**Update Student**
```http
PUT /adminRoute/studentparent/:studentId
Authorization: Bearer <token>
```

**Delete Student**
```http
DELETE /adminRoute/studentparent/:studentId
Authorization: Bearer <token>
```

#### Teacher Management

**Get All Teachers**
```http
GET /adminRoute/teacher
Authorization: Bearer <token>
```

**Create Teacher**
```http
POST /adminRoute/teacher
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
```json
{
  "teacherName": "Teacher Name",
  "email": "teacher@example.com",
  "phoneNumber": "1234567890",
  "subject": "Mathematics",
  "qualification": "M.Sc Mathematics",
  "experience": "5 years",
  "salary": 50000,
  "joiningDate": "2024-01-01",
  "address": "Teacher Address"
}
```

#### Class Management

**Get All Classes**
```http
GET /adminRoute/class
Authorization: Bearer <token>
```

**Create Class**
```http
POST /adminRoute/class
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "className": "10",
  "section": "A",
  "classTeacher": "teacher_id",
  "subjects": ["Mathematics", "Science", "English"],
  "maxStudents": 40
}
```

### Fee Management Routes (`/fees`)

**Get Fee Status**
```http
GET /fees/getFeeStatus
Authorization: Bearer <token>
Query Parameters:
- class: string (optional)
- section: string (optional)
- month: string (optional)
- year: string (optional)
```

**Create Fee Payment**
```http
POST /fees/createOrUpdateFeePayment
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "studentId": "student_id",
  "month": "January",
  "year": "2024",
  "tuitionFee": 5000,
  "transportFee": 1000,
  "examFee": 500,
  "otherFees": 200,
  "totalAmount": 6700,
  "paidAmount": 6700,
  "paymentMethod": "Cash|Online|Cheque",
  "paymentDate": "2024-01-15",
  "remarks": "Full payment"
}
```

**Get Fee History**
```http
GET /fees/getFeeHistory
Authorization: Bearer <token>
Query Parameters:
- studentId: string
- startDate: string (YYYY-MM-DD)
- endDate: string (YYYY-MM-DD)
```

### Exam Management Routes (`/exam`)

**Create Exam**
```http
POST /exam/exams
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "examName": "Mid Term Exam",
  "examType": "Internal|External",
  "class": "10",
  "section": "A",
  "subjects": [
    {
      "subjectName": "Mathematics",
      "maxMarks": 100,
      "examDate": "2024-03-15",
      "duration": "3 hours"
    }
  ],
  "startDate": "2024-03-15",
  "endDate": "2024-03-20"
}
```

**Get Exams**
```http
GET /exam/exams
Authorization: Bearer <token>
Query Parameters:
- class: string (optional)
- section: string (optional)
- examType: string (optional)
```

**Submit Exam Results**
```http
POST /exam/exams/:examId/results
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "studentId": "student_id",
  "marks": [
    {
      "subjectName": "Mathematics",
      "marksObtained": 85,
      "maxMarks": 100,
      "grade": "A"
    }
  ]
}
```

### Teacher Routes (`/teacher`)

**Create Study Material**
```http
POST /teacher/createStudyMaterial
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:**
```
title: "Chapter 1 - Algebra"
description: "Basic algebra concepts"
subject: "Mathematics"
class: "10"
section: "A"
file: [file]
```

**Get Study Materials**
```http
GET /teacher/getStudyMaterial
Authorization: Bearer <token>
Query Parameters:
- class: string (optional)
- section: string (optional)
- subject: string (optional)
```

**Create Attendance**
```http
POST /teacher/createAttendance
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "class": "10",
  "section": "A",
  "date": "2024-01-15",
  "attendance": [
    {
      "studentId": "student_id",
      "status": "Present|Absent|Late"
    }
  ]
}
```

### Third Party Routes (`/thirdparty`)

**Create Admission**
```http
POST /thirdparty/admissions
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Get Students by School**
```http
GET /thirdparty/schools/students
Authorization: Bearer <token>
Query Parameters:
- schoolId: string
- class: string (optional)
- section: string (optional)
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information (in development mode)"
}
```

## Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API requests are rate-limited to prevent abuse. Current limits:
- 100 requests per minute per IP
- 1000 requests per hour per authenticated user

## Data Validation

All endpoints validate input data. Common validation rules:
- Email addresses must be valid format
- Phone numbers must be 10 digits
- Dates must be in YYYY-MM-DD format
- Required fields cannot be empty
- File uploads limited to 10MB

## Session Management

The API uses session-based data filtering. All data is automatically filtered by the academic session (e.g., "2024-25") extracted from the JWT token.

## File Upload Guidelines

- Supported formats: JPG, PNG, PDF, DOC, DOCX
- Maximum file size: 10MB
- Files are stored securely with unique identifiers
- Image files are automatically optimized

## Pagination

List endpoints support pagination:

```http
GET /endpoint?page=1&limit=10&sortBy=createdAt&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 10
  }
}
```

## Additional API Endpoints

### Inventory Management (`/inventory`)

**Get All Items**
```http
GET /adminRoute/items
Authorization: Bearer <token>
```

**Create Item**
```http
POST /adminRoute/items
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "itemName": "Notebook",
  "category": "Stationery",
  "quantity": 100,
  "unitPrice": 25,
  "supplier": "ABC Suppliers",
  "minimumStock": 10
}
```

**Create Sale**
```http
POST /adminRoute/sales
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "items": [
    {
      "itemId": "item_id",
      "quantity": 5,
      "unitPrice": 25
    }
  ],
  "customerType": "Student|Teacher|External",
  "customerId": "customer_id",
  "totalAmount": 125,
  "paymentMethod": "Cash|Online"
}
```

### Event Management (`/events`)

**Create Event**
```http
POST /events/createEvent
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "eventName": "Annual Sports Day",
  "eventDate": "2024-12-15",
  "eventTime": "09:00",
  "venue": "School Ground",
  "description": "Annual sports competition",
  "targetAudience": "All Students",
  "organizer": "Sports Department"
}
```

**Get All Events**
```http
GET /events/getAllEvents
Authorization: Bearer <token>
```

### Employee Management (`/employee`)

**Create Salary Payment**
```http
POST /employee/salaryPay
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "employeeId": "employee_id",
  "month": "January",
  "year": "2024",
  "basicSalary": 50000,
  "allowances": 5000,
  "deductions": 2000,
  "netSalary": 53000,
  "paymentDate": "2024-01-31",
  "paymentMethod": "Bank Transfer"
}
```

### Results Management (`/results`)

**Create Results**
```http
POST /results/createResults
Authorization: Bearer <token>
```

**Upload Bulk Results**
```http
POST /results/uploadResults
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Generate Report Cards**
```http
GET /results/generateBulkReportCards
Authorization: Bearer <token>
Query Parameters:
- examId: string
- class: string
- section: string
```

### Super Admin Routes (`/superAdmin`)

**Get All Schools**
```http
GET /superAdmin/schools
Authorization: Bearer <token>
```

**Create School**
```http
POST /superAdmin/schools
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "schoolName": "ABC Public School",
  "address": "School Address",
  "phoneNumber": "1234567890",
  "email": "school@example.com",
  "principalName": "Principal Name",
  "affiliationNumber": "AFF123456",
  "boardType": "CBSE|ICSE|State Board"
}
```

## WebSocket Events

The API supports real-time updates through WebSocket connections:

### Connection
```javascript
const socket = io('wss://api.digitalvidyasaarthi.in', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Events
- `attendance_updated` - Real-time attendance updates
- `fee_payment_received` - Fee payment notifications
- `new_notice` - New notice announcements
- `exam_result_published` - Exam result notifications

## API Testing

### Using cURL
```bash
# Login
curl -X POST https://api.digitalvidyasaarthi.in/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.com","password":"password","role":"admin"}'

# Get students with token
curl -X GET https://api.digitalvidyasaarthi.in/adminRoute/studentparent \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Postman
1. Import the API collection (available in `/docs/postman_collection.json`)
2. Set environment variables for base URL and token
3. Use the pre-configured requests

## Changelog

### Version 2.0.0 (Current)
- Added super admin functionality
- Enhanced third-party integrations
- Improved authentication system
- Added inventory management
- Real-time notifications

### Version 1.5.0
- Added exam management system
- Enhanced fee management
- Added bulk operations
- Improved file upload handling

## 2. Teacher Routes (`/teacher`)

### Study Material Management

#### Create Study Material
```http
POST /teacher/createStudyMaterial
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Get Study Materials
```http
GET /teacher/getStudyMaterial
Authorization: Bearer <token>
```

#### Delete Study Material
```http
DELETE /teacher/deleteStudyMaterial/:studyId
Authorization: Bearer <token>
```

### Attendance Management

#### Create Attendance
```http
POST /teacher/createAttendance
Authorization: Bearer <token>
```

#### Get Attendance by Month
```http
GET /teacher/getAttendance
Authorization: Bearer <token>
```

#### Get Student Attendance
```http
GET /teacher/getAttendanceForStudent
Authorization: Bearer <token>
```

### Salary Management

#### Create Salary Payment
```http
POST /teacher/salaryPay
Authorization: Bearer <token>
```

#### Get Payment History
```http
GET /teacher/getPaymentHistory
Authorization: Bearer <token>
```

## 3. Exam Routes (`/exam`)

### Exam Management

#### Create Exam
```http
POST /exam/exams
Authorization: Bearer <token>
```

#### Get All Exams
```http
GET /exam/exams
Authorization: Bearer <token>
```

#### Update Exam
```http
PUT /exam/exams/:id
Authorization: Bearer <token>
```

#### Delete Exam
```http
DELETE /exam/exams/:id
Authorization: Bearer <token>
```

#### Submit Exam Results
```http
POST /exam/exams/:id/results
Authorization: Bearer <token>
```

#### Generate Report Card
```http
GET /exam/exams/:examId/students/:studentId/report-card
Authorization: Bearer <token>
```

#### Get Exam Analytics
```http
GET /exam/results/:id/analytics
Authorization: Bearer <token>
```

#### Generate Full Report Card
```http
GET /exam/results/:studentId/report
Authorization: Bearer <token>
```

#### Update Report Card
```http
PUT /exam/results/:studentId/report
Authorization: Bearer <token>
```

#### Generate Class Report
```http
GET /exam/results/class-report
Authorization: Bearer <token>
```

#### Get Performance Analytics
```http
GET /exam/performance
Authorization: Bearer <token>
```

## 4. Marks Routes (`/marks`)

### Marks Management

#### Add Mark
```http
POST /marks/marks
Authorization: Bearer <token>
```

#### Get Marks
```http
GET /marks/marks
Authorization: Bearer <token>
```

#### Update Mark
```http
PUT /marks/marks/:id
Authorization: Bearer <token>
```

#### Delete Mark
```http
DELETE /marks/marks/:id
Authorization: Bearer <token>
```

#### Bulk Upload Marks
```http
POST /marks/marksbulkupload
Authorization: Bearer <token>
```

#### Bulk Update Marks
```http
PUT /marks/marksbulkupload
Authorization: Bearer <token>
```

## 5. Results Routes (`/results`)

### Results Management

#### Create Results
```http
POST /results/createResults
Authorization: Bearer <token>
```

#### Get Results
```http
GET /results/getResults
Authorization: Bearer <token>
```

#### Update Result
```http
PUT /results/updateResult
Authorization: Bearer <token>
```

#### Download Template
```http
GET /results/downloadTemplate
Authorization: Bearer <token>
```

#### Upload Results
```http
POST /results/uploadResults
Authorization: Bearer <token>
```

#### Generate Bulk Report Cards
```http
GET /results/generateBulkReportCards
Authorization: Bearer <token>
```

## 6. Super Admin Routes (`/superAdmin`)

### Admin Management

#### Login Super Admin
```http
POST /superAdmin/loginSuperAdmin
```

#### Create Admin
```http
POST /superAdmin/createAdmin
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Get Admins by Super Admin
```http
GET /superAdmin/getAdmins/:superAdminId
Authorization: Bearer <token>
```

#### Update Admin
```http
PUT /superAdmin/updateAdmin/:adminId/:superAdminId
Authorization: Bearer <token>
```

### Third Party Management

#### Create Third Party User
```http
POST /superAdmin/createThirdParty
Authorization: Bearer <token>
```

#### Get Third Party Users
```http
GET /superAdmin/thirdparty/:superAdminId
Authorization: Bearer <token>
```

#### Update Third Party User
```http
PUT /superAdmin/thirdparty/:userId/:superAdminId
Authorization: Bearer <token>
```

#### Delete Third Party User
```http
DELETE /superAdmin/thirdparty/:userId/:superAdminId
Authorization: Bearer <token>
```

### Receptionist Management

#### Create Receptionist
```http
POST /superAdmin/createReceptionist
Authorization: Bearer <token>
```

#### Get All Receptionists
```http
GET /superAdmin/receptionists/:superAdminId
Authorization: Bearer <token>
```

## 7. Time Table Routes (`/timeTable`)

### Time Table Management

#### Create Class Time Table
```http
POST /timeTable/createClassTimeTable
Authorization: Bearer <token>
```

#### Get Class Time Table
```http
GET /timeTable/getClassTimeTable
Authorization: Bearer <token>
```

#### Update Class Time Table
```http
PUT /timeTable/updateClassTimeTable
Authorization: Bearer <token>
```

#### Delete Class Time Table
```http
DELETE /timeTable/deleteClassTimeTable/:timeTableId
Authorization: Bearer <token>
```

## 8. Third Party Routes (`/thirdparty`)

### Admission Management

#### Create Admission
```http
POST /thirdparty/admissions
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Edit Admission
```http
PUT /thirdparty/admissions/:studentId
Authorization: Bearer <token>
```

#### Get All Students for Third Party
```http
GET /thirdparty/admissions
Authorization: Bearer <token>
```

#### Get Students Unified
```http
GET /thirdparty/scholars
Authorization: Bearer <token>
```

### School Management

#### Get Students by School
```http
GET /thirdparty/schools/students
Authorization: Bearer <token>
```

#### Get Students by Class Section
```http
GET /thirdparty/schools/students/filter
Authorization: Bearer <token>
```

## 9. Receptionist Routes (`/receptionist`)

### Registration Management

#### Create Registration
```http
POST /receptionist/registrations
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

#### Edit Registration
```http
PUT /receptionist/registrations/:registrationId
Authorization: Bearer <token>
```

#### Get All Registrations
```http
GET /receptionist/registrations
Authorization: Bearer <token>
```

#### Get Registrations by School
```http
GET /receptionist/registrations/school
Authorization: Bearer <token>
```

#### Get Registrations by Class Section
```http
GET /receptionist/registrations/filter
Authorization: Bearer <token>
```

#### Get My Registrations
```http
GET /receptionist/my-registrations
Authorization: Bearer <token>
```

## Error Handling

All API endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API requests are rate-limited to prevent abuse:
- 100 requests per minute per IP address
- 1000 requests per hour per authenticated user

## Data Validation

All endpoints validate input data and return detailed validation errors:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## Support

For API support and questions:
- Email: support@digitalvidyasaarthi.in
- Documentation: https://docs.digitalvidyasaarthi.in
- GitHub Issues: https://github.com/digitalvidyasaarthi/issues
