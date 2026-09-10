const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  email: { type: String, required: true, unique: true },
  password: String,
  name: String,
  avatar: String,
  googleId: { type: String, unique: true, sparse: true },
  emailVerified: { type: Boolean, default: false },
  verifyToken: String,
  verifyTokenExpires: Date,
  isActive: { type: Boolean, default: true },
  deletedAt: Date,
  role: { type: String, default: 'user' },
  apiUsage: { type: Number, default: 0 },
  usageResetAt: { type: Date, default: Date.now },
  previewUsage: { type: Number, default: 0 },
  previewResetAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
