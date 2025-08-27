const Chat = require('../models/Chat');
const User = require('../models/User');
const { getIO } = require('../socket');
const mongoose = require('mongoose');

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
  console.log('Chats found:', chats.length);
  res.json({ chats });
};

exports.getChat = async (req, res) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;
  if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
    return res.status(400).json({ message: 'Invalid user' });
  }
  if (!(await canChat(userId, otherUserId))) return res.status(403).json({ message: 'Not allowed' });
  let chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } })
    .populate('participants', 'fullName profilePic')
    .lean();
  if (!chat) {
    chat = await Chat.create({ participants: [userId, otherUserId], messages: [] });
  }
  res.json({ chat });
};

exports.getMessages = async (req, res) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;
  if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
    return res.status(400).json({ message: 'Invalid user' });
  }
  if (!(await canChat(userId, otherUserId))) return res.status(403).json({ message: 'Not allowed' });
  const chat = await Chat.findOne({ participants: { $all: [userId, otherUserId] } });
  if (!chat) return res.json({ messages: [] });
  res.json({ messages: chat.messages });
};

exports.sendMessage = async (req, res) => {
  const userId = req.user._id;
  const { otherUserId } = req.params;
  const { text } = req.body;
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
  // Socket emission removed from here
  res.json({ message });
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
