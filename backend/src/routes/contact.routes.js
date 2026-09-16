const router = require('express').Router();
const { authenticate } = require('../modules/auth/auth.middleware');
const contactService = require('../modules/contact/contact.service');

// Submit contact request
router.post('/', authenticate, async (req, res) => {
  try {
    const { projectId, changes, budget, priority } = req.body;

    if (!changes || changes.trim().length < 10) {
      return res.status(400).json({ error: 'Please describe your changes (min 10 characters)' });
    }
    if (!budget) {
      return res.status(400).json({ error: 'Please select a budget range' });
    }

    const contact = await contactService.submitContact(req.userId, {
      projectId, changes, budget, priority,
    });

    res.json({
      message: 'Your request has been sent. We will contact you soon!',
      contactId: contact.id,
    });
  } catch (error) {
    console.error('Contact error:', error);
    res.status(500).json({ error: error.message || 'Failed to send request' });
  }
});

router.get('/history', authenticate, async (req, res) => {
  try {
    const contacts = await contactService.getUserHistory(req.userId);
    res.json({ contacts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ==================== GET ALL CONTACTS (ADMIN) ====================
router.get('/admin/all', authenticate, async (req, res) => {
  try {
    const contacts = await contactService.getAllContacts();
    res.json({ contacts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// ==================== ADMIN REPLY ====================
router.post('/:contactId/reply', authenticate, async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply || reply.trim().length < 5) {
      return res.status(400).json({ error: 'Reply must be at least 5 characters' });
    }
    const contact = await contactService.adminReply(req.params.contactId, reply);
    res.json({ message: 'Reply sent successfully', contact });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== UPDATE STATUS ====================
router.put('/:contactId/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'in-progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const contact = await contactService.updateStatus(req.params.contactId, status);
    res.json({ message: 'Status updated', contact });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==================== DELETE CONTACT ====================
router.delete('/:contactId', authenticate, async (req, res) => {
  try {
    const result = await contactService.deleteContact(req.params.contactId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;