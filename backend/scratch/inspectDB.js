require('dotenv').config();

// Force Node.js to use Google DNS to bypass ISP restrictions on SRV records (mongodb+srv)
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');

async function inspect() {
  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: process.env.MONGO_DB_NAME || 'Taatom'
    });
    console.log('Connected successfully!');

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));

    // Inspect the Post collection for recent posts
    const Post = mongoose.model('Post', new mongoose.Schema({}, { strict: false }));
    const recentPosts = await Post.find().sort({ createdAt: -1 }).limit(3).lean();
    console.log('Recent posts in DB:', JSON.stringify(recentPosts, null, 2));

    // Check if there are any error/audit logs or collections
    if (collections.some(c => c.name === 'activities')) {
      const Activity = mongoose.model('Activity', new mongoose.Schema({}, { strict: false }));
      const recentActivities = await Activity.find().sort({ createdAt: -1 }).limit(5).lean();
      console.log('Recent activities:', JSON.stringify(recentActivities, null, 2));
    }
  } catch (error) {
    console.error('Inspection failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

inspect();
