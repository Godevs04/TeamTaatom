const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CommunityGroupChatSchema = new Schema(
  {
    connectPageId: {
      type: Types.ObjectId,
      ref: 'ConnectPage',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    privacy: {
      type: String,
      enum: ['public', 'request', 'invite'],
      default: 'public',
      index: true,
    },
    requireJoinProof: { type: Boolean, default: false },
    proofPrompt: { type: String, trim: true, maxlength: 300, default: '' },
    chatId: {
      type: Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    createdBy: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },
    memberCount: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true }
);

CommunityGroupChatSchema.index({ connectPageId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('CommunityGroupChat', CommunityGroupChatSchema);
