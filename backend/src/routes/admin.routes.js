const router = require('express').Router();
const { authenticate } = require('../modules/auth/auth.middleware');
const { requireAdmin } = require('../modules/admin/admin.middleware');
const controller = require('../controllers/admin.controller');

router.get('/users', authenticate, requireAdmin, controller.listUsers);

module.exports = router;
