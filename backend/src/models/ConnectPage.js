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
    default: ''
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
  },
  // Layout: 12-column grid width. 12 = full row, 6 = half, 4 = third.
  // Adjacent blocks whose cols sum to <= 12 are packed into the same row
  // by the renderer. Defaults to full-width so existing rows keep their
  // current single-column-per-row layout.
  col: {
    type: Number,
    default: 12,
    min: 1,
    max: 12
  },
  // Per-block color overrides. Empty string ('') means "inherit from the
  // page-level color"; a non-empty CSS color string overrides it.
  backgroundColor: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: ''
  },
  // Bold text override. true = heavier weight on render (heading: '800', text: '700').
  bold: {
    type: Boolean,
    default: false
  },
  // Text alignment for heading/text blocks.
  align: {
    type: String,
    enum: ['left', 'center', 'right', ''],
    default: ''
  },
  // Font size tier for heading/text blocks.
  fontSize: {
    type: String,
    enum: ['small', 'normal', 'large', ''],
    default: ''
  },
  // Stacked: block joins the last column of the previous row (mosaic layout).
  stacked: {
    type: Boolean,
    default: false
  },
  // Padding tier per block (controls inner spacing).
  padding: {
    type: String,
    enum: ['none', 'small', 'medium', 'large', ''],
    default: ''
  },
  // Border radius tier per block.
  borderRadius: {
    type: String,
    enum: ['none', 'small', 'medium', 'large', ''],
    default: ''
  },
  // Image aspect ratio override.
  aspectRatio: {
    type: String,
    enum: ['original', 'square', 'landscape', 'portrait', ''],
    default: ''
  },
  // Vertical alignment when block is in a multi-column row.
  verticalAlign: {
    type: String,
    enum: ['top', 'center', 'bottom', ''],
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
  category: {
    type: String,
    enum: ['connect', 'community'],
    default: 'connect'
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
  // Page-level color defaults. Apply when a block has no per-block override.
  // Empty string means "use the app's theme default" so unmigrated pages
  // continue to render exactly as before.
  websiteBackground: { type: String, default: '' },
  websiteTextColor: { type: String, default: '' },
  subscriptionBackground: { type: String, default: '' },
  subscriptionTextColor: { type: String, default: '' },
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
ConnectPageSchema.index({ category: 1, status: 1 });
ConnectPageSchema.index({ isDefault: 1 });
ConnectPageSchema.index({ name: 'text' });
ConnectPageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ConnectPage', ConnectPageSchema);
