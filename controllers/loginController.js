const AdminInfo = require("../models/adminModel.js");
const EmployeeModel = require("../models/employeeModel.js");
const NewStudentModel = require("../models/newStudentModel.js");
const ParentModel = require("../models/parentModel.js");
const Teacher = require("../models/teacherModel.js");
const ThirdPartyUser = require("../models/thirdPartyModel");
const ReceptionistModel = require('../models/receptionistModel');
const { verifyPassword, createToken, setTokenCookie } = require("./authController.js");

const nameOfModel = (role) => {
    let model;

    switch(role) {
        case "admin": model = AdminInfo; break;
        case "parent": model = ParentModel; break;
        case "employee": model = EmployeeModel; break;
        case "student": model = NewStudentModel; break;
        case "teacher": model = Teacher; break;
        case "thirdparty": model = ThirdPartyUser; break;
        case "receptionist": model = ReceptionistModel; break;
        default: model = null; break;
    }

    return model;
}

// Update loginAll function in loginController.js
// exports.loginAll = async (req, res, next) => {
//     try {
//         let { email, password, role, session} = req.body;

//         if (!email || !password || !role || !session) {
//             return res.status(400).json({
//               success: false,
//               message: "Please provide email, password, role, and session"
//             });
//           }
          

//          // If session is not provided, determine the session dynamically based on the current date
//         //  if (!session) {
//         //     const currentDate = new Date();
//         //     const currentYear = currentDate.getFullYear();
//         //     const currentMonth = currentDate.getMonth() + 1; // Months are 0-based in JavaScript

//         //     if (currentMonth < 4) {
//         //         // Before April (January, February, March), use the previous year as the start of the session
//         //         session = `${currentYear - 1}-${currentYear}`;
//         //     } else {
//         //         // April or later, use the current year as the start of the session
//         //         session = `${currentYear}-${currentYear + 1}`;
//         //     }
//         // }


//         console.log('session', session)
//         const Collection = nameOfModel(role);
        
//         if (!Collection) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid role specified"
//             });
//         }

//         // For third party users, we need to check if they're active
//         const user = await Collection.findOne({ email }).select("+password");
        
//         if (!user) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Invalid credentials"
//             });
//         }

//         // Additional check for third party users
//         if (role === 'thirdparty' && user.status === 'inactive') {
//             return res.status(403).json({
//                 success: false,
//                 message: "Your account has been deactivated. Please contact the administrator."
//             });
//         }

//         const isMatch = await verifyPassword(password, user.password);

//         if (!isMatch) {
//             return res.status(401).json({
//                 success: false,
//                 message: "Email and Password is not valid"
//             });
//         }

//         // const token = await createToken(user);
        
//         const token = await createToken({ ...user.toObject(), session });
//         setTokenCookie(req, res, token);
//         // res.cookie("token", token, { httpOnly: true });

//         // Remove password from response
//         const userResponse = user.toObject();
//         delete userResponse.password;

//         return res.status(200).json({
//             success: true,
//             message: "Login Successfully",
//             user: userResponse,
//             token,
//             session
//         });
//     } catch (err) {
//         res.status(500).json({
//             success: false,
//             message: err.message
//         });
//     }
// }
exports.loginAll = async (req, res, next) => {
    try {
        let { email, password, role, session } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Please provide email, password, and role"
            });
        }

        // For admin users, session is mandatory
        if (role === "admin" && !session) {
            return res.status(400).json({
                success: false,
                message: "Please provide a session for admin users"
            });
        }

        // If session is not provided for non-admin users, dynamically generate a session
        if (!session && role !== "admin") {
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1; // Months are 0-based in JavaScript

            if (currentMonth < 4) {
                // Before April (January, February, March), use the previous year as the start of the session
                session = `${currentYear - 1}-${currentYear}`;
            } else {
                // April or later, use the current year as the start of the session
                session = `${currentYear}-${currentYear + 1}`;
            }
        }

        console.log('session', session);

        // Look up the correct model based on the role
        const Collection = nameOfModel(role);

        if (!Collection) {
            return res.status(400).json({
                success: false,
                message: "Invalid role specified"
            });
        }

        // Find the user in the specified collection
        const user = await Collection.findOne({ email }).select("+password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // Check if the user's account is inactive (for all roles)
        if (user.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated. Please contact the DigitalVidyaSaarthi."
            });
        }

        // Verify password
        const isMatch = await verifyPassword(password, user.password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Email and Password is not valid"
            });
        }

        // Now that the user is authenticated, assign the session (admin or non-admin)
        const token = await createToken({ ...user.toObject(), session });
        setTokenCookie(req, res, token);

        // Remove password from response before sending back the user details
        const userResponse = user.toObject();
        delete userResponse.password;

        return res.status(200).json({
            success: true,
            message: "Login Successfully",
            user: userResponse,
            token,
            session
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}



exports.logout = (req, res, next) => {
    try {
        res.cookie("token", null, {
            httpOnly: true,
            expires: new Date(Date.now())
        }).status(200).json({
            success: true,
            message: "Logout Successfully"
        })
    }
    catch(error) {
        res.json({
            success: false,
            message: error.message
        })
    }
}
