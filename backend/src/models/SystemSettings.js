const mongoose = require('mongoose')

const systemSettingsSchema = new mongoose.Schema({
  // Security Settings
  security: {
    pinRequired: {
      type: Boolean,
      default: true
    },
    twoFactorAuth: {
      type: Boolean,
      default: false
    },
    sessionTimeout: {
      type: Number,
      default: 30,
      min: 5,
      max: 120
    },
    maxLoginAttempts: {
      type: Number,
      default: 5,
      min: 3,
      max: 10
    },
    passwordMinLength: {
      type: Number,
      default: 8,
      min: 6,
      max: 20
    },
    requireEmailVerification: {
      type: Boolean,
      default: true
    }
  },
  
  // Feature Toggles
  features: {
    userRegistration: {
      type: Boolean,
      default: true
    },
    contentModeration: {
      type: Boolean,
      default: true
    },
    locationTracking: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    },
    analyticsTracking: {
      type: Boolean,
      default: true
    },
    aiRecommendations: {
      type: Boolean,
      default: true
    },
    liveComments: {
      type: Boolean,
      default: true
    }
  },
  
  // System Settings
  system: {
    maintenanceMode: {
      type: Boolean,
      default: false
    },
    debugMode: {
      type: Boolean,
      default: false
    },
    logLevel: {
      type: String,
      enum: ['error', 'warn', 'info', 'debug'],
      default: 'info'
    },
    backupFrequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly', 'monthly'],
      default: 'daily'
    },
    autoBackup: {
      type: Boolean,
      default: true
    },
    maxFileSize: {
      type: Number,
      default: 10,
      min: 1,
      max: 100
    },
    allowedFileTypes: {
      type: [String],
      default: ['jpg', 'jpeg', 'png', 'mp4']
    }
  },
  
  // API Settings
  api: {
    rateLimitEnabled: {
      type: Boolean,
      default: true
    },
    rateLimitRequests: {
      type: Number,
      default: 1000,
      min: 100,
      max: 10000
    },
    rateLimitWindow: {
      type: Number,
      default: 3600,
      min: 60,
      max: 3600
    }
  },
  
  // Email Settings
  email: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    emailProvider: {
      type: String,
      default: 'smtp'
    },
    smtpHost: {
      type: String,
      default: 'smtp.gmail.com'
    },
    smtpPort: {
      type: Number,
      default: 587
    }
  },
  
  // Privacy Settings
  privacy: {
    dataRetentionDays: {
      type: Number,
      default: 90,
      min: 7,
      max: 365
    },
    gdprCompliance: {
      type: Boolean,
      default: true
    },
    shareAnalytics: {
      type: Boolean,
      default: false
    }
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SuperAdmin'
  },
  lastModifiedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Ensure only one settings document exists
systemSettingsSchema.statics.getInstance = async function() {
  let settings = await this.findOne()
  
  if (!settings) {
    settings = await this.create({})
  }
  
  return settings
}

module.exports = mongoose.model('SystemSettings', systemSettingsSchema)

