const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const NewStudentModel = require("./models/newStudentModel"); // Adjust the path to your model file

async function updateStudentsWithUUID() {
  try {
    // Connect to your MongoDB database
    await mongoose.connect("mongodb://admin:digividya@147.93.106.220:27017/DigitalVidyaSaarthi?authSource=admin", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Define the specific schoolId
    const targetSchoolId = "bed37754-5d10-40c6-8799-daa00f6600a2";

    // Find all students without a studentId for the specific schoolId
    const studentsWithoutId = await NewStudentModel.find({
      schoolId: targetSchoolId,
      studentId: { $exists: false },
    });

    console.log(`Found ${studentsWithoutId.length} students without studentId for schoolId: ${targetSchoolId}`);

    // Update each student with a new UUID
    for (const student of studentsWithoutId) {
      const newUUID = uuidv4();
      await NewStudentModel.updateOne(
        { _id: student._id },
        { $set: { studentId: newUUID } }
      );
      console.log(`Updated student with _id: ${student._id} - New studentId: ${newUUID}`);
    }

    console.log("All students updated successfully!");
  } catch (error) {
    console.error("Error updating students:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

updateStudentsWithUUID();