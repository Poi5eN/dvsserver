const AdminInfo = require("../models/adminModel");
const EmployeeModel = require("../models/employeeModel");
const NewStudentModel = require("../models/newStudentModel");
const ParentModel = require("../models/parentModel");
const Teacher = require("../models/teacherModel");
const ThirdPartyUser = require("../models/thirdPartyModel");
const ReceptionistModel = require("../models/receptionistModel");
const { verifyPassword, createToken, setTokenCookie } = require("./authController");

const nameOfModel = (role) => {
  let model;
  switch (role) {
    case "admin":
      model = AdminInfo;
      break;
    case "parent":
      model = ParentModel;
      break;
    case "employee":
      model = EmployeeModel;
      break;
    case "student":
      model = NewStudentModel;
      break;
    case "teacher":
      model = Teacher;
      break;
    case "thirdparty":
      model = ThirdPartyUser;
      break;
    case "receptionist":
      model = ReceptionistModel;
      break;
    default:
      model = null;
      break;
  }
  return model;
};

exports.loginAll = async (req, res, next) => {
  try {
    let { email, password, role, session } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, password, and role",
      });
    }

    if (role === "admin" && !session) {
      return res.status(400).json({
        success: false,
        message: "Please provide a session for admin users",
      });
    }

    if (!session && role !== "admin") {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;

      if (currentMonth < 4) {
        session = `${currentYear - 1}-${currentYear}`;
      } else {
        session = `${currentYear}-${currentYear + 1}`;
      }
    }

    console.log("session", session);

    const Collection = nameOfModel(role);

    if (!Collection) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    const user = await Collection.findOne({ email }).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.status === "inactive" || user.status === "deactivated") {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact DigitalVidyaSaarthi.",
      });
    }

    const isMatch = await verifyPassword(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email and Password are not valid",
      });
    }

    // Fetch school details based on schoolId or assignedSchools
    let schoolDetails = {};
    if (user.schoolId) {
      // For roles with a single schoolId (admin, teacher, parent, student, etc.)
      const adminInfo = await AdminInfo.findOne({ schoolId: user.schoolId }).select(
        "schoolName schoolId image.url"
      );
      if (adminInfo) {
        schoolDetails = {
          schoolId: adminInfo.schoolId,
          schoolName: adminInfo.schoolName,
          schoolImageUrl: adminInfo.image?.url || "",
        };
      }
    } else if (user.assignedSchools && user.assignedSchools.length > 0) {
      // For thirdparty users with multiple assigned schools
      schoolDetails = await Promise.all(
        user.assignedSchools.map(async (school) => {
          const adminInfo = await AdminInfo.findOne({ schoolId: school.schoolId }).select(
            "schoolName schoolId image.url"
          );
          return {
            schoolId: adminInfo?.schoolId || school.schoolId,
            schoolName: adminInfo?.schoolName || school.schoolName,
            schoolImageUrl: adminInfo?.image?.url || "",
          };
        })
      );
    }

    const token = await createToken({ ...user.toObject(), session });
    setTokenCookie(req, res, token);

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json({
      success: true,
      message: "Login Successfully",
      user: userResponse,
      token,
      session,
      schoolDetails: user.schoolId || user.assignedSchools?.length > 0 ? schoolDetails : undefined,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.logout = (req, res, next) => {
  try {
    res
      .cookie("token", null, {
        httpOnly: true,
        expires: new Date(Date.now()),
      })
      .status(200)
      .json({
        success: true,
        message: "Logout Successfully",
      });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
    });
  }
};