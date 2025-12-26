const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getFollowers } = require('../utils/socketBus');
const User = require('../models/User');
const chatController = require('../controllers/chat.controller');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
const WS_PATH = process.env.WS_PATH || '/socket.io';
// PRODUCTION-GRADE: Require WS_ALLOWED_ORIGIN in production, allow fallback only in development
const isProduction = process.env.NODE_ENV === 'production';
const WS_ALLOWED_ORIGIN = process.env.WS_ALLOWED_ORIGIN || (isProduction ? null : 'http://localhost:19006');
if (isProduction && !WS_ALLOWED_ORIGIN) {
  throw new Error('WS_ALLOWED_ORIGIN environment variable is required for production');
}

let io;
const onlineUsers = new Map(); // userId -> Set<socketId>

function setupSocket(server) {
  logger.log('Setting up socket server...');
  io = new Server(server, {
    path: WS_PATH,
    cors: {
      origin: WS_ALLOWED_ORIGIN,
      credentials: true,
    },
  });

  // Set global reference for other modules
  global.socketIO = io;
  logger.log('Socket server initialized and set to global.socketIO');

  const nsp = io.of('/app');

  // Helper to emit to all sockets of a user
  function emitToUser(userId, event, payload) {
    const sockets = onlineUsers.get(userId) || new Set();
    for (const sid of sockets) nsp.to(sid).emit(event, payload);
  }

  nsp.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.query?.auth;
      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts[0] === 'Bearer') token = parts[1];
      }
      if (!token) return next(new Error('Auth required'));
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = payload;
      socket.userId = payload.userId || payload._id || payload.id;
      socket.join(`user:${socket.userId}`);
      // Add this socket to the user's set
      if (!onlineUsers.has(socket.userId)) onlineUsers.set(socket.userId, new Set());
      onlineUsers.get(socket.userId).add(socket.id);
      // Notify chat partners this user is online
      nsp.to(`user:${socket.userId}`).emit('user:online', { userId: socket.userId });
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  nsp.on('connection', (socket) => {
    // Test event
    socket.on('test', (data) => {
    });
    // Typing event
    socket.on('typing', ({ to }) => {
      if (to) emitToUser(to, 'typing', { from: socket.userId });
    });
    // Seen event
    socket.on('seen', async ({ to, messageId, chatId }) => {
      let chatIdToUse = chatId;
      if (!chatIdToUse && to && messageId) {
        const Chat = require('../models/Chat');
        const chat = await Chat.findOne({ participants: { $all: [socket.userId, to] }, 'messages._id': messageId });
        if (chat) chatIdToUse = chat._id;
      }
      if (chatIdToUse && messageId) {
        await chatController.markMessageSeen(chatIdToUse, messageId, socket.userId);
      }
      if (to) emitToUser(to, 'seen', { from: socket.userId, messageId });
    });
    // Join/Leave room handlers
    socket.on('join', (room) => {
      if (room) {
        socket.join(room);
        logger.debug(`Socket ${socket.userId} joined room: ${room}`);
      }
    });

    socket.on('leave', (room) => {
      if (room) {
        socket.leave(room);
        logger.debug(`Socket ${socket.userId} left room: ${room}`);
      }
    });

    // Send message event (for real-time)
    socket.on('sendMessage', async ({ to, text }) => {
      if (!to || !text) return;
      try {
        const Chat = require('../models/Chat');
        let chat = await Chat.findOne({ participants: { $all: [socket.userId, to] } });
        if (!chat) {
          chat = await Chat.create({ participants: [socket.userId, to], messages: [] });
        }
        const message = { sender: socket.userId, text, timestamp: new Date() };
        chat.messages.push(message);
        await chat.save();
        
        // Emit to recipient (all devices)
        emitToUser(to, 'message:new', { chatId: chat._id, message });
        // Emit ack to sender (all devices)
        emitToUser(socket.userId, 'message:sent', { chatId: chat._id, message });
        // Emit chat list update to both
        emitToUser(to, 'chat:update', { chatId: chat._id, lastMessage: message.text, timestamp: message.timestamp });
        emitToUser(socket.userId, 'chat:update', { chatId: chat._id, lastMessage: message.text, timestamp: message.timestamp });
        
        // For admin_support conversations, also emit to admin room
        if (chat.type === 'admin_support') {
          const TAATOM_OFFICIAL_USER_ID = process.env.TAATOM_OFFICIAL_USER_ID || '000000000000000000000001';
          nsp.to('admin_support').emit('admin_support:message:new', { 
            chatId: chat._id, 
            message,
            userId: socket.userId.toString(),
            otherUserId: to.toString()
          });
          nsp.to('admin_support').emit('admin_support:chat:update', { 
            chatId: chat._id, 
            lastMessage: message.text, 
            timestamp: message.timestamp,
            userId: socket.userId.toString()
          });
        }
      } catch (err) {
        emitToUser(socket.userId, 'message:error', { error: 'Failed to send message', details: err.message });
      }
    });

    // Post interaction events
    socket.on('post:like', ({ postId, isLiked, likesCount }) => {
      logger.debug('WebSocket - Post like event:', { postId, isLiked, likesCount, userId: socket.userId });
      // Broadcast to all users viewing this post
      nsp.emit('post:like:update', { 
        postId, 
        isLiked, 
        likesCount, 
        userId: socket.userId,
        timestamp: new Date()
      });
    });

    socket.on('post:comment', ({ postId, comment, commentsCount }) => {
      logger.debug('WebSocket - Post comment event:', { postId, comment, commentsCount, userId: socket.userId });
      // Broadcast to all users viewing this post
      nsp.emit('post:comment:update', { 
        postId, 
        comment, 
        commentsCount, 
        userId: socket.userId,
        timestamp: new Date()
      });
    });

    socket.on('post:save', ({ postId, isSaved }) => {
      logger.debug('WebSocket - Post save event:', { postId, isSaved, userId: socket.userId });
      // Broadcast to all users viewing this post
      nsp.emit('post:save:update', { 
        postId, 
        isSaved, 
        userId: socket.userId,
        timestamp: new Date()
      });
    });

    // Call events
    socket.on('call:invite', ({ to, callId, callType, from }) => {
      logger.debug('WebSocket - Call invite:', { from: from || socket.userId, to, callId, callType });
      emitToUser(to, 'call:incoming', { 
        from: from || socket.userId, 
        callId, 
        callType,
        timestamp: new Date()
      });
    });

    socket.on('call:accept', ({ callId, to, from }) => {
      logger.debug('WebSocket - Call accept:', { from: from || socket.userId, to, callId });
      emitToUser(to, 'call:accepted', { 
        from: from || socket.userId, 
        callId,
        timestamp: new Date()
      });
    });

    socket.on('call:reject', ({ callId, to, from }) => {
      logger.debug('WebSocket - Call reject:', { from: from || socket.userId, to, callId });
      emitToUser(to, 'call:rejected', { 
        from: from || socket.userId, 
        callId,
        timestamp: new Date()
      });
    });

    socket.on('call:end', ({ callId, to, from }) => {
      logger.debug('WebSocket - Call end:', { from: from || socket.userId, to, callId });
      emitToUser(to, 'call:ended', { 
        from: from || socket.userId, 
        callId,
        timestamp: new Date()
      });
    });

    socket.on('call:offer', ({ to, callId, offer }) => {
      logger.debug('WebSocket - Call offer:', { from: socket.userId, to, callId });
      emitToUser(to, 'call:offer', { 
        from: socket.userId, 
        callId, 
        offer,
        timestamp: new Date()
      });
    });

    socket.on('call:answer', ({ to, callId, answer }) => {
      logger.debug('WebSocket - Call answer:', { from: socket.userId, to, callId });
      emitToUser(to, 'call:answer', { 
        from: socket.userId, 
        callId, 
        answer,
        timestamp: new Date()
      });
    });

    socket.on('call:ice-candidate', ({ to, callId, candidate }) => {
      logger.debug('WebSocket - ICE candidate:', { from: socket.userId, to, callId });
      emitToUser(to, 'call:ice-candidate', { 
        from: socket.userId, 
        callId, 
        candidate,
        timestamp: new Date()
      });
    });
    // Presence
    socket.on('disconnect', () => {
      if (onlineUsers.has(socket.userId)) {
        onlineUsers.get(socket.userId).delete(socket.id);
        if (onlineUsers.get(socket.userId).size === 0) onlineUsers.delete(socket.userId);
      }
      nsp.to(`user:${socket.userId}`).emit('user:offline', { userId: socket.userId });
    });
  });

  // Utility for controllers to emit events
  nsp.emitInvalidateFeed = (userIds) => {
    userIds.forEach((id) => nsp.to(`user:${id}`).emit('invalidate:feed'));
  };
  nsp.emitInvalidateProfile = (userId) => {
    nsp.to(`user:${userId}`).emit(`invalidate:profile:${userId}`);
  };
  nsp.emitEvent = (event, userIds, payload) => {
    userIds.forEach((id) => nsp.to(`user:${id}`).emit(event, payload));
  };

  // Post interaction utilities
  nsp.emitPostLike = (postId, isLiked, likesCount, userId) => {
    logger.debug('Emitting post like update:', { postId, isLiked, likesCount, userId });
    nsp.emit('post:like:update', { 
      postId, 
      isLiked, 
      likesCount, 
      userId,
      timestamp: new Date()
    });
  };

  nsp.emitPostComment = (postId, comment, commentsCount, userId) => {
    logger.debug('Emitting post comment update:', { postId, comment, commentsCount, userId });
    nsp.emit('post:comment:update', { 
      postId, 
      comment, 
      commentsCount, 
      userId,
      timestamp: new Date()
    });
  };

  nsp.emitPostSave = (postId, isSaved, userId) => {
    logger.debug('Emitting post save update:', { postId, isSaved, userId });
    nsp.emit('post:save:update', { 
      postId, 
      isSaved, 
      userId,
      timestamp: new Date()
    });
  };

  return nsp;
}

module.exports = { 
  setupSocket, 
  getIO: () => {
    if (!io) {
      logger.error('Socket not initialized. Call setupSocket first.');
      return null;
    }
    return io;
  },
  getSocket: () => io // Export the socket instance directly
};
