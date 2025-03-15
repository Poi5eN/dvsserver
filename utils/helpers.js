// utils/helpers.js

const crypto = require('crypto');

/**
 * Generates a unique registration number.
 * Format: REG-YYYYMMDD-<random string>
 */
const generateRegistrationNumber = () => {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}${(date.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    
    const randomString = crypto.randomBytes(3).toString('hex').toUpperCase();

    return `REG-${formattedDate}-${randomString}`;
};

module.exports = { generateRegistrationNumber };
