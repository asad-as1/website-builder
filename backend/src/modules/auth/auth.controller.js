const authService = require('./auth.service');

const register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    const result = await authService.verifyEmail(token);
    res.json(result); 
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

const googleAuth = async (req, res) => {
  try {
    const result = await authService.googleAuth(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await authService.getMe(req.userId);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const result = await authService.deleteAccount(req.userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await authService.resendVerification(email);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
  googleAuth,
  getMe,
  deleteAccount,
  resendVerification
};