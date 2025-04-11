const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");
const NewStudentModel = require("../models/newStudentModel");
const FeeStatus = require("../models/feeStatus");
const FeeStructure = require("../models/feeStructureModel");

// Mock the req.user object
const mockUser = { schoolId: "dad9e8ba-e50c-4f10-ad7d-de75bffa4b51" };

describe("createOrUpdateFeePayment Controller", () => {
  jest.setTimeout(10000); // Increase timeout for all tests

  let mongoServer;
  const schoolId = "dad9e8ba-e50c-4f10-ad7d-de75bffa4b51";
  const session = "2025-2026";
  const months = ["April", "May", "June"]; // Reduced for faster testing

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Mock the req.user middleware
    app.use((req, res, next) => {
      req.user = mockUser;
      next();
    });

    // Create mock data
    await NewStudentModel.insertMany([
      {
        schoolId,
        studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
        class: "5",
        studentName: "Arjun Sharma",
        parentId: "bbd2dec9-0238-4b09-b0ca-512daed93ba8",
        password: "dvs@student",
        email: "arjunsharma917@dvs.com",
        admissionNumber: "MY1001",
        joiningDate: "2025-01-01",
        session: "2025-2026",
      },
      {
        schoolId,
        studentId: "5e42e521-6301-4cf0-8d69-379a9795c2b8",
        class: "4",
        studentName: "Priya Patel",
        parentId: "3ff12332-6a0f-455c-9867-3a8b6597605e",
        password: "dvs@student",
        email: "priyapatel706@dvs.com",
        admissionNumber: "MY1002",
        joiningDate: "2025-01-01",
        session: "2025-2026",
      },
      {
        schoolId,
        studentId: "e8c7058f-334b-4814-ac3b-c483d8b07626",
        class: "6",
        studentName: "Rohan Gupta",
        parentId: "0f03a9b6-03bb-492e-858f-04cc135e82f4",
        password: "dvs@student",
        email: "rohangupta332@dvs.com",
        admissionNumber: "MY1003",
        joiningDate: "2025-01-01",
        session: "2025-2026",
      },
    ]);

    await FeeStructure.insertMany([
      {
        schoolId,
        className: "5",
        amount: 5000,
        additional: false,
        session: "2025-2026",
        feeType: "Monthly",
      },
      {
        schoolId,
        className: "5",
        name: "Transport Fee",
        amount: 1000,
        additional: true,
        feeType: "Transport",
        session: "2025-2026",
      },
      {
        schoolId,
        className: "5",
        name: "Library Fee",
        amount: 500,
        additional: true,
        feeType: "Library",
        session: "2025-2026",
      },
      {
        schoolId,
        className: "5",
        amount: 200,
        lateFineDueDay: 10,
        additional: true,
        feeType: "LateFine",
        session: "2025-2026",
      },
      {
        schoolId,
        className: "4",
        amount: 6000,
        additional: false,
        session: "2025-2026",
        feeType: "Monthly",
      },
      {
        schoolId,
        className: "4",
        name: "Lab Fee",
        amount: 800,
        additional: true,
        feeType: "Lab",
        session: "2025-2026",
      },
      {
        schoolId,
        className: "4",
        amount: 250,
        lateFineDueDay: 15,
        additional: true,
        feeType: "LateFine",
        session: "2025-2026",
      },
      {
        schoolId,
        className: "6",
        amount: 7000,
        additional: false,
        session: "2025-2026",
        feeType: "Monthly",
      },
      {
        schoolId,
        className: "6",
        amount: 300,
        lateFineDueDay: 20,
        additional: true,
        feeType: "LateFine",
        session: "2025-2026",
      },
    ]);

    await FeeStatus.insertMany([
      {
        schoolId,
        studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
        session,
        year: "2025",
        pastDues: 10000,
        dues: 10000,
        totalLateFines: 0,
        monthlyDues: {
          regularDues: [
            { month: "April", paidAmount: 5000, dueAmount: 0, status: "Paid" },
            {
              month: "May",
              paidAmount: 2000,
              dueAmount: 3000,
              status: "Partial",
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
      {
        schoolId,
        studentId: "5e42e521-6301-4cf0-8d69-379a9795c2b8",
        session,
        year: "2025",
        pastDues: 0,
        dues: 0,
        totalLateFines: 0,
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
      {
        schoolId,
        studentId: "e8c7058f-334b-4814-ac3b-c483d8b07626",
        session,
        year: "2025",
        pastDues: 5000,
        dues: 5000,
        totalLateFines: 0,
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
            pastDuesPaid: 0,
            concessionApplied: 0,
            paymentMode: "Cash",
            transactionId: "N/A",
            totalFeeAmount: 7000 * months.length,
            totalAmountPaid: 7000 * months.length,
            totalDues: 5000,
            remark: "Initial payment",
            feeReceiptNumber: "FR001",
            paymentMessage: "Paid all regular fees",
            previousDues: 5000,
          },
        ],
      },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await FeeStatus.updateMany({ schoolId }, { $set: { feeHistory: [] } });
  });

  it("should handle auto mode payment with past dues and late fines for STUbb015fc0-d8e7-4553-8756-b327df27a1c2001", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-07-15"));

    const payload = {
      studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
      session,
      mode: "auto",
      paymentDetails: {
        regularFees: [{ month: "May" }, { month: "June" }],
        additionalFees: [{ name: "Transport Fee", month: "May" }],
        totalAmount: 15000,
        paymentMode: "Cash",
        transactionId: "N/A",
        remark: "Test payment",
      },
    };

    const response = await request(app)
      .post("/api/v1/fees/createOrUpdateFeePayment")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const feeStatus = await FeeStatus.findOne({
      schoolId,
      studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
      session,
    });

    expect(feeStatus.feeHistory[0].lateFines.length).toBe(2);
    expect(feeStatus.totalLateFines).toBe(0);
    expect(feeStatus.pastDues).toBe(0);
    expect(feeStatus.feeHistory[0].pastDuesPaid).toBe(10000);

    const mayRegular = feeStatus.monthlyDues.regularDues.find(
      (d) => d.month === "May"
    );
    const juneRegular = feeStatus.monthlyDues.regularDues.find(
      (d) => d.month === "June"
    );
    expect(mayRegular.dueAmount).toBe(0);
    expect(juneRegular.dueAmount).toBe(0);

    const transportMay = feeStatus.monthlyDues.additionalDues.find(
      (d) => d.name === "Transport Fee" && d.month === "May"
    );
    expect(transportMay.dueAmount).toBe(0);

    expect(feeStatus.dues).toBe(0);
  });

  it("should handle auto mode Partial for 5e42e521-6301-4cf0-8d69-379a9795c2b8 with large amount", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-12-31"));

    const payload = {
      studentId: "5e42e521-6301-4cf0-8d69-379a9795c2b8",
      session,
      mode: "auto",
      paymentDetails: {
        regularFees: months.map((month) => ({ month })),
        additionalFees: months.map((month) => ({
          name: "Lab Fee",
          month,
        })),
        totalAmount: 50000,
        paymentMode: "Cash",
        transactionId: "N/A",
        remark: "Partial",
      },
    };

    const response = await request(app)
      .post("/api/v1/fees/createOrUpdateFeePayment")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const feeStatus = await FeeStatus.findOne({
      schoolId,
      studentId: "5e42e521-6301-4cf0-8d69-379a9795c2b8",
      session,
    });

    expect(feeStatus.feeHistory[0].lateFines.length).toBe(3); // Adjusted for 3 months
    expect(feeStatus.totalLateFines).toBe(0);
    expect(feeStatus.dues).toBe(0); // Adjusted for smaller dataset

    const paidMonths = feeStatus.monthlyDues.regularDues.filter(
      (d) => d.dueAmount === 0
    );
    expect(paidMonths.length).toBe(3); // All 3 months should be paid
  });

  it("should handle manual mode payment for STUbb015fc0-d8e7-4553-8756-b327df27a1c2001", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-07-15"));

    const payload = {
      studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
      session,
      mode: "manual",
      paymentDetails: {
        regularFees: [
          { month: "May", paidAmount: 2000 },
          { month: "June", paidAmount: 3000 },
        ],
        additionalFees: [
          { name: "Transport Fee", month: "May", paidAmount: 500 },
        ],
        pastDuesPaid: 5000,
        lateFinesPaid: 400,
        totalAmount: 10900,
        paymentMode: "Cash",
        transactionId: "N/A",
        remark: "Manual payment",
      },
    };

    const response = await request(app)
      .post("/api/v1/fees/createOrUpdateFeePayment")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const feeStatus = await FeeStatus.findOne({
      schoolId,
      studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
      session,
    });

    expect(feeStatus.totalLateFines).toBe(0);
    expect(feeStatus.pastDues).toBe(5000);

    const mayRegular = feeStatus.monthlyDues.regularDues.find(
      (d) => d.month === "May"
    );
    const juneRegular = feeStatus.monthlyDues.regularDues.find(
      (d) => d.month === "June"
    );
    expect(mayRegular.dueAmount).toBe(1000);
    expect(juneRegular.dueAmount).toBe(2000);

    const transportMay = feeStatus.monthlyDues.additionalDues.find(
      (d) => d.name === "Transport Fee" && d.month === "May"
    );
    expect(transportMay.dueAmount).toBe(500);

    expect(feeStatus.dues).toBe(8500);
  });

  it("should reject overpayment in manual mode for STUbb015fc0-d8e7-4553-8756-b327df27a1c2001", async () => {
    const payload = {
      studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
      session,
      mode: "manual",
      paymentDetails: {
        regularFees: [{ month: "May", paidAmount: 4000 }],
        totalAmount: 4000,
        paymentMode: "Cash",
      },
    };

    const response = await request(app)
      .post("/api/v1/fees/createOrUpdateFeePayment")
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("exceeds remaining dues");
  });

  it("should handle auto mode payment with concession for 5e42e521-6301-4cf0-8d69-379a9795c2b8", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-04-30"));

    const payload = {
      studentId: "5e42e521-6301-4cf0-8d69-379a9795c2b8",
      session,
      mode: "auto",
      paymentDetails: {
        regularFees: [{ month: "April" }],
        additionalFees: [{ name: "Lab Fee", month: "April" }],
        concession: 500,
        totalAmount: 6300,
        paymentMode: "Cash",
      },
    };

    const response = await request(app)
      .post("/api/v1/fees/createOrUpdateFeePayment")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const feeStatus = await FeeStatus.findOne({
      schoolId,
      studentId: "5e42e521-6301-4cf0-8d69-379a9795c2b8",
      session,
    });

    expect(feeStatus.totalLateFines).toBe(0);

    const aprilRegular = feeStatus.monthlyDues.regularDues.find(
      (d) => d.month === "April"
    );
    expect(aprilRegular.dueAmount).toBe(0);

    const labApril = feeStatus.monthlyDues.additionalDues.find(
      (d) => d.name === "Lab Fee" && d.month === "April"
    );
    expect(labApril.dueAmount).toBe(0);

    expect(feeStatus.dues).toBe(2 * 6000 + 2 * 800); // Adjusted for 2 remaining months
  });

  it("should handle zero payment for e8c7058f-334b-4814-ac3b-c483d8b07626", async () => {
    const payload = {
      studentId: "e8c7058f-334b-4814-ac3b-c483d8b07626",
      session,
      mode: "auto",
      paymentDetails: {
        regularFees: [],
        additionalFees: [],
        totalAmount: 0,
        paymentMode: "Cash",
      },
    };

    const response = await request(app)
      .post("/api/v1/fees/createOrUpdateFeePayment")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const feeStatus = await FeeStatus.findOne({
      schoolId,
      studentId: "e8c7058f-334b-4814-ac3b-c483d8b07626",
      session,
    });

    expect(feeStatus.dues).toBe(5000);
  });

  it("should reject request with missing required fields", async () => {
    const payload = {
      studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
      session,
      mode: "auto",
      paymentDetails: {
        regularFees: [{ month: "May" }],
      },
    };

    const response = await request(app)
      .post("/api/v1/fees/createOrUpdateFeePayment")
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("totalAmount are required");
  });

  it("should handle large payment covering all dues for 5e42e521-6301-4cf0-8d69-379a9795c2b8", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-12-31"));

    const payload = {
      studentId: "5e42e521-6301-4cf0-8d69-379a9795c2b8",
      session,
      mode: "auto",
      paymentDetails: {
        regularFees: months.map((month) => ({ month })),
        additionalFees: months.map((month) => ({
          name: "Lab Fee",
          month,
        })),
        totalAmount: 21750, // Adjusted for 3 months: (6000 * 3) + (800 * 3) + (250 * 3)
        paymentMode: "Cash",
      },
    };

    const response = await request(app)
      .post("/api/v1/fees/createOrUpdateFeePayment")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const feeStatus = await FeeStatus.findOne({
      schoolId,
      studentId: "5e42e521-6301-4cf0-8d69-379a9795c2b8",
      session,
    });

    expect(feeStatus.totalLateFines).toBe(0);
    expect(feeStatus.dues).toBe(0);
    expect(
      feeStatus.monthlyDues.regularDues.every((d) => d.dueAmount === 0)
    ).toBe(true);
    expect(
      feeStatus.monthlyDues.additionalDues.every((d) => d.dueAmount === 0)
    ).toBe(true);
  });

  it("should reject payment for non-existent student", async () => {
    const payload = {
      studentId: "STU999",
      session,
      mode: "auto",
      paymentDetails: {
        regularFees: [{ month: "April" }],
        totalAmount: 5000,
        paymentMode: "Cash",
      },
    };

    const response = await request(app)
      .post("/api/v1/fees/createOrUpdateFeePayment")
      .send(payload);

    console.log("Response body:", response.body); // Debug the response

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Student not found.");
  });

  it("should reject payment exceeding total dues for STUbb015fc0-d8e7-4553-8756-b327df27a1c2001", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2025-07-15"));

    const payload = {
      studentId: "STUbb015fc0-d8e7-4553-8756-b327df27a1c2001",
      session,
      mode: "auto",
      paymentDetails: {
        regularFees: [{ month: "May" }, { month: "June" }],
        additionalFees: [{ name: "Transport Fee", month: "May" }],
        totalAmount: 20000,
        paymentMode: "Cash",
      },
    };

    const response = await request(app)
      .post("/api/v1/fees/createOrUpdateFeePayment")
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("exceeds remaining dues");
  });

  afterEach(() => {
    jest.useRealTimers();
  });
});