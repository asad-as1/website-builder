const db = require('../shared/mongodb.client');
const emailService = require('../services/email.service');

// ✅ Helper: Get admin info (avatar + name)
const getAdminInfo = async () => {
  try {
    const admin = await db.user.findFirst({
      where: { role: process.env.ADMIN_ROLE || 'adminasad90' },
      select: { name: true, avatar: true },
    });
    return admin || { name: 'Admin', avatar: null };
  } catch {
    return { name: 'Admin', avatar: null };
  }
};

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

  const initialMessages = [];

  initialMessages.push({
    sender: 'user',
    type: 'text',
    text: changes,
    timestamp: new Date(),
    read: false,
    status: 'sent',
  });

  if (attachment?.url) {
    initialMessages.push({
      sender: 'user',
      type: attachment.type || 'document',
      text: '',
      fileUrl: attachment.url,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      mimeType: attachment.mimeType,
      timestamp: new Date(Date.now() + 100),
      read: false,
      status: 'sent',
    });
  }

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
      attachment: attachment || {
        type: null,
        url: null,
        fileName: null,
        fileSize: null,
        mimeType: null,
      },
      messages: initialMessages,
      lastMessage: lastMessagePreview,
      lastMessageAt: new Date(),
      unreadByAdmin: initialMessages.length,
      unreadByUser: 0,
    },
  });

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

// ✅ NEW: Get user history with admin info
const getUserHistoryWithAdmin = async (userId) => {
  const [contacts, admin] = await Promise.all([
    getUserHistory(userId),
    getAdminInfo(),
  ]);
  return { contacts, admin };
};

// ==================== GET ALL CONTACTS (ADMIN) ====================
const getAllContacts = async () => {
  const contacts = await db.contact.findMany({
    orderBy: { createdAt: -1 },
  });

  // ✅ Fetch user avatars for each contact
  const contactsWithAvatars = await Promise.all(
    contacts.map(async (contact) => {
      let profilePic = null;
      try {
        const user = await db.user.findUnique({
          where: { id: contact.userId },
          select: { avatar: true },
        });
        profilePic = user?.avatar || null;
      } catch {
        profilePic = null;
      }
      return { ...contact, profilePic };
    })
  );

  return contactsWithAvatars;
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
  getUserHistoryWithAdmin,
  getAllContacts,
  adminReply,
  updateStatus,
  deleteContact,
};