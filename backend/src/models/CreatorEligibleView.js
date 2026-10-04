const mongoose = require('mongoose');

const creatorEligibleViewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  viewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  monthKey: { type: String, required: true },
}, { timestamps: true });

creatorEligibleViewSchema.index({ viewer: 1, post: 1 }, { unique: true });
creatorEligibleViewSchema.index({ user: 1, monthKey: 1 });
creatorEligibleViewSchema.index({ post: 1 });

module.exports = mongoose.model('CreatorEligibleView', creatorEligibleViewSchema);
