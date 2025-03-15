const employeePayment = require("../models/employeePayment");
const teacherPayment = require("../models/teacherPayment");

exports.createSalaryPayment = async (req, res) => {
    try {
        const { employeeId, salaryHistory } = req.body;
        year=new Date().getFullYear().toString()
        const existingPayment = await employeePayment.findOne({
            schoolId: req.user.schoolId,
            employeeId,
            year: year,
        });
      
        if (existingPayment) {
            const existSameMonthData = existingPayment.salaryHistory.find((item) => {
                return item.month === salaryHistory[0].month;
            });
      
            if (existSameMonthData) {
                return res.status(400).json({
                success: false,
                message: "Salary of this month is already Paid"
                })
            }
        }
      

        if (existingPayment) {
  
            existingPayment.salaryHistory.push(...salaryHistory);
            const updatedPayment = await existingPayment.save();
            res.status(201).json({
                success: true,
                message: "Payment Saved Successfully",
                data: updatedPayment
            })
  
        } else {
              const newPayment = new employeePayment({ schoolId: req.user.schoolId, year: new Date().getFullYear().toString() ,...req.body });
            const savedPayment = await newPayment.save();
            res.status(201).json({
                success: true,
                message: "Payment Saved Successfully",
                data: savedPayment
            })
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Payment is not created Successfully",
            error: error.message
        })
    };
}
  
exports.getPayment = async (req, res) => {
    try {
  
        const { employeeId } = req.query;

        const filter = {
            ...(employeeId ? {employeeId: employeeId} : {})
        }

        
        const paymentData = await employeePayment.find({ schoolId: req.user.schoolId, ...filter });
  
        res.status(200).json({
            success: true,
            message: "Payment Data Get Successfully",
            data: paymentData
        })
  
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Payment Details are not getting Successfully",
            error: error.message
        })
  
    }
}


exports.salaryExpensesMonths = async (req, res) => {
    try {

        const employeeData = await employeePayment.find({ schoolId: req.user.schoolId });

        const teacherData = await teacherPayment.find({ schoolId: req.user.schoolId });

        let arr = new Array(12);

        for (let i=0; i<12; i++) arr[i] = 0;

        console.log("employeeData.length", employeeData.length)

        for (let j=0; j<employeeData.length; j++) {

            console.log("employeeData[j].salaryHistory.length", employeeData[j].salaryHistory.length)
            for (let k=0; k<employeeData[j].salaryHistory.length; k++) {

                console.log("employeeData[j].salaryHistory[k].paidAmount", employeeData[j].salaryHistory[k].paidAmount);
                arr[k] += Number(employeeData[j].salaryHistory[k].paidAmount);

            }

        }

        console.log(arr);

        console.log("teacherData.length", teacherData.length)

        for (let j=0; j<teacherData.length; j++) {

            console.log("teacherData[j].salaryHistory.length", teacherData[j].salaryHistory.length)
            for (let k=0; k<teacherData[j].salaryHistory.length; k++) {

                console.log("teacherData[j].salaryHistory[k].paidAmount", teacherData[j].salaryHistory[k].paidAmount);
                arr[k] += Number(teacherData[j].salaryHistory[k].paidAmount);
                
            }

        }

        console.log(arr);


        res.status(200).json({
            success: true,
            employeeData,
            teacherData,
            data: arr
        })
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Fee Income According to month is not get due to error",
            error: error.message
        })
    }
}