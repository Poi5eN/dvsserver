const jwt = require('jsonwebtoken')

const verifyToken = async (req, res, next) => {
  // console.log("auhto-----",req.headers.authorization)
  // console.log("Aitho-----",req.headers.Authorization)
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Invalid or missing Authorization header' });
  }

  const token = authorizationHeader.split(' ')[1];

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedToken.user; 

    if (!req.user.session) {
      return res.status(400).json({ success: false, message: "Session information is missing in the token" });
    }

    // Generate session-based filter (April to March)
    const [startYear, endYear] = req.user.session.split("-").map(Number);
    const sessionStart = new Date(`${startYear}-04-01`);
    const sessionEnd = new Date(`${endYear}-03-31T23:59:59`);

    // Attach session filter to req object (this will be available in all APIs)
    req.sessionFilter = { createdAt: { $gte: sessionStart, $lte: sessionEnd } };

    next(); 
  } catch (error) {
    return res.status(401).json({ message: error.message });
  }  
};



module.exports = verifyToken; 