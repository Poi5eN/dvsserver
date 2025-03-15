const AdminInfo = require('../models/adminModel'); // Adjust path as needed

const generateStructuredNumber = async (schoolId, Model, fieldName = 'admissionNumber') => {
  try {
    // Fetch schoolName from AdminInfo based on schoolId
    const adminInfo = await AdminInfo.findOne({ schoolId });
    if (!adminInfo || !adminInfo.schoolName) {
      throw new Error("School information not found or schoolName is missing.");
    }

    // Get the first two letters of schoolName in uppercase
    const schoolPrefix = adminInfo.schoolName.slice(0, 2).toUpperCase();

    // Find the highest existing admission number with direct query
    // This is more reliable than the aggregation approach
    const pattern = new RegExp(`^${schoolPrefix}\\d{4}$`);
    
    // Create a query object that filters by schoolId and the pattern for the field
    const query = { schoolId };
    query[fieldName] = pattern;
    
    // Sort in descending order to get the highest number
    const latestRecord = await Model.find(query)
      .sort({ [fieldName]: -1 })
      .limit(1)
      .select(fieldName);

    let nextNumber = 1000; // Default starting number
    
    if (latestRecord.length > 0 && latestRecord[0][fieldName]) {
      const lastNumberStr = latestRecord[0][fieldName].slice(2); // Extract numeric part
      const lastNumber = parseInt(lastNumberStr, 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    // Generate the new number
    const newNumber = `${schoolPrefix}${nextNumber}`;
    
    // CRITICAL: Verify this number doesn't already exist to prevent duplicates
    const existingCheck = {};
    existingCheck[fieldName] = newNumber;
    existingCheck.schoolId = schoolId;
    
    const exists = await Model.findOne(existingCheck);
    
    if (exists) {
      // If exists, recursively try the next number
      return generateStructuredNumber(schoolId, Model, fieldName);
    }
    
    return newNumber;
  } catch (error) {
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