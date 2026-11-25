const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CommunityEventSubmissionSchema = new Schema(
  {
    competitionId: {
      type: Types.ObjectId,
      ref: 'CommunityEventCompetition',
      required: true,
      index: true,
    },
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
    },
    mode: {
      type: String,
      enum: ['individual', 'team'],
      required: true,
    },
    userId: { type: Types.ObjectId, ref: 'User', default: null, index: true },
    teamId: { type: Types.ObjectId, ref: 'CommunityEventTeam', default: null, index: true },
    postId: {
      type: Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'removed_by_host'],
      default: 'active',
      index: true,
    },
    removedBy: { type: Types.ObjectId, ref: 'User', default: null },
    removedAt: { type: Date, default: null },
    removeReason: { type: String, default: '' },
    /** Frozen metrics after competition ends (or host freeze). */
    snapshotLikes: { type: Number, default: null },
    snapshotViews: { type: Number, default: null },
  },
  { timestamps: true }
);

CommunityEventSubmissionSchema.index({ competitionId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('CommunityEventSubmission', CommunityEventSubmissionSchema);
