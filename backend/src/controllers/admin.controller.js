const db = require("../shared/mongodb.client");

const listUsers = async (req, res) => {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      avatar: true,
      email: true,
      role: true,
      isActive: true,
      deletedAt: true,
      createdAt: true,
      emailVerified: true,
      apiUsage: true,
    },
  });
  const usersWithMetrics = await Promise.all(
    users.map(async (user) => ({
      ...user,
      profilePic: user.avatar || null, // ✅ Rename to profilePic
      projectCount: await db.project.count({ where: { userId: user.id } }),
      apiRemaining: Math.max(20 - (user.apiUsage || 0), 0),
    })),
  );
  return res.json({ users: usersWithMetrics });
};

module.exports = { listUsers };