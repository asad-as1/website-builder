const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const generateEmailToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

module.exports = {
  generateToken,
  verifyToken,
  generateEmailToken
};