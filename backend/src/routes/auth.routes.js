const router = require('express').Router();
const multer = require('multer');
const controller = require('../controllers/auth.controller');
const { validateRegister, validateLogin } = require('../modules/auth/auth.validators');
const { authenticate } = require('../modules/auth/auth.middleware');

// ✅ Multer for avatar upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  },
});

router.post('/register', upload.single('avatar'), validateRegister, controller.register);
router.post('/resend-verification', controller.resendVerification);
router.get('/verify-email', controller.verifyEmail);
router.post('/login', validateLogin, controller.login);
router.post('/google', controller.googleAuth);
router.get('/me', authenticate, controller.getMe);
router.delete('/delete-account', authenticate, controller.deleteAccount);
router.put('/avatar', authenticate, upload.single('avatar'), controller.updateAvatar);

module.exports = router;