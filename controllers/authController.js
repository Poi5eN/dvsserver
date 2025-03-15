const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt')

const createToken = (user) => {
  const token = jwt.sign({ user }, process.env.JWT_SECRET , { expiresIn: '7d' });
  return token;
};

// const setTokenCookie = async(req, res, token) => {
//  await res.cookie('Token', token, {
//     httpOnly: true,
//     expires: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
//   });
//   console.log("tokenisthe-=========", token)
//   console.log("tokenis--------------------", req.cookies)
// };
const setTokenCookie = (req, res, token) => {
  // 1 minute = 1 * 60 seconds * 1000 milliseconds
  res.cookie('token', token, { httpOnly: true, expires: new Date(Date.now() + 1 * 60 * 1000) });
  console.log('Token set in cookies: for 1 minute', token);
};


const fetchTokenFromCookie = (req) => {
  return req.cookies.token;
};

const hashPassword = (password) => {
  const res = bcrypt.hash(password, 10)
  return res
}

const verifyPassword = async (password, hashPassword) => {
  const res = await bcrypt.compare(password, hashPassword)
  return res
}

module.exports = {
  createToken,
  verifyPassword,
  hashPassword,
  setTokenCookie,
  fetchTokenFromCookie,
};
