const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [false, 'Full name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  bio: {
    type: String,
    required: false,
    trim: true,
    maxlength: [300, 'Bio cannot exceed 300 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true // allows multiple null values
  },
  profilePic: {
    type: String,
    default: ''
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followRequests: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  sentFollowRequests: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  totalLikes: {
    type: Number,
    default: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String,
    default: null
  },
  otpExpires: {
    type: Date,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  code: {
      type: String,
      required: false
  },
  resetToken: {
      type: String,
      required: false
  },
  resetTokenExpiry: {
      type: Date,
      required: false
  },
  expoPushToken: {
      type: String,
      required: false,
      default: null
  },
  settings: {
    privacy: {
      profileVisibility: {
        type: String,
        enum: ['public', 'followers', 'private'],
        default: 'public'
      },
      showEmail: {
        type: Boolean,
        default: false
      },
      showLocation: {
        type: Boolean,
        default: true
      },
      allowMessages: {
        type: String,
        enum: ['everyone', 'followers', 'none'],
        default: 'everyone'
      },
      requireFollowApproval: {
        type: Boolean,
        default: false
      },
      allowFollowRequests: {
        type: Boolean,
        default: true
      }
    },
    notifications: {
      pushNotifications: {
        type: Boolean,
        default: true
      },
      emailNotifications: {
        type: Boolean,
        default: true
      },
      likesNotifications: {
        type: Boolean,
        default: true
      },
      commentsNotifications: {
        type: Boolean,
        default: true
      },
      followsNotifications: {
        type: Boolean,
        default: true
      },
      messagesNotifications: {
        type: Boolean,
        default: true
      },
      followRequestNotifications: {
        type: Boolean,
        default: true
      },
      followApprovalNotifications: {
        type: Boolean,
        default: true
      }
    },
    account: {
      language: {
        type: String,
        default: 'en'
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto'
      },
      dataUsage: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      }
    }
  }
}, {
  timestamps: true
});

// Email is already indexed via unique: true property

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP method
userSchema.methods.generateOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = otp;
  this.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return otp;
};

// Verify OTP method
userSchema.methods.verifyOTP = function(candidateOTP) {
  if (!this.otp || !this.otpExpires) return false;
  if (this.otpExpires < new Date()) return false;
  return this.otp === candidateOTP;
};

// Clear OTP method
userSchema.methods.clearOTP = function() {
  this.otp = null;
  this.otpExpires = null;
};

// Get public profile
userSchema.methods.getPublicProfile = function() {
  return {
    _id: this._id,
    fullName: this.fullName,
    bio: this.bio,
    email: this.email,
    profilePic: this.profilePic,
    followers: this.followers.length,
    following: this.following.length,
    totalLikes: this.totalLikes,
    isVerified: this.isVerified,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('User', userSchema);
