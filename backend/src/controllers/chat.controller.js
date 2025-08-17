const Chat = require('../models/Chat');
const User = require('../models/User');
const { getIO } = require('../socket');
const mongoose = require('mongoose');

// Helper: check if user is following the other
async function canChat(userId, otherId) {
  const user = await User.findById(userId);
  return user && user.following.includes(otherId);
}

exports.listChats = async (req, res) => {
  const userId = req.user._id;
  const chats = await Chat.find({ participants: userId })
    .populate('participants', 'fullName profilePic')
    .sort('-updatedAt')
    .lean();
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
  // Emit socket event to both users
  const io = getIO();
  const nsp = io.of('/app');
  [userId, otherUserId].forEach(id => {
    nsp.to(`user:${id}`).emit('receiveMessage', { chatId: chat._id, message });
  });
  res.json({ message });
};
