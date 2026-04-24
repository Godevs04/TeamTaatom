const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ContentBlockSchema = new Schema({
  type: {
    type: String,
    enum: ['heading', 'text', 'image', 'video'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true
  }
}, { _id: true });

const BuyItemSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Item name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Item description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  imageUrl: {
    type: String,
    default: ''
  },
  active: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const ConnectPageSchema = new Schema({
  userId: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Connect page name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  type: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  profileImage: {
    type: String,
    default: ''
  },
  bannerImage: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [250, 'Bio cannot exceed 250 characters'],
    default: ''
  },
  features: {
    website: { type: Boolean, default: false },
    groupChat: { type: Boolean, default: false },
    subscription: { type: Boolean, default: false }
  },
  websiteContent: [ContentBlockSchema],
  subscriptionContent: [ContentBlockSchema],
  subscriptionPrice: {
    type: Number,
    min: [100, 'Minimum subscription price is ₹100'],
    max: [10000, 'Maximum subscription price is ₹10,000'],
    default: null
  },
  chatRoomId: {
    type: Types.ObjectId,
    ref: 'Chat',
    default: null
  },
  followerCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  },
  isAdminPage: {
    type: Boolean,
    default: false
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  buyItems: {
    type: [BuyItemSchema],
    validate: {
      validator: function(items) {
        return items.length <= 5;
      },
      message: 'Cannot have more than 5 buy items'
    }
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'suspended'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes
ConnectPageSchema.index({ type: 1, status: 1, isAdminPage: 1 });
ConnectPageSchema.index({ isDefault: 1 });
ConnectPageSchema.index({ name: 'text' });
ConnectPageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ConnectPage', ConnectPageSchema);
