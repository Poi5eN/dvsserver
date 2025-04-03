const mongoose = require("mongoose");
const NewStudentModel = require("../models/newStudentModel");
const FeeStatus = require("../models/feeStatus");
const FeeStructure = require("../models/feeStructureModel");

// Connect to MongoDB (update with your connection string)
mongoose.connect("mongodb://localhost:27017/yourDatabase", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const schoolId = "school123";
const session = "2025-2026";
const months = [
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
];

// Generate mock students
const generateMockStudents = async () => {
  const students = [
    {
      schoolId,
      studentId: "STU001",
      class: "Class 5",
      studentName: "John Doe",
      parentId: "PAR001",
    },
    {
      schoolId,
      studentId: "STU002",
      class: "Class 6",
      studentName: "Jane Smith",
      parentId: "PAR002",
    },
    {
      schoolId,
      studentId: "STU003",
      class: "Class 7",
      studentName: "Alice Johnson",
      parentId: "PAR003",
    },
  ];

  await NewStudentModel.deleteMany({ schoolId });
  await NewStudentModel.insertMany(students);
  console.log("Mock students created:", students);
};

// Generate mock fee structures
const generateMockFeeStructures = async () => {
  const feeStructures = [
    // Fee structure for Class 5
    {
      schoolId,
      className: "Class 5",
      amount: 5000, // Regular monthly fee
      additional: false,
    },
    {
      schoolId,
      className: "Class 5",
      name: "Transport Fee",
      amount: 1000,
      additional: true,
      feeType: "Transport",
    },
    {
      schoolId,
      className: "Class 5",
      name: "Library Fee",
      amount: 500,
      additional: true,
      feeType: "Library",
    },
    {
      schoolId,
      className: "Class 5",
      amount: 200,
      lateFineDueDay: 10,
      additional: true,
      feeType: "LateFine",
    },
    // Fee structure for Class 6
    {
      schoolId,
      className: "Class 6",
      amount: 6000,
      additional: false,
    },
    {
      schoolId,
      className: "Class 6",
      name: "Lab Fee",
      amount: 800,
      additional: true,
      feeType: "Lab",
    },
    {
      schoolId,
      className: "Class 6",
      amount: 250,
      lateFineDueDay: 15,
      additional: true,
      feeType: "LateFine",
    },
    // Fee structure for Class 7
    {
      schoolId,
      className: "Class 7",
      amount: 7000,
      additional: false,
    },
    {
      schoolId,
      className: "Class 7",
      amount: 300,
      lateFineDueDay: 20,
      additional: true,
      feeType: "LateFine",
    },
  ];

  await FeeStructure.deleteMany({ schoolId });
  await FeeStructure.insertMany(feeStructures);
  console.log("Mock fee structures created:", feeStructures);
};

// Generate mock fee statuses with various scenarios
const generateMockFeeStatuses = async () => {
  const feeStatuses = [
    // Scenario 1: STU001 - Some months paid, some unpaid, with past dues and late fines
    {
      schoolId,
      studentId: "STU001",
      session,
      year: "2025",
      pastDues: 10000, // Past dues from previous session
      dues: 10000, // Initial dues = past dues
      totalLateFines: 0,
      lateFines: [],
      monthlyDues: {
        regularDues: [
          { month: "April", paidAmount: 5000, dueAmount: 0, status: "Paid" },
          {
            month: "May",
            paidAmount: 2000,
            dueAmount: 3000,
            status: "Partial Payment",
          },
          {
            month: "June",
            paidAmount: 0,
            dueAmount: 5000,
            status: "Unpaid",
          },
        ],
        additionalDues: [
          {
            name: "Transport Fee",
            month: "April",
            paidAmount: 1000,
            dueAmount: 0,
            status: "Paid",
          },
          {
            name: "Transport Fee",
            month: "May",
            paidAmount: 0,
            dueAmount: 1000,
            status: "Unpaid",
          },
          {
            name: "Library Fee",
            month: "April",
            paidAmount: 500,
            dueAmount: 0,
            status: "Paid",
          },
        ],
      },
      feeHistory: [],
    },
    // Scenario 2: STU002 - No payments made, all months unpaid, no past dues
    {
      schoolId,
      studentId: "STU002",
      session,
      year: "2025",
      pastDues: 0,
      dues: 0,
      totalLateFines: 0,
      lateFines: [],
      monthlyDues: {
        regularDues: months.map((month) => ({
          month,
          paidAmount: 0,
          dueAmount: 6000,
          status: "Unpaid",
        })),
        additionalDues: months.map((month) => ({
          name: "Lab Fee",
          month,
          paidAmount: 0,
          dueAmount: 800,
          status: "Unpaid",
        })),
      },
      feeHistory: [],
    },
    // Scenario 3: STU003 - All months paid, with past dues
    {
      schoolId,
      studentId: "STU003",
      session,
      year: "2025",
      pastDues: 5000,
      dues: 5000,
      totalLateFines: 0,
      lateFines: [],
      monthlyDues: {
        regularDues: months.map((month) => ({
          month,
          paidAmount: 7000,
          dueAmount: 0,
          status: "Paid",
        })),
        additionalDues: [],
      },
      feeHistory: [
        {
          date: new Date(),
          status: "active",
          regularFees: months.map((month) => ({
            month,
            paidAmount: 7000,
            dueAmount: 0,
            status: "Paid",
          })),
          additionalFees: [],
          lateFines: [],
          pastDuesPaid: 0,
          concessionApplied: 0,
          paymentMode: "Cash",
          transactionId: "N/A",
          totalFeeAmount: 7000 * 12,
          totalAmountPaid: 7000 * 12,
          totalDues: 5000,
          remark: "Initial payment",
          feeReceiptNumber: "FR001",
          paymentMessage: "Paid all regular fees",
          previousDues: 5000,
        },
      ],
    },
  ];

  await FeeStatus.deleteMany({ schoolId });
  await FeeStatus.insertMany(feeStatuses);
  console.log("Mock fee statuses created:", feeStatuses);
};

// Main function to generate all mock data
const generateAllMockData = async () => {
  try {
    await generateMockStudents();
    await generateMockFeeStructures();
    await generateMockFeeStatuses();
    console.log("All mock data generated successfully!");
    mongoose.connection.close();
  } catch (error) {
    console.error("Error generating mock data:", error);
    mongoose.connection.close();
  }
};

generateAllMockData();