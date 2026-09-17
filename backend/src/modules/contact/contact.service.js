const db = require('../../shared/mongodb/mongodb.client');
const emailService = require('../../shared/email/email.service');

// ==================== SUBMIT CONTACT ====================
const submitContact = async (userId, { projectId, changes, budget, priority, attachment }) => {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  let projectName = '';
  if (projectId) {
    const project = await db.project.findFirst({
      where: { id: projectId, userId },
      select: { name: true },
    });
    if (project) projectName = project.name;
  }

  // ✅ Build initial messages array
  const initialMessages = [];

  // ✅ Message 1: Text description
  initialMessages.push({
    sender: 'user',
    type: 'text',
    text: changes,
    timestamp: new Date(),
    read: false,
    status: 'sent',
  });

  // ✅ Message 2: Attachment (if exists)
  if (attachment?.url) {
    initialMessages.push({
      sender: 'user',
      type: attachment.type || 'document',
      text: '', // caption empty
      fileUrl: attachment.url,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      timestamp: new Date(Date.now() + 100), // slight offset
      read: false,
      status: 'sent',
    });
  }

  // ✅ Last message preview — attachment ho toh woh
  let lastMessagePreview = changes;
  if (attachment?.url) {
    if (attachment.type === 'image') lastMessagePreview = '📷 Photo';
    else lastMessagePreview = `📄 ${attachment.fileName || 'Document'}`;
  }

  const contact = await db.contact.create({
    data: {
      userId,
      name: user.name || 'User',
      email: user.email,
      projectId: projectId || null,
      projectName,
      changes,
      budget,
      priority: priority || 'normal',
      status: 'pending',
      // ✅ Top-level attachment (reference ke liye)
      attachment: attachment || {
        type: null,
        url: null,
        fileName: null,
        fileSize: null,
        mimeType: null,
      },
      // ✅ Messages array mein text + attachment dono
      messages: initialMessages,
      lastMessage: lastMessagePreview,
      lastMessageAt: new Date(),
      unreadByAdmin: initialMessages.length, // ✅ Jitne messages, utne unread
      unreadByUser: 0,
    },
  });

  // Send email to admin
  await emailService.sendContactEmail({
    name: user.name,
    email: user.email,
    projectName,
    changes,
    budget,
    priority,
    attachment,
  });

  return contact;
};

// ==================== GET USER HISTORY ====================
const getUserHistory = async (userId) => {
  const contacts = await db.contact.findMany({
    where: { userId },
    orderBy: { createdAt: -1 },
  });
  return contacts;
};

// ==================== GET ALL CONTACTS (ADMIN) ====================
const getAllContacts = async () => {
  const contacts = await db.contact.findMany({
    orderBy: { createdAt: -1 },
  });
  return contacts;
};

// ==================== ADMIN REPLY ====================
const adminReply = async (contactId, reply) => {
  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error('Contact not found');

  const updated = await db.contact.update({
    where: { id: contactId },
    data: {
      adminReply: reply,
      repliedAt: new Date(),
      status: 'in-progress',
    },
  });

  await emailService.sendAdminReplyEmail({
    name: contact.name,
    email: contact.email,
    changes: contact.changes,
    adminReply: reply,
  });

  return updated;
};

// ==================== UPDATE STATUS ====================
const updateStatus = async (contactId, status) => {
  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error('Contact not found');

  const updated = await db.contact.update({
    where: { id: contactId },
    data: { status },
  });

  return updated;
};

// ==================== DELETE CONTACT ====================
const deleteContact = async (contactId) => {
  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error('Contact not found');

  await db.contact.delete({ where: { id: contactId } });
  return { message: 'Contact deleted successfully' };
};

module.exports = {
  submitContact,
  getUserHistory,
  getAllContacts,
  adminReply,
  updateStatus,
  deleteContact,
};