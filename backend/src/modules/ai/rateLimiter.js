const prisma = require('../../shared/prisma/prisma.client');

const checkRateLimit = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, apiUsage: true, usageResetAt: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const limits = {
    free: 50,
    starter: 500,
    growth: 1000,
    pro: 1500,
    business: 5000,
    scale: 15000
  };
  const limit = limits[user.plan] || limits.free;
  const now = new Date();
  const resetDate = user.usageResetAt || new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Reset usage if date passed
  if (now > resetDate) {
    await prisma.user.update({
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
  await prisma.user.update({
    where: { id: userId },
    data: { apiUsage: { increment: 1 } }
  });
};

const previewLimits = {
  free: 3,
  starter: 25,
  growth: 75,
  pro: 150,
  business: 300,
  scale: 1000
};

const checkPreviewLimit = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, previewUsage: true, previewResetAt: true }
  });
  if (!user) throw new Error('User not found');
  const limit = previewLimits[user.plan] || previewLimits.free;
  const now = new Date();
  if (now > user.previewResetAt) {
    await prisma.user.update({
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
  await prisma.user.update({
    where: { id: userId },
    data: { previewUsage: { increment: 1 } }
  });
};

module.exports = { checkRateLimit, incrementUsage, checkPreviewLimit, incrementPreviewUsage };