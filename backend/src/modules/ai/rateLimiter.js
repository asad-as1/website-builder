const db = require('../../shared/mongodb/mongodb.client');

const checkRateLimit = async (userId) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { apiUsage: true, usageResetAt: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const limit = 20;
  const now = new Date();
  const resetDate = user.usageResetAt || new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Reset usage if date passed
  if (now > resetDate) {
    await db.user.update({
      where: { id: userId },
      data: {
        apiUsage: 0,
        usageResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    return { allowed: true, remaining: limit, resetAt: resetDate };
  }

  const remaining = limit - user.apiUsage;

  if (remaining <= 0) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt: resetDate,
      message: `Daily limit reached (${limit}/day). Upgrade to Pro or try tomorrow.`
    };
  }

  return { allowed: true, remaining, resetAt: resetDate };
};

const incrementUsage = async (userId) => {
  await db.user.update({
    where: { id: userId },
    data: { apiUsage: { increment: 1 } }
  });
};

const checkPreviewLimit = async (userId) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { previewUsage: true, previewResetAt: true, role: true }
  });
  if (!user) throw new Error('User not found');
  const limit = user.role === 'adminasad90' ? 30 : 10;
  const now = new Date();
  if (now > user.previewResetAt) {
    await db.user.update({
      where: { id: userId },
      data: { previewUsage: 0, previewResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) }
    });
    return { allowed: true, remaining: limit };
  }
  const remaining = Math.max(limit - user.previewUsage, 0);
  return {
    allowed: remaining > 0,
    remaining,
    message: remaining > 0 ? undefined : `Daily preview limit reached (${limit}/day).`
  };
};

const incrementPreviewUsage = async (userId) => {
  await db.user.update({
    where: { id: userId },
    data: { previewUsage: { increment: 1 } }
  });
};

module.exports = { checkRateLimit, incrementUsage, checkPreviewLimit, incrementPreviewUsage };