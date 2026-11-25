const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CommunityEventCompetitionSchema = new Schema(
  {
    eventId: {
      type: Types.ObjectId,
      ref: 'CommunityEvent',
      required: true,
      unique: true,
      index: true,
    },
    connectPageId: {
      type: Types.ObjectId,
      ref: 'ConnectPage',
      required: true,
      index: true,
    },
    enabled: { type: Boolean, default: true },
    rankBy: {
      type: String,
      enum: ['likes', 'views'],
      default: 'likes',
    },
    /** engagement = likes/views only; judges = judge avg; hybrid = weighted blend */
    rankMode: {
      type: String,
      enum: ['engagement', 'judges', 'hybrid'],
      default: 'engagement',
    },
    /** For hybrid: 0–100 weight of judge score vs engagement (50 = equal). */
    judgeWeight: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    /** Extra judges beyond event hosts (hosts always can score). */
    judgeIds: [{ type: Types.ObjectId, ref: 'User' }],
    allowedMedia: {
      type: [{ type: String, enum: ['post', 'short', 'long_video'] }],
      default: () => ['post', 'short', 'long_video'],
    },
    rulesText: { type: String, trim: true, maxlength: 4000, default: '' },
    submissionsOpen: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    /** When true, leaderboard uses frozen snapshot metrics. */
    frozen: { type: Boolean, default: false },
    createdBy: { type: Types.ObjectId, ref: 'User', required: true },
    remindersSent: {
      submissions2h: { type: Date, default: null },
    },
    showcase: {
      publishedAt: { type: Date, default: null },
      entries: [
        {
          submissionId: { type: Types.ObjectId, ref: 'CommunityEventSubmission' },
          postId: { type: Types.ObjectId, ref: 'Post' },
          userId: { type: Types.ObjectId, ref: 'User' },
          rank: { type: Number },
          metric: { type: Number, default: 0 },
        },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommunityEventCompetition', CommunityEventCompetitionSchema);
