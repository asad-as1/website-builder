const db = require('../../shared/mongodb.client');

const ensureUserUsageReset = async (userId) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      apiUsage: true,
      usageResetAt: true,
      previewUsage: true,
      previewResetAt: true,
    }
  });

  if (!user) return null;

  const now = new Date();
  const updates = {};
  let shouldUpdate = false;

  const usageReset = user.usageResetAt ? new Date(user.usageResetAt) : null;
  if (!usageReset || now > usageReset) {
    updates.apiUsage = 0;
    updates.usageResetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    shouldUpdate = true;
  }

  const previewReset = user.previewResetAt ? new Date(user.previewResetAt) : null;
  if (!previewReset || now > previewReset) {
    updates.previewUsage = 0;
    updates.previewResetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    shouldUpdate = true;
  }

  if (shouldUpdate) {
    await db.user.update({
      where: { id: userId },
      data: updates,
    });
    return { ...user, ...updates };
  }

  return user;
};

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
  const resetDate = user.usageResetAt ? new Date(user.usageResetAt) : null;

  // Reset usage if resetDate is missing or 24 hours have passed
  if (!resetDate || now > resetDate) {
    const nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await db.user.update({
      where: { id: userId },
      data: {
        apiUsage: 0,
        usageResetAt: nextReset
      }
    });
    return { allowed: true, remaining: limit, resetAt: nextReset };
  }

  const remaining = Math.max(limit - (user.apiUsage || 0), 0);

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
  const checkIsAdmin = (role) => role === (process.env.ADMIN_ROLE || 'adminasad90');
  const limit = checkIsAdmin(user.role) ? 30 : 10;
  const now = new Date();
  const resetDate = user.previewResetAt ? new Date(user.previewResetAt) : null;

  // Reset preview usage if resetDate is missing or 24 hours have passed
  if (!resetDate || now > resetDate) {
    const nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await db.user.update({
      where: { id: userId },
      data: { previewUsage: 0, previewResetAt: nextReset }
    });
    return { allowed: true, remaining: limit };
  }
  const remaining = Math.max(limit - (user.previewUsage || 0), 0);
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

module.exports = {
  checkRateLimit,
  incrementUsage,
  checkPreviewLimit,
  incrementPreviewUsage,
  ensureUserUsageReset,
};