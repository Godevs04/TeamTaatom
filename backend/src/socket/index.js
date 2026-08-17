const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const chatController = require('../controllers/chat.controller');
const logger = require('../utils/logger');
const { isOriginAllowed, normalizeOrigin } = require('../utils/corsOrigins');

const JWT_SECRET = process.env.JWT_SECRET;
const WS_PATH = process.env.WS_PATH || '/socket.io';
// PRODUCTION-GRADE: Require WS_ALLOWED_ORIGIN in production, allow fallback only in development
const isProduction = process.env.NODE_ENV === 'production';
const WS_ALLOWED_ORIGIN = process.env.WS_ALLOWED_ORIGIN || (isProduction ? null : 'http://localhost:19006');
if (isProduction && !WS_ALLOWED_ORIGIN) {
  throw new Error('WS_ALLOWED_ORIGIN environment variable is required for production');
}
const normalizedWsAllowedOrigin = normalizeOrigin(WS_ALLOWED_ORIGIN);

/**
 * Same allow-list the REST API's CORS middleware uses (app.js), plus
 * WS_ALLOWED_ORIGIN as an always-allowed extra (e.g. Expo web dev) --
 * additive on top of the REST allow-list, not a replacement for it.
 */
function isSocketOriginAllowed(origin) {
  if (!origin) return true;
  if (normalizedWsAllowedOrigin && normalizeOrigin(origin) === normalizedWsAllowedOrigin) return true;
  return isOriginAllowed(origin);
}

let io;
const onlineUsers = new Map(); // userId -> Set<socketId>

function setupSocket(server) {
  logger.log('Setting up socket server...');
  io = new Server(server, {
    path: WS_PATH,
    cors: {
      origin: (origin, callback) => {
        if (isSocketOriginAllowed(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
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

  // Distinct set of other participants across every chat this user is in --
  // the same broad lookup listChats uses (chat.controller.js), no chat-type
  // filter. This is who presence (user:online/user:offline) actually needs
  // to reach; `user:${userId}` is the user's own room (their own other
  // devices), never a chat partner's.
  async function getChatPartnerIds(userId) {
    const Chat = require('../models/Chat');
    const chats = await Chat.find({ participants: userId }).select('participants').lean();
    const partnerIds = new Set();
    for (const chat of chats) {
      for (const pId of chat.participants) {
        const pidStr = pId.toString();
        if (pidStr !== userId) partnerIds.add(pidStr);
      }
    }
    return [...partnerIds];
  }

  nsp.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.query?.auth;
      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts[0] === 'Bearer') token = parts[1];
      }
      // Web (production): the JWT is never given to browser JS, only set as an
      // httpOnly `authToken` cookie -- fall back to reading it from the
      // handshake's Cookie header. Bearer/query paths above are untouched, so
      // mobile (which sends auth.token) keeps working exactly as before.
      if (!token && socket.handshake.headers?.cookie) {
        const parsed = cookie.parse(socket.handshake.headers.cookie);
        token = parsed.authToken;
      }
      if (!token) return next(new Error('Auth required'));
      const payload = jwt.verify(token, JWT_SECRET);
      socket.user = payload;
      socket.userId = payload.userId || payload._id || payload.id;
      socket.join(`user:${socket.userId}`);
      // Add this socket to the user's set
      if (!onlineUsers.has(socket.userId)) onlineUsers.set(socket.userId, new Set());
      onlineUsers.get(socket.userId).add(socket.id);
      // Notify actual chat partners this user is online -- only on the
      // user's first tracked socket, so opening a second tab/device doesn't
      // re-notify partners who already know the user is online.
      if (onlineUsers.get(socket.userId).size === 1) {
        const partnerIds = await getChatPartnerIds(socket.userId);
        partnerIds.forEach((pId) => nsp.to(`user:${pId}`).emit('user:online', { userId: socket.userId }));
      }
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  nsp.on('connection', (socket) => {
    // Test event
    socket.on('test', (_data) => {
    });
    // Typing event
    socket.on('typing', ({ to }) => {
      if (to) emitToUser(to, 'typing', { from: socket.userId });
    });
    // Seen event
    socket.on('seen', async ({ to, messageId, chatId }) => {
      try {
        let chatIdToUse = chatId;
        if (!chatIdToUse && to && messageId) {
          const Chat = require('../models/Chat');
          const chat = await Chat.findOne({ participants: { $all: [socket.userId, to] }, 'messages._id': messageId, type: { $ne: 'connect_page' } });
          if (chat) chatIdToUse = chat._id;
        }
        if (chatIdToUse && messageId) {
          await chatController.markMessageSeen(chatIdToUse, messageId, socket.userId);

          // For group chats: emit seen to ALL participants so everyone's UI updates
          const Chat = require('../models/Chat');
          const chatDoc = await Chat.findById(chatIdToUse).select('type participants').lean();
          if (chatDoc && chatDoc.type === 'connect_page') {
            const msg = await Chat.findOne(
              { _id: chatIdToUse, 'messages._id': messageId },
              { 'messages.$': 1 }
            ).lean();
            const seenBy = msg && msg.messages && msg.messages[0] ? (msg.messages[0].seenBy || []).map(id => id.toString()) : [];
            for (const pId of chatDoc.participants) {
              const pid = pId.toString();
              if (pid !== socket.userId) {
                emitToUser(pid, 'seen', { from: socket.userId, messageId, chatId: chatIdToUse.toString(), seenBy });
              }
            }
            return;
          }
        }
        // 1:1 chat: emit to the specific user (existing behavior)
        if (to) {
          emitToUser(to, 'seen', { from: socket.userId, messageId });
          if (chatIdToUse && messageId) {
            emitToUser(to, 'message:status_changed', {
              chatId: chatIdToUse.toString(),
              messageIds: [messageId],
              status: 'read'
            });
          }
        }
      } catch (err) {
        logger.error('Socket seen event error:', err);
      }
    });
    // Join/Leave room handlers — validate room names to prevent unauthorized access
    socket.on('join', (room) => {
      if (!room || typeof room !== 'string') return;

      // Allow user to join their own room only
      if (room.startsWith('user:')) {
        if (room !== `user:${socket.userId}`) {
          logger.warn(`Socket ${socket.userId} tried to join unauthorized room: ${room}`);
          return;
        }
        socket.join(room);
        logger.debug(`Socket ${socket.userId} joined room: ${room}`);
        return;
      }

      // Allow admin_support only for SuperAdmin tokens (they have a role field)
      if (room === 'admin_support') {
        if (!socket.user?.role) {
          logger.warn(`Socket ${socket.userId} tried to join admin_support without admin role`);
          return;
        }
        socket.join(room);
        logger.debug(`Socket ${socket.userId} joined room: ${room}`);
        return;
      }

      // Reject all other arbitrary room names
      logger.warn(`Socket ${socket.userId} tried to join unrecognized room: ${room}`);
    });

    socket.on('leave', (room) => {
      if (!room || typeof room !== 'string') return;
      socket.leave(room);
      logger.debug(`Socket ${socket.userId} left room: ${room}`);
    });

    // Send message event (for real-time)
    socket.on('sendMessage', async ({ to, text }) => {
      if (!to || !text) return;
      try {
        const Chat = require('../models/Chat');
        let chat = await Chat.findOne({ participants: { $all: [socket.userId, to] }, type: { $ne: 'connect_page' } });
        if (!chat) {
          chat = await Chat.create({ participants: [socket.userId, to], messages: [], type: 'user_chat' });
        }
        const message = { sender: socket.userId, text, timestamp: new Date() };
        chat.messages.push(message);
        await chat.save();
        
        // CRITICAL: Get the saved message with _id from the database
        const savedChat = await Chat.findById(chat._id);
        const savedMessage = savedChat.messages[savedChat.messages.length - 1];
        
        // Ensure message has _id
        if (!savedMessage || !savedMessage._id) {
          logger.warn('Message _id not found after save in socket handler');
          return;
        }
        
        // Prepare message with all required fields
        const messageToEmit = {
          _id: savedMessage._id.toString(),
          sender: savedMessage.sender.toString(),
          text: savedMessage.text,
          timestamp: savedMessage.timestamp,
          seen: savedMessage.seen || false
        };
        
        // Emit to recipient (all devices)
        emitToUser(to, 'message:new', { chatId: chat._id.toString(), message: messageToEmit });
        // Emit ack to sender (all devices)
        emitToUser(socket.userId, 'message:sent', { chatId: chat._id.toString(), message: messageToEmit });
        // Emit chat list update to both
        emitToUser(to, 'chat:update', { chatId: chat._id.toString(), lastMessage: messageToEmit.text, timestamp: messageToEmit.timestamp });
        emitToUser(socket.userId, 'chat:update', { chatId: chat._id.toString(), lastMessage: messageToEmit.text, timestamp: messageToEmit.timestamp });
        
        // For admin_support conversations, also emit to admin room
        if (chat.type === 'admin_support') {
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
    socket.on('disconnect', async () => {
      if (onlineUsers.has(socket.userId)) {
        onlineUsers.get(socket.userId).delete(socket.id);
        if (onlineUsers.get(socket.userId).size === 0) {
          onlineUsers.delete(socket.userId);
          // Only notify partners once the user's last socket has disconnected --
          // otherwise closing one of several open tabs/devices would incorrectly
          // tell partners the user went offline while still connected elsewhere.
          const partnerIds = await getChatPartnerIds(socket.userId);
          partnerIds.forEach((pId) => nsp.to(`user:${pId}`).emit('user:offline', { userId: socket.userId }));
        }
      }
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

  nsp.emitPostView = (postId, viewsCount, userId) => {
    logger.debug('Emitting post view update:', { postId, viewsCount, userId });
    nsp.emit('post:view:update', {
      postId,
      viewsCount,
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
