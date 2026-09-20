const bcrypt = require("bcryptjs");
const db = require("../shared/mongodb.client");
const jwtService = require("../services/jwt.service");
const emailService = require("../services/email.service");
const cloudinary = require("../shared/cloudinary.client");

const uploadAvatarToCloudinary = async (fileBuffer, userId = null) => {
  return new Promise((resolve, reject) => {
    const publicId = userId
      ? `user_${userId}_${Date.now()}`
      : `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "genetix/avatars",
        public_id: publicId,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (err, res) => (err ? reject(err) : resolve(res)),
    );
    stream.end(fileBuffer);
  });
};

// ==================== REGISTER ====================
const register = async ({ email, password, name }, avatarFile = null) => {
  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verifyToken = jwtService.generateEmailToken();
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // ✅ Upload avatar if provided
  let avatarUrl = null;
  if (avatarFile) {
    try {
      const uploadResult = await uploadAvatarToCloudinary(avatarFile.buffer);
      avatarUrl = uploadResult.secure_url;
      console.log(`[Auth] Avatar uploaded: ${avatarUrl}`);
    } catch (err) {
      console.error(`[Auth] Avatar upload failed: ${err.message}`);
      // ✅ Silent fail — user register ho jayega without avatar
    }
  }

  const user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      name: name || "User",
      avatar: avatarUrl,
      emailVerified: false,
      verifyToken,
      verifyTokenExpires: tokenExpiry,
    },
  });

  await emailService.sendVerificationEmail(email, verifyToken);

  return {
    message: "User created. Please verify your email.",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
  };
};

// ==================== VERIFY EMAIL ====================
const verifyEmail = async (token) => {
  const user = await db.user.findFirst({
    where: { verifyToken: token },
  });

  if (!user) {
    throw new Error("Invalid or expired token");
  }

  if (user.verifyTokenExpires < new Date()) {
    throw new Error("Token expired. Please request a new verification email.");
  }

  if (user.emailVerified) {
    return {
      message: "Email already verified.",
      email: user.email,
      alreadyVerified: true,
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      verifyToken: null,
      verifyTokenExpires: null,
    },
  });

  const jwtToken = jwtService.generateToken(user.id);

  return {
    message: "Email verified successfully.",
    email: user.email,
    token: jwtToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
    },
  };
};

// ==================== LOGIN ====================
const login = async ({ email, password }) => {
  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User Not Found. Please register first.");
  }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

  if (!user.isActive) {
    throw new Error("Account deactivated. Contact support.");
  }

  if (password === "VERIFIED_BY_TOKEN") {
    if (!user.emailVerified) {
      throw new Error("Please verify your email first");
    }
    const token = jwtService.generateToken(user.id);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
    };
  }

  if (!user.password) {
    throw new Error("Please login with Google");
  }

  if (!user.emailVerified) {
    throw new Error("Please verify your email first");
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  const token = jwtService.generateToken(user.id);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
    },
  };
};

// ==================== GOOGLE AUTH ====================
const googleAuth = async ({ email, name, picture, googleId }) => {
  if (!email || !googleId) {
    throw new Error("Email and googleId are required");
  }

  let user = await db.user.findUnique({
    where: { googleId },
  });

  if (!user) {
    user = await db.user.findUnique({
      where: { email },
    });

    if (user) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          googleId,
          avatar: picture || user.avatar,
          emailVerified: true,
          name: name || user.name,
        },
      });
    } else {
      user = await db.user.create({
        data: {
          email,
          name: name || "User",
          avatar: picture || null,
          googleId,
          emailVerified: true,
        },
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
      role: user.role,
    },
  };
};

// ==================== GET CURRENT USER ====================
const getMe = async (userId) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      role: true,
      apiUsage: true,
      previewUsage: true,
      emailVerified: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.isActive) {
    throw new Error("Account deactivated. Contact support.");
  }

  return { user };
};

// ==================== DELETE ACCOUNT ====================
const deleteAccount = async (userId) => {
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.isActive) {
    throw new Error("Account already deactivated");
  }

  await db.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  return {
    message: "Account deactivated successfully. Your data is retained.",
  };
};

// ==================== RESEND VERIFICATION ====================
const resendVerification = async (email) => {
  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.emailVerified) {
    throw new Error("Email already verified");
  }

  const newToken = jwtService.generateEmailToken();
  const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.user.update({
    where: { id: user.id },
    data: {
      verifyToken: newToken,
      verifyTokenExpires: tokenExpiry,
    },
  });

  await emailService.sendVerificationEmail(email, newToken);

  return { message: "New verification email sent. Check your inbox." };
};

// ==================== ✅ UPDATE AVATAR ====================
const updateAvatar = async (userId, avatarFile) => {
  if (!avatarFile) {
    throw new Error("No image provided");
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  // ✅ Delete old avatar from Cloudinary (if exists and not a Google URL)
  if (user.avatar && user.avatar.includes("cloudinary.com")) {
    try {
      // Extract public_id from URL
      const parts = user.avatar.split("/");
      const filename = parts[parts.length - 1];
      const publicId = `genetix/avatars/${filename.split(".")[0]}`;
      await cloudinary.uploader.destroy(publicId);
      console.log(`[Auth] Old avatar deleted: ${publicId}`);
    } catch (err) {
      console.log(`[Auth] Old avatar delete failed: ${err.message}`);
    }
  }

  // ✅ Upload new avatar
  const uploadResult = await uploadAvatarToCloudinary(
    avatarFile.buffer,
    userId,
  );

  // ✅ Update DB
  const updated = await db.user.update({
    where: { id: userId },
    data: { avatar: uploadResult.secure_url },
  });

  return {
    message: "Avatar updated successfully",
    avatar: updated.avatar,
  };
};

// ==================== EXPORT ====================
module.exports = {
  register,
  verifyEmail,
  login,
  googleAuth,
  getMe,
  deleteAccount,
  resendVerification,
  updateAvatar,
};
