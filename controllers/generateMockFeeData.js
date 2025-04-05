const mongoose = require("mongoose");
const NewStudentModel = require("../models/newStudentModel");
const FeeStatus = require("../models/feeStatus");
const FeeStructure = require("../models/feeStructureModel");

// Connect to MongoDB (update with your connection string)
mongoose.connect("mongodb://admin:digividya@147.93.106.220:27017/DigitalVidyaSaarthi?authSource=admin", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const schoolId = "dad9e8ba-e50c-4f10-ad7d-de75bffa4b51";
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
      studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
      class: "5",
      studentName: "Arjun Sharma",
      parentId: "bbd2dec9-0238-4b09-b0ca-512daed93ba8",
    },
    {
      schoolId,
      studentId: "5e42e521-6301-4cf0-8d69-379a9795c2b8",
      class: "4",
      studentName: "Priya Patel",
      parentId: "3ff12332-6a0f-455c-9867-3a8b6597605e",
    },
    {
      schoolId,
      studentId: "e8c7058f-334b-4814-ac3b-c483d8b07626",
      class: "6",
      studentName: "Rohan Gupta",
      parentId: "0f03a9b6-03bb-492e-858f-04cc135e82f4",
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
      className: "5",
      amount: 5000, // Regular monthly fee
      additional: false,
    },
    {
      schoolId,
      className: "5",
      name: "Transport Fee",
      amount: 1000,
      additional: true,
      feeType: "Transport",
    },
    {
      schoolId,
      className: "5",
      name: "Library Fee",
      amount: 500,
      additional: true,
      feeType: "Library",
    },
    {
      schoolId,
      className: "5",
      amount: 200,
      lateFineDueDay: 10,
      additional: true,
      feeType: "LateFine",
    },
    // Fee structure for Class 6
    {
      schoolId,
      className: "4",
      amount: 6000,
      additional: false,
    },
    {
      schoolId,
      className: "4",
      name: "Lab Fee",
      amount: 800,
      additional: true,
      feeType: "Lab",
    },
    {
      schoolId,
      className: "4",
      amount: 250,
      lateFineDueDay: 15,
      additional: true,
      feeType: "LateFine",
    },
    // Fee structure for Class 7
    {
      schoolId,
      className: "6",
      amount: 7000,
      additional: false,
    },
    {
      schoolId,
      className: "6",
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
      studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
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
      studentId: "5e42e521-6301-4cf0-8d69-379a9795c2b8",
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
      studentId: "e8c7058f-334b-4814-ac3b-c483d8b07626",
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