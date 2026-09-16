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
  
  messages: [{
    clientId: { type: String, default: null },
    sender: { type: String, enum: ['user', 'admin'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    status: { 
      type: String, 
      enum: ['sending', 'sent', 'delivered', 'read'], 
      default: 'sent' 
    },
  }],
  
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: null },
  unreadByAdmin: { type: Number, default: 0 },
  unreadByUser: { type: Number, default: 0 },
  
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Contact', contactSchema);