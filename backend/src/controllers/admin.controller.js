const db = require("../shared/mongodb.client");

const listUsers = async (req, res) => {
  const [activeUsers, deletedUsers] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        avatar: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        apiUsage: true,
        usageResetAt: true,
      },
    }),
    db.deletedUser.findMany({
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  const now = new Date();

  const activeWithMetrics = await Promise.all(
    activeUsers.map(async (user) => {
      const usageReset = user.usageResetAt ? new Date(user.usageResetAt) : null;
      const isExpired = !usageReset || now > usageReset;
      const currentApiUsage = isExpired ? 0 : (user.apiUsage || 0);

      if (isExpired && (user.apiUsage || 0) > 0) {
        db.user.update({
          where: { id: user.id },
          data: { apiUsage: 0, usageResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) }
        }).catch(() => {});
      }

      return {
        ...user,
        apiUsage: currentApiUsage,
        profilePic: user.avatar || null,
        projectCount: await db.project.count({ where: { userId: user.id } }),
        apiRemaining: Math.max(20 - currentApiUsage, 0),
        isActive: true,
      };
    }),
  );

  const deletedWithMetrics = deletedUsers.map((d) => ({
    id: d.id,
    name: d.name || "—",
    email: d.email,
    profilePic: d.avatar || null,
    projectCount: d.projectCount || 0,
    apiUsage: d.apiUsage || 0,
    apiRemaining: 0,
    isActive: false,
    role: "user",
    createdAt: d.joinedAt || d.createdAt,
    deletedAt: d.deletedAt,
  }));

  const allUsers = [...activeWithMetrics, ...deletedWithMetrics].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return res.json({ users: allUsers });
};

module.exports = { listUsers };