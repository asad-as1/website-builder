const mongoose = require('mongoose');

const deletedUserSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  originalUserId: String,
  name: String,
  email: { type: String, required: true },
  originalEmail: { type: String, required: true },
  avatar: String,
  projectCount: { type: Number, default: 0 },
  apiUsage: { type: Number, default: 0 },
  joinedAt: Date,
  deletedAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.DeletedUser || mongoose.model('DeletedUser', deletedUserSchema);
