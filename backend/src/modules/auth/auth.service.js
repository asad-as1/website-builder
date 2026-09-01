const bcrypt = require('bcryptjs');
const prisma = require('../../shared/prisma/prisma.client');
const jwtService = require('../../shared/jwt/jwt.service');
const emailService = require('../../shared/email/email.service');

// ==================== REGISTER ====================
const register = async ({ email, password, name }) => {
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new Error('User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verifyToken = jwtService.generateEmailToken();
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name || 'User',
      emailVerified: false,
      verifyToken,
      verifyTokenExpires: tokenExpiry
    }
  });

  await emailService.sendVerificationEmail(email, verifyToken);

  return {
    message: 'User created. Please verify your email.',
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  };
};

// ==================== VERIFY EMAIL ====================
const verifyEmail = async (token) => {
  const user = await prisma.user.findFirst({
    where: { verifyToken: token }
  });

  if (!user) {
    throw new Error('Invalid or expired token');
  }

  if (user.verifyTokenExpires < new Date()) {
    throw new Error('Token expired. Please request a new verification email.');
  }

  if (user.emailVerified) {
    return {
      message: 'Email already verified.',
      email: user.email,
      alreadyVerified: true
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verifyToken: null,
      verifyTokenExpires: null
    }
  });

  // ✅ Generate JWT for auto-login
  const jwtToken = jwtService.generateToken(user.id);

  return {
    message: 'Email verified successfully.',
    email: user.email,
    token: jwtToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      plan: user.plan || 'free'
    }
  };
};

// ==================== LOGIN ====================
const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    throw new Error('Account deactivated. Contact support.');
  }

  // ✅ SPECIAL CASE: Verification ke baad auto-login
  if (password === 'VERIFIED_BY_TOKEN') {
    if (!user.emailVerified) {
      throw new Error('Please verify your email first');
    }
    const token = jwtService.generateToken(user.id);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        plan: user.plan || 'free'
      }
    };
  }

  // ✅ NORMAL LOGIN
  if (!user.password) {
    throw new Error('Please login with Google');
  }

  if (!user.emailVerified) {
    throw new Error('Please verify your email first');
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  const token = jwtService.generateToken(user.id);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      plan: user.plan || 'free'
    }
  };
};

// ==================== GOOGLE AUTH ====================
const googleAuth = async ({ email, name, picture, googleId }) => {
  if (!email || !googleId) {
    throw new Error('Email and googleId are required');
  }

  let user = await prisma.user.findUnique({
    where: { googleId }
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: { email }
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          avatar: picture || user.avatar,
          emailVerified: true,
          name: name || user.name
        }
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name: name || 'User',
          avatar: picture || null,
          googleId,
          emailVerified: true
        }
      });
    }
  }

  const token = jwtService.generateToken(user.id);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      plan: user.plan || 'free'
    }
  };
};

// ==================== GET CURRENT USER ====================
const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      plan: true,
      apiUsage: true,
      emailVerified: true,
      isActive: true,
      createdAt: true
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.isActive) {
    throw new Error('Account deactivated. Contact support.');
  }

  return { user };
};

// ==================== DELETE ACCOUNT ====================
const deleteAccount = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.isActive) {
    throw new Error('Account already deactivated');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      deletedAt: new Date()
    }
  });

  return { message: 'Account deactivated successfully. Your data is retained.' };
};

// ==================== RESEND VERIFICATION ====================
const resendVerification = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.emailVerified) {
    throw new Error('Email already verified');
  }

  const newToken = jwtService.generateEmailToken();
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verifyToken: newToken,
      verifyTokenExpires: tokenExpiry
    }
  });

  await emailService.sendVerificationEmail(email, newToken);

  return { message: 'New verification email sent. Check your inbox.' };
};

// ==================== EXPORT ====================
module.exports = {
  register,
  verifyEmail,
  login,
  googleAuth,
  getMe,
  deleteAccount,
  resendVerification
};