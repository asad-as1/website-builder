const db = require('../shared/mongodb/mongodb.client');

const listUsers = async (req, res) => {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, isActive: true, deletedAt: true, createdAt: true, emailVerified: true, apiUsage: true },
  });
  const usersWithMetrics = await Promise.all(users.map(async (user) => ({
    ...user,
    projectCount: await db.project.count({ where: { userId: user.id } }),
    apiRemaining: Math.max(50 - (user.apiUsage || 0), 0),
  })));
  return res.json({ users: usersWithMetrics });
};

module.exports = { listUsers };
