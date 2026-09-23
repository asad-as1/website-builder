const validateRegister = (req, res, next) => {
  const { email, password, name } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password, authToken } = req.body;
  
  if (!email || (!password && !authToken)) {
    return res.status(400).json({ error: 'Email and password (or token) are required' });
  }
  
  next();
};

module.exports = {
  validateRegister,
  validateLogin
};