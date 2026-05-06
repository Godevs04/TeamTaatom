const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ContentBlockSchema = new Schema({
  type: {
    type: String,
    enum: ['heading', 'text', 'image', 'video', 'button', 'divider', 'embed'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  // Button block: label stored in content, url here
  url: {
    type: String,
    default: ''
  },
  // Embed block: embed type (youtube, map, etc.)
  embedType: {
    type: String,
    enum: ['youtube', 'map', 'custom', ''],
    default: ''
  }
}, { _id: true });

const CanvasElementSchema = new Schema({
  type: {
    type: String,
    enum: ['text', 'image', 'video'],
    required: true
  },
  // text: the string. image/video: storage key (or signed URL transiently from client).
  content: {
    type: String,
    required: true
  },
  // Position/size are normalized to the 9:16 frame: 0..1 of frame width / height.
  x: { type: Number, default: 0.5 },
  y: { type: Number, default: 0.5 },
  w: { type: Number, default: 0.4 },
  h: { type: Number, default: 0.25 },
  rotation: { type: Number, default: 0 },
  zIndex: { type: Number, default: 0 },
  // Text-only styling
  fontSize: { type: Number, default: 24 },
  color: { type: String, default: '#FFFFFF' },
  fontWeight: { type: String, default: '600' },
  backgroundColor: { type: String, default: 'transparent' }
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
  canvasContent: [CanvasElementSchema],
  canvasBackground: {
    type: String,
    default: '#000000'
  },
  subscriptionPrice: {
    type: Number,
    default: null
  },
  subscriptionCurrency: {
    type: String,
    default: 'INR'
  },
  // Admin approval for subscription pricing
  subscriptionApproval: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    },
    requestedPrice: {
      type: Number,
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      default: ''
    },
    reviewedBy: {
      type: Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  // Creator payout details
  creatorPayoutInfo: {
    country: {
      type: String,
      default: 'IN'  // ISO country code
    },
    isInternational: {
      type: Boolean,
      default: false
    },
    // Bank details for domestic (India) payouts via Cashfree
    bankAccountNumber: { type: String, default: '' },
    bankIfsc: { type: String, default: '' },
    bankAccountName: { type: String, default: '' },
    upiId: { type: String, default: '' },
    // Wise details for international payouts
    wiseEmail: { type: String, default: '' },
    wiseCurrency: { type: String, default: 'USD' }
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
