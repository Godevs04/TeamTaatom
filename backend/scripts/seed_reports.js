const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../environment.env') });

// Import models
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Report = require('../src/models/Report');

const seedReports = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: 'Taatom'
    });
    console.log('✅ Connected to MongoDB');

    // Get some users and posts to create reports
    const users = await User.find().limit(3);
    const posts = await Post.find().limit(3);

    if (users.length === 0 || posts.length === 0) {
      console.log('❌ No users or posts found. Please seed users and posts first.');
      return;
    }

    // Clear existing reports
    await Report.deleteMany({});
    console.log('🗑️  Cleared existing reports');

    // Create test reports
    const reports = [
      {
        type: 'inappropriate_content',
        status: 'pending',
        reportedBy: users[0]._id,
        reportedContent: posts[0]._id,
        reportedUser: posts[0].user,
        reason: 'Contains inappropriate language and offensive content',
        priority: 'high'
      },
      {
        type: 'spam',
        status: 'under_review',
        reportedBy: users[1]._id,
        reportedContent: posts[1]._id,
        reportedUser: posts[1].user,
        reason: 'Repeated spam posts with promotional content',
        priority: 'medium'
      },
      {
        type: 'harassment',
        status: 'resolved',
        reportedBy: users[2]._id,
        reportedContent: posts[2]._id,
        reportedUser: posts[2].user,
        reason: 'Harassing behavior and personal attacks',
        priority: 'critical',
        adminNotes: 'Content removed and user warned',
        resolvedAt: new Date()
      },
      {
        type: 'fake_account',
        status: 'dismissed',
        reportedBy: users[0]._id,
        reportedContent: posts[0]._id,
        reportedUser: posts[0].user,
        reason: 'Suspected fake account with stolen photos',
        priority: 'low',
        adminNotes: 'Account verified as legitimate',
        resolvedAt: new Date()
      }
    ];

    // Insert reports
    const createdReports = await Report.insertMany(reports);
    console.log(`✅ Created ${createdReports.length} test reports`);

    console.log('🎉 Reports seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding reports:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
};

// Run the seeding
seedReports();
