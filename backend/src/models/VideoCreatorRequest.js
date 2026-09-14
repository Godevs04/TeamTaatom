const mongoose = require('mongoose');

const auditEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'note'],
      required: true,
    },
    actorType: {
      type: String,
      enum: ['user', 'superadmin', 'system'],
      default: 'system',
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    actorLabel: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    contentNiche: { type: String, trim: true, maxlength: 40, default: '' },
    contentNicheOther: { type: String, trim: true, maxlength: 120, default: '' },
    experienceLevel: { type: String, trim: true, maxlength: 40, default: '' },
    sampleLinks: { type: String, trim: true, maxlength: 800, default: '' },
    postingFrequency: { type: String, trim: true, maxlength: 40, default: '' },
    audienceRegions: { type: String, trim: true, maxlength: 200, default: '' },
    equipment: { type: String, trim: true, maxlength: 200, default: '' },
    whyTaatom: { type: String, trim: true, maxlength: 500, default: '' },
    guidelinesAccepted: { type: Boolean, default: false },
    submittedAt: { type: Date, default: null },
  },
  { _id: false }
);

const videoCreatorRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Short summary / legacy free-text */
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    application: {
      type: applicationSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SuperAdmin',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    /** Admin note (approve optional; reject uses rejectionReason) */
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    auditLog: {
      type: [auditEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

videoCreatorRequestSchema.index({ status: 1, createdAt: -1 });
videoCreatorRequestSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('VideoCreatorRequest', videoCreatorRequestSchema);
