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
  
  // ✅ Contact attachment
  attachment: {
    type: { type: String, enum: ['image', 'document', null], default: null },
    url: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    mimeType: { type: String, default: null },
  },
  
  messages: [{
    clientId: { type: String, default: null },
    sender: { type: String, enum: ['user', 'admin'], required: true },
    type: { 
      type: String, 
      enum: ['text', 'image', 'document'], 
      default: 'text' 
    },
    text: { type: String, default: '' },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    mimeType: { type: String, default: null },
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
  
  isUserDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Contact', contactSchema);