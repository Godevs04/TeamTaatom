const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const MessageSchema = new Schema({
  sender: { type: Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false },
  // For group chats: tracks which participants have seen this message
  seenBy: [{ type: Types.ObjectId, ref: 'User' }]
});

const ChatSchema = new Schema({
  participants: [{ type: Types.ObjectId, ref: 'User', required: true }],
  messages: [MessageSchema],
  // Admin support chat fields (optional, backward compatible)
  type: {
    type: String,
    enum: ['user_chat', 'admin_support', 'connect_page'],
    default: 'user_chat',
    index: true
  },
  relatedEntity: {
    type: {
      type: String,
      enum: ['trip_verification', 'support'],
      default: null
    },
    refId: {
      type: Types.ObjectId,
      default: null
    }
  },
  // Optional conversation status (for future use)
  status: {
    type: String,
    enum: ['open', 'waiting_user', 'resolved'],
    default: 'open'
  },
  // Reference to ConnectPage (for connect_page type chats)
  connectPageId: {
    type: Types.ObjectId,
    ref: 'ConnectPage',
    default: null
  },
  // Optional admin assignment (for future scaling)
  assignedAdminId: {
    type: Types.ObjectId,
    ref: 'SuperAdmin',
    default: null
  }
}, { timestamps: true });

// Database indexes for performance optimization
ChatSchema.index({ participants: 1 }); // For finding chats by participants
ChatSchema.index({ 'messages.timestamp': -1 }); // For sorting messages by timestamp
ChatSchema.index({ updatedAt: -1 }); // For sorting chats by last update
ChatSchema.index({ 'participants': 1, updatedAt: -1 }); // Compound index for user's chats

module.exports = mongoose.model('Chat', ChatSchema);
