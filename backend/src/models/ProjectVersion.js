const mongoose = require('mongoose');

const projectVersionSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  projectId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  files: mongoose.Schema.Types.Mixed,
  message: String,
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

module.exports = mongoose.models.ProjectVersion || mongoose.model('ProjectVersion', projectVersionSchema);
