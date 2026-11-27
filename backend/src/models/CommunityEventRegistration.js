const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const CommunityEventRegistrationSchema = new Schema(
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
    mode: {
      type: String,
      enum: ['individual', 'team'],
      required: true,
    },
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    teamId: {
      type: Types.ObjectId,
      ref: 'CommunityEventTeam',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'waitlisted'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

CommunityEventRegistrationSchema.index(
  { eventId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
);
CommunityEventRegistrationSchema.index(
  { eventId: 1, teamId: 1 },
  { unique: true, partialFilterExpression: { teamId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('CommunityEventRegistration', CommunityEventRegistrationSchema);
