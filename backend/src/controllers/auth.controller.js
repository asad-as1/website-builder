const authService = require('../services/auth.service');

const handle = (serviceCall, successStatus = 200) => async (req, res) => {
  try {
    const result = await serviceCall(req);
    res.status(successStatus).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateAvatar = async (req, res) => {
  try {
    const result = await authService.updateAvatar(req.userId, req.file);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  register: handle((req) => authService.register(req.body), 201),
  verifyEmail: handle((req) => authService.verifyEmail(req.query.token)),
  login: handle((req) => authService.login(req.body)),
  googleAuth: handle((req) => authService.googleAuth(req.body)),
  getMe: handle((req) => authService.getMe(req.userId)),
  deleteAccount: handle((req) => authService.deleteAccount(req.userId)),
  resendVerification: handle((req) => authService.resendVerification(req.body.email)),
  updateAvatar,
};
