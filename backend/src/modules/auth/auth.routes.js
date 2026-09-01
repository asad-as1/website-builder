const router = require('express').Router();
const authController = require('./auth.controller');
const { validateRegister, validateLogin } = require('./auth.validators');
const { authenticate } = require('./auth.middleware');

// Public routes
router.post('/register', validateRegister, authController.register);
router.post('/resend-verification', authController.resendVerification);
router.get('/verify-email', authController.verifyEmail);
router.post('/login', validateLogin, authController.login);
router.post('/google', authController.googleAuth);

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.delete('/delete-account', authenticate, authController.deleteAccount);

module.exports = router;