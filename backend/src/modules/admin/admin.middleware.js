const db = require('../../shared/mongodb.client');

const checkIsAdmin = (role) => {
  const adminRole = process.env.ADMIN_ROLE || 'adminasad90';
  return role === adminRole;
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await db.user.findUnique({ where: { id: req.userId }, select: { role: true, isActive: true } });
    if (!user?.isActive || !checkIsAdmin(user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Admin access required' });
  }
};

module.exports = { requireAdmin };
