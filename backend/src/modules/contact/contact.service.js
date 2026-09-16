const db = require('../../shared/mongodb/mongodb.client');
const emailService = require('../../shared/email/email.service');

// ==================== SUBMIT CONTACT ====================
const submitContact = async (userId, { projectId, changes, budget, priority }) => {
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

  // ✅ Initial message as first chat message
  const initialMessage = {
    sender: 'user',
    text: changes,
    timestamp: new Date(),
    read: false,
  };

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
      messages: [initialMessage],
      lastMessage: changes,
      lastMessageAt: new Date(),
      unreadByAdmin: 1,
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

  // Send email notification to user
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