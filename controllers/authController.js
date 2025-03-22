const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const createToken = (user) => {
  const token = jwt.sign({ user }, process.env.JWT_SECRET, { expiresIn: "7d" });
  return token;
};

const setTokenCookie = (req, res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    expires: new Date(Date.now() + 1 * 60 * 1000), // 1 minute for testing
  });
  console.log("Token set in cookies: for 1 minute", token);
};

const fetchTokenFromCookie = (req) => {
  return req.cookies.token;
};

const hashPassword = (password) => {
  return bcrypt.hash(password, 10);
};

const verifyPassword = async (password, hashPassword) => {
  return await bcrypt.compare(password, hashPassword);
};

module.exports = {
  createToken,
  verifyPassword,
  hashPassword,
  setTokenCookie,
  fetchTokenFromCookie,
};