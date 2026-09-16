const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../mongodb/mongodb.client');

let io = null;
const onlineUsers = new Map();

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ["polling", "websocket"],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await db.user.findUnique({ where: { id: decoded.userId } });
      if (!user || !user.isActive) return next(new Error('User not found'));

      socket.userId = user.id?.toString();
      socket.userRole = user.role || 'user';
      socket.userName = user.name || 'User';
      console.log(`[Socket] ✅ Auth: ${socket.userName} (${socket.userId}) role=${socket.userRole}`);
      next();
    } catch (error) {
      console.error('[Socket] Auth error:', error.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] ✅ Connected: ${socket.userName}`);
    onlineUsers.set(socket.userId, socket.id);
    
    socket.join(`user:${socket.userId}`);
    socket.broadcast.emit('user-online', { userId: socket.userId });

    // ==================== JOIN ROOM ====================
    socket.on('join-room', async ({ contactId }) => {
      console.log(`[Socket] 🚪 join-room: ${contactId} by ${socket.userName}`);
      try {
        if (!contactId) return;

        const contact = await db.contact.findUnique({ where: { id: contactId } });
        if (!contact) {
          socket.emit('error', { message: 'Contact not found' });
          return;
        }

        const isOwner = contact.userId?.toString() === socket.userId?.toString();
        const isAdmin = socket.userRole === process.env.ADMIN_ROLE;
        
        if (!isOwner && !isAdmin) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        socket.join(`contact:${contactId}`);
        console.log(`[Socket] ✅ ${socket.userName} joined contact:${contactId}`);

        // ✅ Delivered mark karo — doosre user ke 'sent' messages ko
        const messages = (contact.messages || []).map((msg) => {
          // Agar user join kar raha hai → admin ke 'sent' messages delivered
          if (!isAdmin && msg.sender === 'admin' && msg.status === 'sent') {
            return { ...msg, status: 'delivered' };
          }
          // Agar admin join kar raha hai → user ke 'sent' messages delivered
          if (isAdmin && msg.sender === 'user' && msg.status === 'sent') {
            return { ...msg, status: 'delivered' };
          }
          return msg;
        });

        await db.contact.update({
          where: { id: contactId },
          data: { messages },
        });

        // ✅ Sender ko notify karo delivered status ke liye
        io.to(`contact:${contactId}`).emit('message-delivered', { contactId });

        socket.emit('joined-room', { contactId });
      } catch (error) {
        console.error('[Socket] join-room error:', error.message);
      }
    });

    // ==================== LEAVE ROOM ====================
    socket.on('leave-room', ({ contactId }) => {
      if (contactId) {
        socket.leave(`contact:${contactId}`);
        console.log(`[Socket] ${socket.userName} left contact:${contactId}`);
      }
    });

    // ==================== SEND MESSAGE ====================
    socket.on('send-message', async ({ contactId, text, clientId }) => {
      console.log(`[Socket] 📩 send-message: ${socket.userName} -> ${contactId}`);
      try {
        if (!contactId || !text?.trim()) return;

        const contact = await db.contact.findUnique({ where: { id: contactId } });
        if (!contact) {
          socket.emit('error', { message: 'Contact not found' });
          return;
        }

        const isOwner = contact.userId?.toString() === socket.userId?.toString();
        const isAdmin = socket.userRole === process.env.ADMIN_ROLE;
        
        if (!isOwner && !isAdmin) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        const sender = isAdmin ? 'admin' : 'user';
        
        // ✅ Hamesha 'sent' status — delivered sirf join-room pe
        const newMessage = {
          clientId: clientId || null,
          sender,
          text: text.trim(),
          timestamp: new Date(),
          status: 'sent',
        };

        await db.contact.update({
          where: { id: contactId },
          data: {
            messages: [...(contact.messages || []), newMessage],
            lastMessage: text.trim(),
            lastMessageAt: new Date(),
            unreadByAdmin: sender === 'user' ? (contact.unreadByAdmin || 0) + 1 : contact.unreadByAdmin,
            unreadByUser: sender === 'admin' ? (contact.unreadByUser || 0) + 1 : contact.unreadByUser,
            status: contact.status === 'pending' ? 'in-progress' : contact.status,
          },
        });

        console.log(`[Socket] ✅ Message saved (status: ${newMessage.status})`);

        io.to(`contact:${contactId}`).emit('new-message', {
          contactId,
          message: newMessage,
        });

        if (sender === 'user') {
          io.emit('admin-notification', {
            contactId,
            userName: contact.name,
            text: text.trim(),
          });
        } else {
          io.to(`user:${contact.userId}`).emit('user-notification', {
            contactId,
            text: text.trim(),
          });
        }
      } catch (error) {
        console.error('[Socket] ❌ send-message error:', error.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ==================== TYPING ====================
    socket.on('typing', ({ contactId, isTyping }) => {
      if (!contactId) return;
      socket.to(`contact:${contactId}`).emit('user-typing', {
        contactId,
        userId: socket.userId,
        userName: socket.userName,
        isTyping,
      });
    });

    // ==================== MARK AS READ ====================
    socket.on('mark-read', async ({ contactId }) => {
      try {
        if (!contactId) return;

        const contact = await db.contact.findUnique({ where: { id: contactId } });
        if (!contact) return;

        const isAdmin = socket.userRole === process.env.ADMIN_ROLE;
        const updateData = isAdmin ? { unreadByAdmin: 0 } : { unreadByUser: 0 };
        
        const messages = (contact.messages || []).map((msg) => {
          if (isAdmin && msg.sender === 'user') {
            return { ...msg, status: 'read', read: true };
          }
          if (!isAdmin && msg.sender === 'admin') {
            return { ...msg, status: 'read', read: true };
          }
          return msg;
        });

        await db.contact.update({
          where: { id: contactId },
          data: { ...updateData, messages },
        });

        io.to(`contact:${contactId}`).emit('messages-read', {
          contactId,
          readBy: isAdmin ? 'admin' : 'user',
        });
      } catch (error) {
        console.error('[Socket] mark-read error:', error.message);
      }
    });

    // ==================== DISCONNECT ====================
    socket.on('disconnect', () => {
      console.log(`[Socket] ❌ Disconnected: ${socket.userName}`);
      onlineUsers.delete(socket.userId);
      socket.broadcast.emit('user-offline', { userId: socket.userId });
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

const isUserOnline = (userId) => onlineUsers.has(userId);

module.exports = { initializeSocket, getIO, isUserOnline };