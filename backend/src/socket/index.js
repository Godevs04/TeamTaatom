const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getFollowers } = require('../utils/socketBus');
const User = require('../models/User');
const chatController = require('../controllers/chat.controller');

const JWT_SECRET = process.env.JWT_SECRET;
const WS_PATH = process.env.WS_PATH || '/socket.io';
const WS_ALLOWED_ORIGIN = process.env.WS_ALLOWED_ORIGIN || 'http://localhost:19006';

let io;
const onlineUsers = new Map(); // userId -> Set<socketId>

function setupSocket(server) {
  io = new Server(server, {
    path: WS_PATH,
    cors: {
      origin: WS_ALLOWED_ORIGIN,
      credentials: true,
    },
  });

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
      } catch (err) {
        emitToUser(socket.userId, 'message:error', { error: 'Failed to send message', details: err.message });
      }
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

  return nsp;
}

module.exports = { setupSocket, getIO: () => io };
