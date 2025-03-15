const Collection = require('../models/studentAdmissionModel')

exports.submitAdmissionForm = async (req, res) => {
    try {
      const {
        fullName,
        dateOfBirth,
        gender,
        address,
        parentName,
        parentPhone,
        previousSchool,
        grade,
        academicHistory,
        extracurricularActivities,
        medicalHistory,
        emergencyContact,
        // ... other form fields
      } = req.body;
  
      const admissionData = {
        fullName,
        dateOfBirth,
        gender,
        address,
        parentName,
        parentPhone,
        previousSchool,
        grade,
        academicHistory,
        extracurricularActivities,
        medicalHistory,
        emergencyContact,
        // ... other form fields
      };
  
      // Create a new student admission instance
      const studentAdmission = new Collection(admissionData);
  
      // Save the admission data to the database
      const savedAdmission = await studentAdmission.save();
  
      res.status(201).json({
        success:true,
        message: 'Student Admission Done Successfully'
      }); 
    } catch (error) {
      res.status(500).json({ message: 'Error submitting admission form', error: error.message });
    }
  };