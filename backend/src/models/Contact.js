const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  projectName: { type: String, default: '' },
  changes: { type: String, required: true },
  budget: { type: String, required: true },
  priority: { type: String, enum: ['low', 'normal', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
  adminReply: { type: String, default: '' },
  repliedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Contact', contactSchema);