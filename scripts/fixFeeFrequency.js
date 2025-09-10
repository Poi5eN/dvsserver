const mongoose = require('mongoose');
const FeeStructure = require('../models/feeStructureModel');

// Utility function to get frequency from fee type
const getFrequencyFromFeeType = (feeType) => {
  switch (feeType.toLowerCase()) {
    case "one time":
      return "one-time";
    case "monthly":
      return "monthly";
    case "annual":
      return "annual";
    case "latefine":
      return "monthly"; // Assuming late fines are monthly by default
    default:
      return "monthly"; // fallback
  }
};

async function fixFeeFrequency() {
  try {
    console.log('Starting fee frequency fix...');
    
    // Find all fees that might have incorrect frequency
    const fees = await FeeStructure.find({});
    
    let updatedCount = 0;
    let errors = [];
    
    for (const fee of fees) {
      try {
        const correctFrequency = getFrequencyFromFeeType(fee.feeType);
        
        // Check if frequency needs to be updated
        if (fee.frequency !== correctFrequency) {
          console.log(`Updating fee: ${fee.name || fee.feeType} (${fee.feeType}) from "${fee.frequency}" to "${correctFrequency}"`);
          
          await FeeStructure.updateOne(
            { _id: fee._id },
            { $set: { frequency: correctFrequency } }
          );
          
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating fee ${fee._id}:`, error);
        errors.push({ feeId: fee._id, error: error.message });
      }
    }
    
    console.log(`\nFee frequency fix completed!`);
    console.log(`Total fees processed: ${fees.length}`);
    console.log(`Fees updated: ${updatedCount}`);
    
    if (errors.length > 0) {
      console.log(`Errors encountered: ${errors.length}`);
      errors.forEach(err => {
        console.log(`- Fee ID ${err.feeId}: ${err.error}`);
      });
    }
    
  } catch (error) {
    console.error('Error in fixFeeFrequency:', error);
  }
}

// If this script is run directly
if (require.main === module) {
  // Connect to MongoDB
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database-name')
    .then(() => {
      console.log('Connected to MongoDB');
      return fixFeeFrequency();
    })
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixFeeFrequency, getFrequencyFromFeeType };
