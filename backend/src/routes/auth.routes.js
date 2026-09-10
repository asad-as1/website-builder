const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const { validateRegister, validateLogin } = require('../modules/auth/auth.validators');
const { authenticate } = require('../modules/auth/auth.middleware');

router.post('/register', validateRegister, controller.register);
router.post('/resend-verification', controller.resendVerification);
router.get('/verify-email', controller.verifyEmail);
router.post('/login', validateLogin, controller.login);
router.post('/google', controller.googleAuth);
router.get('/me', authenticate, controller.getMe);
router.delete('/delete-account', authenticate, controller.deleteAccount);

module.exports = router;
