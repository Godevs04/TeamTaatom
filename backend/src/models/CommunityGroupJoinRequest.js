const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CommunityGroupJoinRequestSchema = new Schema(
  {
    groupChatId: {
      type: Types.ObjectId,
      ref: 'CommunityGroupChat',
      required: true,
      index: true,
    },
    connectPageId: {
      type: Types.ObjectId,
      ref: 'ConnectPage',
      required: true,
      index: true,
    },
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    proofText: { type: String, trim: true, maxlength: 1000, default: '' },
    proofFileUrl: { type: String, default: '' },
    proofStorageKey: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    reviewedBy: { type: Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CommunityGroupJoinRequestSchema.index(
  { groupChatId: 1, userId: 1, status: 1 },
  { name: 'group_user_status' }
);

module.exports = mongoose.model('CommunityGroupJoinRequest', CommunityGroupJoinRequestSchema);
