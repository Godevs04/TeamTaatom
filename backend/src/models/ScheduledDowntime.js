const mongoose = require('mongoose');

const scheduledDowntimeSchema = new mongoose.Schema({
  reason: {
    type: String,
    required: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1,
    max: 1440 // Maximum 24 hours
  },
  notificationSent: {
    type: Boolean,
    default: false
  },
  completed: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin'
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin'
  }
}, {
  timestamps: true
});

// Indexes
scheduledDowntimeSchema.index({ scheduledDate: 1 });
scheduledDowntimeSchema.index({ completed: 1 });
scheduledDowntimeSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ScheduledDowntime', scheduledDowntimeSchema);

