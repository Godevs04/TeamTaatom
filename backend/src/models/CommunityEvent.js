const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CommunityEventSchema = new Schema(
  {
    connectPageId: {
      type: Types.ObjectId,
      ref: 'ConnectPage',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, default: null },
    location: {
      address: { type: String, default: '' },
      coordinates: {
        latitude: { type: Number, default: 0 },
        longitude: { type: Number, default: 0 },
      },
    },
    coverImage: { type: String, default: '' },
    coverStorageKey: { type: String, default: '' },
    maxParticipants: { type: Number, default: null, min: 1 },
    visibility: {
      type: String,
      enum: ['public', 'members', 'private'],
      default: 'members',
    },
    participationMode: {
      type: String,
      enum: ['individual', 'group', 'both'],
      default: 'individual',
    },
    /** What entrants may submit when competition is on (multi-select) */
    allowedEntryMedia: {
      type: [{ type: String, enum: ['post', 'short', 'long_video'] }],
      default: () => ['post', 'short', 'long_video'],
    },
    hostIds: [{ type: Types.ObjectId, ref: 'User' }],
    createdBy: { type: Types.ObjectId, ref: 'User', required: true },
    registrationOpen: { type: Boolean, default: true },
    participantCount: { type: Number, default: 0 },
    chatId: { type: Types.ObjectId, ref: 'Chat', default: null },
    announcementChatId: { type: Types.ObjectId, ref: 'Chat', default: null },
    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'completed'],
      default: 'published',
      index: true,
    },
  },
  { timestamps: true }
);

CommunityEventSchema.index({ connectPageId: 1, status: 1, startsAt: 1 });

module.exports = mongoose.model('CommunityEvent', CommunityEventSchema);
