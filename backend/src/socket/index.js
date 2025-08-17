const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getFollowers } = require('../utils/socketBus');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;
const WS_PATH = process.env.WS_PATH || '/socket.io';
const WS_ALLOWED_ORIGIN = process.env.WS_ALLOWED_ORIGIN || 'http://localhost:19006';

let io;
const onlineUsers = new Map(); // userId -> socket.id

function setupSocket(server) {
  io = new Server(server, {
    path: WS_PATH,
    cors: {
      origin: WS_ALLOWED_ORIGIN,
      credentials: true,
    },
  });

  const nsp = io.of('/app');

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
      socket.userId = payload._id || payload.id;
      socket.join(`user:${socket.userId}`);
      onlineUsers.set(socket.userId, socket.id);
      // Notify chat partners this user is online
      nsp.to(`user:${socket.userId}`).emit('user:online', { userId: socket.userId });
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  nsp.on('connection', (socket) => {
    // Typing event
    socket.on('typing', ({ to }) => {
      if (to) nsp.to(`user:${to}`).emit('typing', { from: socket.userId });
    });
    // Seen event
    socket.on('seen', ({ to, messageId }) => {
      if (to) nsp.to(`user:${to}`).emit('seen', { from: socket.userId, messageId });
    });
    // Presence
    socket.on('disconnect', () => {
      onlineUsers.delete(socket.userId);
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
