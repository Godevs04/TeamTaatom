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
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommunityEventCompetition', CommunityEventCompetitionSchema);
