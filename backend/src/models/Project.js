const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  userId: { type: String, required: true, index: true },
  name: String,
  prompt: String,
  files: mongoose.Schema.Types.Mixed,
  zipUrl: String,
  previewUrl: String,
  framework: { type: String, default: 'nextjs' },
  status: { type: String, default: 'draft' },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);
