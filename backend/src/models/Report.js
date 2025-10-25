const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['inappropriate_content', 'spam', 'harassment', 'fake_account', 'other']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'under_review', 'resolved', 'dismissed'],
    default: 'pending'
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedContent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  adminNotes: {
    type: String,
    maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin'
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ type: 1, status: 1 });
reportSchema.index({ reportedBy: 1 });
reportSchema.index({ reportedUser: 1 });

module.exports = mongoose.model('Report', reportSchema);
