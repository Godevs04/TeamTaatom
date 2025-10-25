const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../environment.env') });

// Import models
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');
const Notification = require('../src/models/Notification');
const Chat = require('../src/models/Chat');
const Report = require('../src/models/Report');
const SuperAdmin = require('../src/models/SuperAdmin');

const seedComprehensiveData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: 'Taatom'
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing data...');
    await Comment.deleteMany({});
    await Notification.deleteMany({});
    await Chat.deleteMany({});
    await Report.deleteMany({});
    console.log('✅ Cleared existing data');

    // Get existing users
    const users = await User.find({});
    console.log(`📊 Found ${users.length} existing users`);

    if (users.length === 0) {
      console.log('❌ No users found. Please seed users first.');
      return;
    }

    // 1. Create Comments for Posts
    console.log('💬 Creating comments...');
    const posts = await Post.find({}).limit(10);
    const comments = [];
    
    for (let i = 0; i < 20; i++) {
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const randomPost = posts[Math.floor(Math.random() * posts.length)];
      
      const comment = new Comment({
        text: `This is a sample comment ${i + 1}. Great post!`,
        post: randomPost._id,
        user: randomUser._id,
        likes: users.slice(0, Math.floor(Math.random() * 3)).map(u => u._id)
      });
      
      comments.push(comment);
    }
    
    await Comment.insertMany(comments);
    console.log(`✅ Created ${comments.length} comments`);

    // 2. Create Notifications
    console.log('🔔 Creating notifications...');
    const notifications = [];
    const notificationTypes = ['like', 'comment', 'follow', 'follow_request', 'follow_approved', 'post_mention'];
    
    for (let i = 0; i < 50; i++) {
      const fromUser = users[Math.floor(Math.random() * users.length)];
      const toUser = users[Math.floor(Math.random() * users.length)];
      const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
      const randomPost = posts[Math.floor(Math.random() * posts.length)];
      
      if (fromUser._id.toString() !== toUser._id.toString()) {
        const notification = new Notification({
          type,
          fromUser: fromUser._id,
          toUser: toUser._id,
          post: type === 'like' || type === 'comment' ? randomPost._id : undefined,
          isRead: Math.random() > 0.5,
          metadata: {
            message: `User ${fromUser.fullName} ${type}ed your content`
          }
        });
        
        notifications.push(notification);
      }
    }
    
    await Notification.insertMany(notifications);
    console.log(`✅ Created ${notifications.length} notifications`);

    // 3. Create Chats
    console.log('💬 Creating chats...');
    const chats = [];
    
    for (let i = 0; i < 15; i++) {
      const user1 = users[Math.floor(Math.random() * users.length)];
      let user2 = users[Math.floor(Math.random() * users.length)];
      
      // Ensure different users
      while (user1._id.toString() === user2._id.toString()) {
        user2 = users[Math.floor(Math.random() * users.length)];
      }
      
      const chat = new Chat({
        participants: [user1._id, user2._id],
        messages: [
          {
            sender: user1._id,
            text: `Hello! This is message ${i + 1}`,
            timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            seen: Math.random() > 0.3
          },
          {
            sender: user2._id,
            text: `Hi there! Thanks for the message.`,
            timestamp: new Date(Date.now() - Math.random() * 6 * 24 * 60 * 60 * 1000),
            seen: Math.random() > 0.3
          }
        ]
      });
      
      chats.push(chat);
    }
    
    await Chat.insertMany(chats);
    console.log(`✅ Created ${chats.length} chats`);

    // 4. Create Reports
    console.log('🚨 Creating reports...');
    const reports = [];
    const reportTypes = ['inappropriate_content', 'spam', 'harassment', 'fake_account', 'other'];
    const reportStatuses = ['pending', 'under_review', 'resolved', 'dismissed'];
    const priorities = ['low', 'medium', 'high', 'critical'];
    
    for (let i = 0; i < 25; i++) {
      const reporter = users[Math.floor(Math.random() * users.length)];
      const reportedUser = users[Math.floor(Math.random() * users.length)];
      const reportedPost = posts[Math.floor(Math.random() * posts.length)];
      const type = reportTypes[Math.floor(Math.random() * reportTypes.length)];
      const status = reportStatuses[Math.floor(Math.random() * reportStatuses.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      
      if (reporter._id.toString() !== reportedUser._id.toString()) {
        const report = new Report({
          type,
          status,
          reportedBy: reporter._id,
          reportedContent: reportedPost._id,
          reportedUser: reportedUser._id,
          reason: `This content violates our community guidelines. Report #${i + 1}`,
          priority,
          adminNotes: status === 'resolved' ? 'Content reviewed and action taken' : undefined,
          resolvedAt: status === 'resolved' ? new Date() : undefined
        });
        
        reports.push(report);
      }
    }
    
    await Report.insertMany(reports);
    console.log(`✅ Created ${reports.length} reports`);

    // 5. Update User statistics
    console.log('📊 Updating user statistics...');
    for (const user of users) {
      const userPosts = await Post.countDocuments({ user: user._id });
      const userComments = await Comment.countDocuments({ user: user._id });
      const userLikes = await Comment.countDocuments({ likes: user._id });
      
      user.totalLikes = userLikes;
      await user.save();
    }
    console.log('✅ Updated user statistics');

    // 6. Create some sample analytics data by updating posts with more realistic data
    console.log('📈 Creating analytics data...');
    const allPosts = await Post.find({});
    for (const post of allPosts) {
      // Add some random likes
      const randomLikes = Math.floor(Math.random() * 20);
      post.likes = users.slice(0, randomLikes).map(u => u._id);
      
      // Add some embedded comments
      const randomCommentCount = Math.floor(Math.random() * 5);
      for (let i = 0; i < randomCommentCount; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        post.comments.push({
          user: randomUser._id,
          text: `This is a sample comment ${i + 1} on this post.`,
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
        });
      }
      
      await post.save();
    }
    console.log('✅ Created analytics data');

    console.log('\n🎉 Comprehensive data seeding completed successfully!');
    console.log('\n📊 Final Statistics:');
    console.log(`Users: ${await User.countDocuments()}`);
    console.log(`Posts: ${await Post.countDocuments()}`);
    console.log(`Comments: ${await Comment.countDocuments()}`);
    console.log(`Notifications: ${await Notification.countDocuments()}`);
    console.log(`Chats: ${await Chat.countDocuments()}`);
    console.log(`Reports: ${await Report.countDocuments()}`);

  } catch (error) {
    console.error('❌ Error seeding comprehensive data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
};

// Run the seeding
seedComprehensiveData();
