const mongoose = require('mongoose');
const path = require('path');
const FeatureFlag = require('../src/models/FeatureFlag');
require('dotenv').config({ path: path.join(__dirname, '../environment.env') });

const seedFeatureFlags = async () => {
  try {
    const mongoUri = process.env.MONGO_URL;
    if (!mongoUri) {
      throw new Error('MONGO_URL is not defined in environment.env');
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const flags = [
      {
        name: 'dark_mode',
        description: 'Enable dark mode for the application',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: 'all',
        category: 'ui',
        priority: 'high',
        impact: 'high'
      },
      {
        name: 'ai_recommendations',
        description: 'AI-powered content recommendations based on user behavior',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: 'beta',
        category: 'ai',
        priority: 'medium',
        impact: 'high'
      },
      {
        name: 'advanced_analytics',
        description: 'Advanced analytics dashboard for users',
        enabled: true,
        rolloutPercentage: 50,
        targetUsers: 'premium',
        category: 'analytics',
        priority: 'medium',
        impact: 'medium'
      },
      {
        name: 'story_feature',
        description: '24-hour story feature for users',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: 'beta',
        category: 'social',
        priority: 'high',
        impact: 'high'
      },
      {
        name: 'two_factor_auth',
        description: 'Two-factor authentication for enhanced security',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: 'all',
        category: 'security',
        priority: 'high',
        impact: 'high'
      },
      {
        name: 'live_location_sharing',
        description: 'Share live location with followers',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: 'premium',
        category: 'social',
        priority: 'low',
        impact: 'medium'
      },
      {
        name: 'video_calls',
        description: 'Face-to-face video calling feature',
        enabled: true,
        rolloutPercentage: 75,
        targetUsers: 'all',
        category: 'social',
        priority: 'medium',
        impact: 'high'
      },
      {
        name: 'content_filter',
        description: 'AI-powered content moderation',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: 'all',
        category: 'ai',
        priority: 'high',
        impact: 'high'
      }
    ];

    // Clear existing flags
    await FeatureFlag.deleteMany({});
    console.log('Cleared existing feature flags');

    // Insert new flags
    const createdFlags = await FeatureFlag.insertMany(flags);
    console.log(`Created ${createdFlags.length} feature flags`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding feature flags:', error);
    process.exit(1);
  }
};

seedFeatureFlags();

