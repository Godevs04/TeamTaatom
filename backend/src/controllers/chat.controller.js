const Chat = require('../models/Chat');
const User = require('../models/User');
const mongoose = require('mongoose');

// Import socket and fetch with proper error handling
let getIO;
let fetch;

// Use dynamic import for fetch to handle different Node.js versions
try {
  fetch = require('node-fetch');
} catch (error) {
  // Fallback to global fetch if available (Node.js 18+)
  fetch = globalThis.fetch || global.fetch;
  if (!fetch) {
    console.error('Fetch not available');
  }
}

// Function to get socket instance - will be called when needed
const getSocketInstance = () => {
  try {
    console.log('Getting socket instance...');
    console.log('global.socketIO available:', !!global.socketIO);
    
    // Try to get from global first
    if (global.socketIO) {
      console.log('Using global.socketIO');
      return global.socketIO;
    }
    
    console.log('Trying to require socket module...');
    // Try to require socket module
    const socketModule = require('../socket');
    console.log('Socket module required:', !!socketModule);
    console.log('Socket module getIO:', !!socketModule.getIO);
    
    if (socketModule.getIO) {
      const io = socketModule.getIO();
      console.log('getIO returned:', !!io);
      return io;
    }
    
    console.log('No socket instance available');
    return null;
  } catch (error) {
    console.error('Failed to get socket instance:', error);
    return null;
  }
};

// Helper: check if user is following the other
async function canChat(userId, otherId) {
  // const user = await User.findById(userId);
  // return user && user.following.includes(otherId);
  return true;
}

exports.listChats = async (req, res) => {
  console.log('Request headers:', req.headers);
  console.log('req.user in /chat:', req.user);
  const userId = req.user._id;
  console.log('Fetching chats for user:', userId, 'at', new Date().toISOString());
  const chats = await Chat.find({ participants: userId })
    .populate('participants', 'fullName profilePic')
    .sort('-updatedAt')
    .lean();
  // Ensure every message has a 'seen' property (for backward compatibility)
  chats.forEach(chat => {
    if (Array.isArray(chat.messages)) {
      chat.messages = chat.messages.map(msg => ({ ...msg, seen: typeof msg.seen === 'boolean' ? msg.seen : false }));
    }
  });
  
  // Deduplicate chats: Group by participants (sorted) and keep only the most recent one
  const chatMap = new Map();
  chats.forEach(chat => {
    // Sort participant IDs to create a consistent key
    const participantIds = chat.participants
      .map(p => p._id ? p._id.toString() : p.toString())
      .sort()
      .join('_');
    
    // If chat doesn't exist or this one is more recent, keep it
    if (!chatMap.has(participantIds) || 
        new Date(chat.updatedAt) > new Date(chatMap.get(participantIds).updatedAt)) {
      chatMap.set(participantIds, chat);
    }
  });
  
  // Convert map back to array
  const uniqueChats = Array.from(chatMap.values());
  
  // Sort by updatedAt descending
  uniqueChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  
  console.log('Chats found:', chats.length, 'Unique chats:', uniqueChats.length);
  res.json({ chats: uniqueChats });
};

exports.getChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    console.log('Getting chat between:', userId, 'and', otherUserId);
    
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ message: 'Invalid user' });
    }
    if (!(await canChat(userId, otherUserId))) return res.status(403).json({ message: 'Not allowed' });
    
    let chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } })
      .populate('participants', 'fullName profilePic')
      .lean();
    
    if (!chat) {
      console.log('Chat not found, creating new one');
      try {
        chat = await Chat.create({ participants: [userId, otherUserId], messages: [] });
        // Populate the newly created chat
        chat = await Chat.findById(chat._id)
          .populate('participants', 'fullName profilePic')
          .lean();
        console.log('Created new chat:', chat._id);
      } catch (error) {
        console.error('Error creating chat:', error);
        return res.status(500).json({ message: 'Failed to create chat' });
      }
    } else {
      console.log('Found existing chat:', chat._id);
    }
    
    res.json({ chat });
  } catch (error) {
    console.error('Error in getChat:', error);
    res.status(500).json({ message: 'Failed to get chat' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { otherUserId } = req.params;
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ message: 'Invalid user' });
    }
    if (!(await canChat(userId, otherUserId))) return res.status(403).json({ message: 'Not allowed' });
    const chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } });
    if (!chat) return res.json({ messages: [] });
    res.json({ messages: chat.messages });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ message: 'Failed to get messages' });
  }
};

exports.sendMessage = async (req, res) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;
  const { text } = req.body;
  
  try {
    if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ message: 'Invalid user' });
    }
    if (!text) return res.status(400).json({ message: 'Text required' });
    if (!(await canChat(userId, otherUserId))) return res.status(403).json({ message: 'Not allowed' });
    
    let chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } });
    if (!chat) {
      chat = await Chat.create({ participants: [userId, otherUserId], messages: [] });
    }
    const message = { sender: userId, text, timestamp: new Date() };
    chat.messages.push(message);
    await chat.save();

    // Emit real-time socket events for immediate updates
    try {
      console.log('Attempting to emit socket events...');
      
      const io = getSocketInstance();
      console.log('Socket instance available:', !!io);
      console.log('Socket type:', typeof io);
      
      if (io && io.of('/app')) {
        const nsp = io.of('/app');
        console.log('Namespace available:', !!nsp);
        
        // Emit to recipient (all devices)
        nsp.to(`user:${otherUserId}`).emit('message:new', { chatId: chat._id, message });
        // Emit ack to sender (all devices)
        nsp.to(`user:${userId}`).emit('message:sent', { chatId: chat._id, message });
        // Emit chat list update to both users
        nsp.to(`user:${otherUserId}`).emit('chat:update', { chatId: chat._id, lastMessage: message.text, timestamp: message.timestamp });
        nsp.to(`user:${userId}`).emit('chat:update', { chatId: chat._id, lastMessage: message.text, timestamp: message.timestamp });
        console.log('Socket events emitted successfully for message:', message._id);
        console.log('Emitted to users:', { sender: userId, recipient: otherUserId });
        console.log('Chat ID:', chat._id);
      } else {
        console.log('Socket not available, skipping real-time events');
      }
    } catch (socketError) {
      console.error('Error emitting socket events:', socketError);
      // Don't fail the request if socket fails
    }

    // Send push notification to recipient
    try {
      const recipient = await User.findById(otherUserId);
      if (recipient && recipient.expoPushToken && fetch && typeof fetch === 'function') {
        console.log('Sending push notification...');
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipient.expoPushToken,
            sound: 'default',
            title: 'New Message',
            body: `${req.user.fullName || 'Someone'}: ${text}`,
            data: { chatWith: userId }
          })
        });
        console.log('Push notification sent successfully');
      } else {
        console.log('Push notification skipped:', { 
          hasRecipient: !!recipient, 
          hasToken: !!recipient?.expoPushToken, 
          hasFetch: !!fetch,
          fetchType: typeof fetch 
        });
      }
    } catch (err) {
      console.error('Failed to send push notification:', err);
    }

    res.json({ message });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

// Mark a message as seen
exports.markMessageSeen = async (chatId, messageId, userId) => {
  console.log('[markMessageSeen] called with:', { chatId, messageId, userId });
  if (!chatId || !messageId || !userId) return;
  const chat = await Chat.findById(chatId);
  if (!chat) {
    console.log('[markMessageSeen] chat not found');
    return;
  }
  // Only allow if user is a participant
  if (!chat.participants.map(id => id.toString()).includes(userId.toString())) {
    console.log('[markMessageSeen] user not a participant');
    return;
  }
  const msg = chat.messages.id(messageId);
  if (msg && !msg.seen) {
    msg.seen = true;
    await chat.save();
    console.log('[markMessageSeen] message marked as seen:', { messageId });
  } else if (!msg) {
    console.log('[markMessageSeen] message not found');
  } else {
    console.log('[markMessageSeen] message already seen');
  }
};

// Mark all messages from the other user as seen
exports.markAllMessagesSeen = async (req, res) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;
  const chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } });
  if (!chat) return res.status(404).json({ message: 'Chat not found' });
  let updated = false;
  chat.messages.forEach(msg => {
    if (msg.sender.toString() === otherUserId && !msg.seen) {
      msg.seen = true;
      updated = true;
    }
  });
  if (updated) await chat.save();
  res.json({ success: true });
};
