const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const OrderSchema = new Schema({
  userId: {
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  connectPageId: {
    type: Types.ObjectId,
    ref: 'ConnectPage',
    required: true,
    index: true
  },
  itemId: {
    type: Types.ObjectId,
    required: true
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  buyerName: {
    type: String,
    required: true,
    trim: true
  },
  buyerPhone: {
    type: String,
    required: true,
    trim: true
  },
  deliveryAddress: {
    type: String,
    required: true,
    trim: true
  },
  // Cashfree one-time payment fields
  cashfreeOrderId: {
    type: String,
    trim: true,
    index: true,
    sparse: true
  },
  paymentSessionId: {
    type: String,
    trim: true
  },
  cashfreePaymentId: {
    type: String,
    trim: true
  },
  cashfreeEnvironment: {
    type: String,
    enum: ['sandbox', 'production'],
    default: 'sandbox'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'completed'],
    default: 'pending',
    index: true
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
    index: true
  }
}, {
  timestamps: true
});

// Indexes for quick lookup
OrderSchema.index({ connectPageId: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);

