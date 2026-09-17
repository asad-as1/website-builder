const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  userId: { type: String, required: true, index: true },
  name: String,
  prompt: String,
  files: mongoose.Schema.Types.Mixed,
  zipUrl: String,
  previewUrl: String,
  thumbnail: {
    emoji: { type: String, default: '✦' },
    gradient: { type: String, default: 'from-cyan-500/30 to-purple-600/30' },
    previewUrl: { type: String },
  },
  thumbnailImage: { type: String, default: null },
  thumbnailPublicId: { type: String, default: null }, // for Cloudinary delete
  shareToken: { type: String, unique: true, sparse: true, index: true },
  shareEnabled: { type: Boolean, default: false },
  framework: { type: String, default: 'nextjs' },
  status: { type: String, default: 'draft' },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);