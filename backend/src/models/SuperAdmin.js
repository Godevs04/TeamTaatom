const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const superAdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    default: 'founder',
    enum: ['founder', 'admin', 'moderator']
  },
  organization: {
    type: String,
    default: 'TeamTaatom'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  securitySettings: {
    twoFactorEnabled: {
      type: Boolean,
      default: true, // Always enabled for SuperAdmin
      immutable: true // Cannot be changed
    },
    sessionTimeout: {
      type: Number,
      default: 30 // minutes
    },
    maxLoginAttempts: {
      type: Number,
      default: 5
    },
    lockoutDuration: {
      type: Number,
      default: 15 // minutes
    }
  },
  twoFactorAuth: {
    secret: String,
    backupCodes: [String],
    isEnabled: {
      type: Boolean,
      default: true,
      immutable: true // Cannot be disabled for SuperAdmin
    }
  },
  tempAuth: {
    token: String,
    expiresAt: Date,
    attempts: {
      type: Number,
      default: 0
    }
  },
  permissions: {
    canManageUsers: {
      type: Boolean,
      default: true
    },
    canManageContent: {
      type: Boolean,
      default: true
    },
    canViewAnalytics: {
      type: Boolean,
      default: true
    },
    canManageModerators: {
      type: Boolean,
      default: true
    },
    canViewLogs: {
      type: Boolean,
      default: true
    },
    canManageSettings: {
      type: Boolean,
      default: true
    }
  },
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    phone: String,
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  securityLogs: [{
    action: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    success: {
      type: Boolean,
      default: true
    },
    details: String
  }]
}, {
  timestamps: true
})

// Index for performance
superAdminSchema.index({ email: 1 })
superAdminSchema.index({ role: 1 })
superAdminSchema.index({ isActive: 1 })
superAdminSchema.index({ 'securityLogs.timestamp': -1 })

// Virtual for account lock status
superAdminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now())
})

// Pre-save middleware to hash password
superAdminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  
  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Method to compare password
superAdminSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

// Method to generate JWT token
superAdminSchema.methods.generateAuthToken = function() {
  const payload = {
    id: this._id,
    email: this.email,
    role: this.role,
    permissions: this.permissions
  }
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'superadmin_secret_key', {
    expiresIn: '24h',
    issuer: 'taatom-superadmin',
    audience: 'taatom-founders'
  })
}

// Method to log security events
superAdminSchema.methods.logSecurityEvent = function(action, details = '', ipAddress = '', userAgent = '', success = true) {
  const newLog = {
    action,
    details,
    ipAddress,
    userAgent,
    success,
    timestamp: new Date()
  }
  
  // Use updateOne to avoid parallel save conflicts
  return this.updateOne({
    $push: { securityLogs: newLog },
    $slice: { securityLogs: -100 } // Keep only last 100 security logs
  })
}

// Method to handle failed login attempts
superAdminSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    })
  }
  
  const updates = { $inc: { loginAttempts: 1 } }
  
  // Lock account after max attempts
  if (this.loginAttempts + 1 >= this.securitySettings.maxLoginAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + this.securitySettings.lockoutDuration * 60 * 1000 }
  }
  
  return this.updateOne(updates)
}

// Method to reset login attempts
superAdminSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  })
}

// Static method to find by email
superAdminSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true })
}

// Method to generate 2FA OTP
superAdminSchema.methods.generateOTP = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  
  this.tempAuth = {
    token: otp,
    expiresAt,
    attempts: 0
  }
  
  return { otp, expiresAt }
}

// Method to verify 2FA OTP
superAdminSchema.methods.verifyOTP = function(inputOTP) {
  if (!this.tempAuth || !this.tempAuth.token) {
    return { valid: false, message: 'No OTP found' }
  }
  
  if (this.tempAuth.expiresAt < new Date()) {
    return { valid: false, message: 'OTP expired' }
  }
  
  if (this.tempAuth.attempts >= 3) {
    return { valid: false, message: 'Too many attempts' }
  }
  
  if (this.tempAuth.token !== inputOTP) {
    this.tempAuth.attempts += 1
    this.save()
    return { valid: false, message: 'Invalid OTP' }
  }
  
  // Clear temp auth on successful verification
  this.tempAuth = undefined
  this.save()
  
  return { valid: true, message: 'OTP verified' }
}

// Method to generate temporary token for 2FA
superAdminSchema.methods.generateTempToken = function() {
  const payload = { 
    id: this._id, 
    email: this.email,
    temp: true 
  }
  
  const tempToken = jwt.sign(
    payload, 
    process.env.JWT_SECRET || 'superadmin_secret_key', 
    { expiresIn: '10m' }
  )
  
  return tempToken
}

// Static method to create founder account
superAdminSchema.statics.createFounder = async function(email, password, organization = 'TeamTaatom') {
  const founder = new this({
    email: email.toLowerCase(),
    password,
    role: 'founder',
    organization,
    securitySettings: {
      twoFactorEnabled: true, // Always enabled
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      lockoutDuration: 15
    },
    twoFactorAuth: {
      isEnabled: true // Always enabled
    },
    permissions: {
      canManageUsers: true,
      canManageContent: true,
      canViewAnalytics: true,
      canManageModerators: true,
      canViewLogs: true,
      canManageSettings: true
    }
  })
  
  await founder.save()
  return founder
}

module.exports = mongoose.model('SuperAdmin', superAdminSchema)
