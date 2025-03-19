const AdminInfo = require('../models/adminModel');

const generateStructuredNumber = async (schoolId, Model, fieldName = 'admissionNumber') => {
  try {
    console.log(`Generating structured number for schoolId: ${schoolId}, model: ${Model.modelName}, field: ${fieldName}`);

    // Fetch schoolName from AdminInfo based on schoolId
    const adminInfo = await AdminInfo.findOne({ schoolId });
    if (!adminInfo || !adminInfo.schoolName) {
      throw new Error("School information not found or schoolName is missing.");
    }

    // Get the first two letters of schoolName in uppercase
    const schoolPrefix = adminInfo.schoolName.slice(0, 2).toUpperCase();
    console.log(`School prefix: ${schoolPrefix}`);

    // Handle nested fields (e.g., feeHistory.feeReceiptNumber)
    const isNestedField = fieldName.includes('.');
    let nextNumber = 1000; // Default starting number

    if (isNestedField) {
      // For nested fields like feeHistory.feeReceiptNumber
      const [arrayField, subField] = fieldName.split('.'); // e.g., "feeHistory", "feeReceiptNumber"
      const pattern = new RegExp(`^${schoolPrefix}\\d{4}$`);

      // Use aggregation to unwind the array and find the highest number
      const latestRecord = await Model.aggregate([
        { $match: { schoolId } },
        { $unwind: `$${arrayField}` }, // Unwind the array (e.g., feeHistory)
        { $match: { [`${arrayField}.${subField}`]: pattern } }, // Match the pattern
        { $sort: { [`${arrayField}.${subField}`]: -1 } }, // Sort descending
        { $limit: 1 }, // Get the highest
        { $project: { number: `$${arrayField}.${subField}` } }
      ]);

      if (latestRecord.length > 0 && latestRecord[0].number) {
        const lastNumberStr = latestRecord[0].number.slice(2); // Extract numeric part
        const lastNumber = parseInt(lastNumberStr, 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
      console.log(`Latest nested number found: ${latestRecord[0]?.number || 'None'}, nextNumber: ${nextNumber}`);
    } else {
      // For top-level fields like admissionNumber
      const pattern = new RegExp(`^${schoolPrefix}\\d{4}$`);
      const query = { schoolId, [fieldName]: pattern };

      const latestRecord = await Model.find(query)
        .sort({ [fieldName]: -1 })
        .limit(1)
        .select(fieldName);

      if (latestRecord.length > 0 && latestRecord[0][fieldName]) {
        const lastNumberStr = latestRecord[0][fieldName].slice(2); // Extract numeric part
        const lastNumber = parseInt(lastNumberStr, 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
      console.log(`Latest top-level number found: ${latestRecord[0]?.[fieldName] || 'None'}, nextNumber: ${nextNumber}`);
    }

    // Generate the new number
    const newNumber = `${schoolPrefix}${nextNumber}`;
    console.log(`Generated number: ${newNumber}`);

    // Check for uniqueness
    const existingCheck = { schoolId };
    existingCheck[fieldName] = newNumber;
    const exists = isNestedField
      ? await Model.findOne({ schoolId, [fieldName]: newNumber })
      : await Model.findOne(existingCheck);

    if (exists) {
      console.log(`Number ${newNumber} already exists, retrying...`);
      // Recursively try the next number (with a limit to prevent infinite recursion)
      if (nextNumber > 9999) {
        throw new Error("Maximum number limit reached; cannot generate unique number.");
      }
      return generateStructuredNumber(schoolId, Model, fieldName);
    }

    console.log(`Number ${newNumber} is unique`);
    return newNumber;
  } catch (error) {
    console.error(`Failed to generate number: ${error.message}`);
    throw new Error(`Failed to generate number: ${error.message}`);
  }
};

// For backward compatibility
const generateAdmissionNumber = async (schoolId, Model) => {
  return generateStructuredNumber(schoolId, Model, 'admissionNumber');
};

module.exports = { 
  generateStructuredNumber,
  generateAdmissionNumber 
};