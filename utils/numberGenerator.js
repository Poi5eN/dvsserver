const AdminInfo = require('../models/adminModel'); // Adjust path as needed

const generateStructuredNumber = async (schoolId, Model, fieldName) => {
  try {
    // Fetch schoolName from AdminInfo based on schoolId
    const adminInfo = await AdminInfo.findOne({ schoolId });
    if (!adminInfo || !adminInfo.schoolName) {
      throw new Error("School information not found or schoolName is missing.");
    }

    // Get the first two letters of schoolName in uppercase
    const schoolPrefix = adminInfo.schoolName.slice(0, 2).toUpperCase();

    // Use aggregation to find the highest feeReceiptNumber across all feeHistory entries
    const latestRecord = await Model.aggregate([
      { $match: { schoolId } },
      { $unwind: `$${fieldName}` }, // Unwind the feeHistory array
      { $match: { [fieldName]: { $regex: new RegExp(`^${schoolPrefix}\\d{4}$`) } } }, // Match format like DI1000
      { $sort: { [fieldName]: -1 } }, // Sort descending
      { $limit: 1 }, // Get the latest one
      { $project: { [fieldName]: 1 } },
    ]);

    let nextNumber = 1000; // Default starting number
    if (latestRecord.length > 0 && latestRecord[0][fieldName]) {
      const lastNumberStr = latestRecord[0][fieldName].slice(2); // Extract numeric part (e.g., "DI1000" -> "1000")
      const lastNumber = parseInt(lastNumberStr, 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      } else {
        throw new Error(`Invalid numeric part in ${fieldName}: ${latestRecord[0][fieldName]}`);
      }
    }

    // Generate the new number
    const newNumber = `${schoolPrefix}${nextNumber}`;
    return newNumber;
  } catch (error) {
    throw new Error(`Failed to generate number: ${error.message}`);
  }
};

module.exports = { generateStructuredNumber };