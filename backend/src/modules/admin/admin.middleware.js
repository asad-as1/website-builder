const db = require('../../shared/mongodb/mongodb.client');
const requireAdmin = async (req, res, next) => {
  try {
    const user = await db.user.findUnique({ where: { id: req.userId }, select: { role: true, isActive: true } });
    if (!user?.isActive || user.role !== 'adminasad90') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Admin access required' });
  }
};

module.exports = { requireAdmin };
