// utils/crypto.js
const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes key, set in .env
const iv = Buffer.from(process.env.ENCRYPTION_IV, 'hex');   // 16 bytes IV, set in .env

// Encrypt password
exports.encryptPassword = (password) => {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

// Decrypt password
exports.decryptPassword = (encryptedPassword) => {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};