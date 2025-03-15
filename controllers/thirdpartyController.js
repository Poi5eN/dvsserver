

// // Add these methods to thirdPartyController.js

// exports.getThirdPartyProfile = async (req, res) => {
//     try {
//         const user = await ThirdPartyUser.findOne({ userId: req.user.userId });
//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found"
//             });
//         }

//         res.status(200).json({
//             success: true,
//             user
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// exports.updateThirdPartyProfile = async (req, res) => {
//     try {
//         const { name, email } = req.body;
//         const user = await ThirdPartyUser.findOne({ userId: req.user.userId });

//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found"
//             });
//         }

//         if (email && email !== user.email) {
//             const emailExists = await ThirdPartyUser.findOne({ email });
//             if (emailExists) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Email already exists"
//                 });
//             }
//         }

//         user.name = name || user.name;
//         user.email = email || user.email;

//         await user.save();

//         res.status(200).json({
//             success: true,
//             message: "Profile updated successfully",
//             user
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// exports.getSchoolRegistrations = async (req, res) => {
//     try {
//         const { schoolId } = req.params;
//         const registrations = await NewRegistrationModel.find({ schoolId });

//         res.status(200).json({
//             success: true,
//             registrations
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// exports.getAssignedSchools = async (req, res) => {
//     try {
//         const user = await ThirdPartyUser.findOne({ userId: req.user.userId });
        
//         res.status(200).json({
//             success: true,
//             schools: user.assignedSchools
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// exports.getActivityLogs = async (req, res) => {
//     try {
//         const registrations = await NewRegistrationModel.find({
//             schoolId: { $in: req.user.assignedSchools.map(school => school.schoolId) }
//         }).sort({ createdAt: -1 }).limit(50);

//         res.status(200).json({
//             success: true,
//             activities: registrations
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// // Middleware to check if user is superadmin
// exports.isSuperAdmin = async (req, res, next) => {
//     try {
//         if (req.user.role !== 'superadmin') {
//             return res.status(403).json({
//                 success: false,
//                 message: "Access denied. Only superadmin can perform this action."
//             });
//         }
//         next();
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// exports.updateThirdPartyUser = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { name, email, assignedSchools } = req.body;

//         const user = await ThirdPartyUser.findOne({ userId });
//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found"
//             });
//         }

//         if (email && email !== user.email) {
//             const emailExists = await ThirdPartyUser.findOne({ email });
//             if (emailExists) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Email already exists"
//                 });
//             }
//         }

//         user.name = name || user.name;
//         user.email = email || user.email;
//         user.assignedSchools = assignedSchools || user.assignedSchools;

//         await user.save();

//         res.status(200).json({
//             success: true,
//             message: "User updated successfully",
//             user
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// exports.deactivateThirdPartyUser = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const user = await ThirdPartyUser.findOne({ userId });

//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "User not found"
//             });
//         }

//         user.status = 'inactive';
//         await user.save();

//         res.status(200).json({
//             success: true,
//             message: "User deactivated successfully"
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };

// exports.getAllThirdPartyUsers = async (req, res) => {
//     try {
//         const users = await ThirdPartyUser.find();
        
//         res.status(200).json({
//             success: true,
//             users
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: error.message
//         });
//     }
// };









const NewRegistrationModel = require('../models/newRegistrationModel');
const { generateRegistrationNumber } = require('../utils/helpers');
const sendEmail = require('../utils/email');

// Create Registration (Third-Party)
exports.createRegistration = async (req, res) => {
  try {
    const {
      schoolId,
      studentFullName,
      guardianName,
      registerClass,
      studentAddress,
      mobileNumber,
      studentEmail,
      gender,
      amount,
      // Additional fields:
      rollNo,
      admissionNo,
      fatherName,
      motherName,
      remarks,
      transport,
      studentPhoto,   // Converted to Base64 by our middleware
      motherPhoto,
      fatherPhoto,
      guardianPhoto
    } = req.body;

    // Verify if the third-party user has access to this school
    const hasAccess = req.user.assignedSchools.some(school => school.schoolId === schoolId);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to create registrations for this school"
      });
    }

    // Validate required fields (existing + additional)
    if (
      !studentFullName || !guardianName || !registerClass || !studentAddress ||
      !mobileNumber || !studentEmail || !gender || !amount ||
      !rollNo || !admissionNo || !fatherName || !motherName || !remarks ||
      !transport || !studentPhoto || !motherPhoto || !fatherPhoto || !guardianPhoto
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields"
      });
    }

    // Check for existing registration (using mobileNumber and schoolId)
    const existingRegistration = await NewRegistrationModel.findOne({ mobileNumber, schoolId });
    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: "Student already registered with this mobile number"
      });
    }

    // Generate a unique registration number
    const registrationNumber = await generateRegistrationNumber();

    // Create registration with all fields plus the createdBy field
    const registration = await NewRegistrationModel.create({
      schoolId,
      studentFullName,
      guardianName,
      registerClass,
      studentAddress,
      mobileNumber,
      studentEmail,
      gender,
      amount,
      rollNo,
      admissionNo,
      fatherName,
      motherName,
      remarks,
      transport,
      studentPhoto,    // Base64-encoded string
      motherPhoto,     
      fatherPhoto,     
      guardianPhoto,   
      registrationNumber,
      createdBy: req.user.userId, // Record the creator's ID
      userType: 'thirdparty'
    });

    // Optionally, send a confirmation email
    const emailContent = `
      <p>Thank you for registering with our school.</p>
      <p>Registration Details:</p>
      <p>Student Name: ${studentFullName}</p>
      <p>Class: ${registerClass}</p>
      <p>Registration Number: ${registrationNumber}</p>
    `;
    await sendEmail(studentEmail, "Registration Confirmation", emailContent);

    res.status(201).json({
      success: true,
      message: "Registration created successfully",
      registration
    });
  } catch (error) {
    console.error('Registration creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get All Registrations for Assigned Schools
exports.getAllRegistrations = async (req, res) => {
  try {
    const { schoolId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {
      schoolId: { $in: req.user.assignedSchools.map(school => school.schoolId) }
    };

    // If a specific schoolId is provided, verify access
    if (schoolId) {
      const hasAccess = req.user.assignedSchools.some(school => school.schoolId === schoolId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "You don't have access to this school's registrations"
        });
      }
      query.schoolId = schoolId;
    }

    const registrations = await NewRegistrationModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await NewRegistrationModel.countDocuments(query);

    res.status(200).json({
      success: true,
      registrations,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRegistrations: total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get Single Registration
exports.getRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const registration = await NewRegistrationModel.findById(registrationId);
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    // Verify access to the registration’s school
    const hasAccess = req.user.assignedSchools.some(
      school => school.schoolId === registration.schoolId
    );
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this registration"
      });
    }

    res.status(200).json({
      success: true,
      registration
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update Registration
exports.updateRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;
    const updateData = req.body;

    const registration = await NewRegistrationModel.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found"
      });
    }

    // Verify access
    const hasAccess = req.user.assignedSchools.some(
      school => school.schoolId === registration.schoolId
    );
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to update this registration"
      });
    }

    // Prevent updating immutable fields
    delete updateData.schoolId;
    delete updateData.registrationNumber;

    const updatedRegistration = await NewRegistrationModel.findByIdAndUpdate(
      registrationId,
      { 
        ...updateData,
        updatedBy: req.user.userId,
        lastUpdated: Date.now()
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Registration updated successfully",
      registration: updatedRegistration
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// Delete Registration
exports.deleteRegistration = async (req, res) => {
    try {
        const { registrationId } = req.params;
        
        const registration = await NewRegistrationModel.findById(registrationId);
        
        if (!registration) {
            return res.status(404).json({
                success: false,
                message: "Registration not found"
            });
        }

        // Verify access
        const hasAccess = req.user.assignedSchools.some(
            school => school.schoolId === registration.schoolId
        );

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "You don't have access to delete this registration"
            });
        }

        await registration.remove();

        res.status(200).json({
            success: true,
            message: "Registration deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};








/**
 * Fetch all registrations for the schools assigned to the third-party user.
 * Optionally, filter by a specific school ID provided as a query parameter.
 */
exports.getAllRegistrationsForThirdParty = async (req, res) => {
    try {
      // Get the list of assigned school IDs from req.user.
      // (Assuming req.user.assignedSchools is an array of objects with a schoolId property.)
      const assignedSchoolIds = req.user.assignedSchools.map(school => school.schoolId);
  
      // Check if the client provided a schoolId query parameter.
      let filterSchoolIds = assignedSchoolIds;
      if (req.query.schoolId) {
        const requestedSchoolId = req.query.schoolId;
        // Verify that the requested schoolId is in the assigned list.
        if (!assignedSchoolIds.includes(requestedSchoolId)) {
          return res.status(403).json({
            success: false,
            message: "You do not have access to this school."
          });
        }
        // Use only the requested school ID for filtering.
        filterSchoolIds = [requestedSchoolId];
      }
  
      // Find registrations whose schoolId is in the filterSchoolIds array.
      const registrations = await NewRegistrationModel.find({
        schoolId: { $in: filterSchoolIds }
      }).sort({ createdAt: -1 });
  
      return res.status(200).json({
        success: true,
        message: "Registrations fetched successfully.",
        data: registrations
      });
    } catch (error) {
      console.error("Error fetching registrations for third party:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch registrations due to an error.",
        error: error.message
      });
    }
  };
  


