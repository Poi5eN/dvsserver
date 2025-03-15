const ClassTimeTableModel = require("../models/classTimeTableModel");

exports.createClassTimeTable = async (req, res) => {
    try {

        const { monday, tuesday, wednesday, thursday, friday, saturday } = req.body;

        if (!monday || !tuesday || !wednesday || !thursday || !friday || !saturday) {
            return res.status(400).json({
                success: false,
                message: "Record not found"
            })
        }

        const existTimeTable = await ClassTimeTableModel.findOne({
            "schoolId": req.user.schoolId,
            "className": req.user.classTeacher,
            "section": req.user.section
        })

        if (existTimeTable) {
            return res.status(400).json({
                success: false,
                message: "Time Table of that class and section is already created"
            })
        }

        const timeTable = await ClassTimeTableModel.create({
            schoolId: req.user.schoolId,
            className: req.user.classTeacher,
            section: req.user.section,
            monday,
            tuesday,
            wednesday,
            thursday,
            friday,
            saturday
        })

        res.status(201).json({
            success: true,
            message: "Time Table of Class is created",
            timeTable
        })

    }
    catch(error) {
        res.status(500).json({
            success: false,
            message: "Class Time Table is not Created",
            error: error.message
        })
    }
}

exports.deleteClassTimeTable = async (req, res) => {
    try {

        const {timeTableId} = req.params;

        const existTimeTable = await ClassTimeTableModel.findById(timeTableId);

        if (!existTimeTable) {
            return res.status(404).json({
                success: false,
                message: "Time Table is not found"
            })
        }

        const deleteTimeTable = await existTimeTable.deleteOne();

        res.status(200).json({
            success: true,
            message: "Time Table is Successfully Deleted",
            deleteTimeTable
        })

    }
    catch(error) {
        res.status(500).json({
            success: false,
            message: "Class Time Table is not deleted Successfully",
            error: error.message
        })
    }
}

exports.getClassTimeTable = async (req, res) => {
    try {

        const {className, section} = req.query;

        const filter = {
            ...( className ? {className: className} : {} ),
            ...( section ? {section: section} : {} )
        }

        const timeTable = await ClassTimeTableModel.find({ schoolId: req.user.schoolId, ...filter });

        res.status(200).json({
            success: true,
            message: "Class Time Table is Successfully Get",
            timeTable
        })

    }
    catch(error) {

        res.status(500).json({
            success: false,
            message: "Class Time Table is not fetch successfully",
            error: error.message
        })

    }
}

exports.updateClassTimeTable = async (req, res) => {
    try {

        const { ...timeTableFields } = req.body;

        const existTimeTable = await ClassTimeTableModel.findOne({ 
            className: req.user.classTeacher, 
            section: req.user.section, 
            schoolId: req.user.schoolId 
        });

        
        if (!existTimeTable) {
            return res.status(404).json({
                success: false,
                message: "Time Table is not Exist of that class and section"
            })
        }

        for (const key in timeTableFields) {
            existTimeTable[key] = timeTableFields[key];
        }

        const updatedTimeTable = await existTimeTable.save();

        res.status(200).json({
            success: true,
            message: "Time Table is updated Successfully",
            updatedTimeTable
        })

    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Update not done due to error",
            error: error.message
        })
    }
}

// exports.createClassTimeTable = async (req, res) => {
//     try {

//         const { days } = req.body;

//         if (!days) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Record not found"
//             })
//         }

//         const existTimeTable = await ClassTimeTableModel.findOne({
//             "schoolId": req.user.schoolId,
//             "className": req.user.classTeacher,
//             "section": req.body.section
//         })

//         if (existTimeTable) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Time Table of that class and section is already created"
//             })
//         }

//         const timeTable = await ClassTimeTableModel.create({
//             schoolId: req.user.schoolId,
//             className: req.user.classTeacher,
//             section: req.user.section,
//             days
//         })

//         res.status(201).json({
//             success: true,
//             message: "Time Table of Class is created",
//             timeTable
//         })

//     }
//     catch(error) {
//         res.status(500).json({
//             success: false,
//             message: "Class Time Table is not Created",
//             error: error.message
//         })
//     }
// }