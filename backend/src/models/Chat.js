const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const AttachmentSchema = new Schema({
  type: {
    type: String,
    enum: ['image', 'video', 'file', 'post', 'audio'],
    required: true
  },
  storageKey: { type: String, default: null }, // R2/S3 storage key for secure signing
  url: { type: String }, // Signed or fallback URL
  thumbnailUrl: { type: String }, // Thumbnail for videos
  fileName: { type: String },
  fileSize: { type: Number }, // in bytes
  mimeType: { type: String },
  duration: { type: Number }, // video duration in seconds
  width: { type: Number },
  height: { type: Number },
  // For shared posts
  postId: { type: Types.ObjectId, ref: 'Post' },
  postPreview: {
    caption: { type: String },
    imageUrl: { type: String },
    authorName: { type: String },
    authorProfilePic: { type: String }
  }
}, { _id: false });

const MessageSchema = new Schema({
  sender: { type: Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  attachments: [AttachmentSchema],
  timestamp: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
    index: true
  },
  deliveredAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
  seen: { type: Boolean, default: false },
  // For group chats: tracks which participants have seen this message
  seenBy: [{ type: Types.ObjectId, ref: 'User' }],
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
});

// Ensure message has either text, attachments, or is marked as deleted
MessageSchema.pre('validate', function (next) {
  if (!this.isDeleted && !this.text && (!this.attachments || this.attachments.length === 0)) {
    next(new Error('Message must have either text or at least one attachment'));
  } else {
    next();
  }
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
