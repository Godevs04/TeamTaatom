const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const MessageSchema = new Schema({
  sender: { type: Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  seen: { type: Boolean, default: false }
});

const ChatSchema = new Schema({
  participants: [{ type: Types.ObjectId, ref: 'User', required: true }],
  messages: [MessageSchema],
  // Admin support chat fields (optional, backward compatible)
  type: {
    type: String,
    enum: ['user_chat', 'admin_support'],
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
  }
}, { timestamps: true });

// Database indexes for performance optimization
ChatSchema.index({ participants: 1 }); // For finding chats by participants
ChatSchema.index({ 'messages.timestamp': -1 }); // For sorting messages by timestamp
ChatSchema.index({ updatedAt: -1 }); // For sorting chats by last update
ChatSchema.index({ 'participants': 1, updatedAt: -1 }); // Compound index for user's chats

module.exports = mongoose.model('Chat', ChatSchema);
