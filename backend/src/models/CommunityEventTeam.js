const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CommunityEventTeamSchema = new Schema(
  {
    eventId: {
      type: Types.ObjectId,
      ref: 'CommunityEvent',
      required: true,
      index: true,
    },
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
    captainId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },
    memberIds: [{ type: Types.ObjectId, ref: 'User' }],
    /** Expected roster size; team is complete when memberIds.length >= expectedSize and all accepted. */
    expectedSize: { type: Number, required: true, min: 2, max: 50 },
    pendingInviteIds: [{ type: Types.ObjectId, ref: 'User' }],
    isComplete: { type: Boolean, default: false },
    teamChatId: { type: Types.ObjectId, ref: 'Chat', default: null },
    status: {
      type: String,
      enum: ['forming', 'active', 'withdrawn'],
      default: 'forming',
    },
  },
  { timestamps: true }
);

CommunityEventTeamSchema.index({ eventId: 1, captainId: 1 });

module.exports = mongoose.model('CommunityEventTeam', CommunityEventTeamSchema);
