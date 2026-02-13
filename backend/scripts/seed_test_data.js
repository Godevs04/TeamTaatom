const mongoose = require('mongoose');
const path = require('path');

// Load env: try .env first, then environment.env
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../environment.env') });

const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || process.env.DATABASE_URI;
if (!mongoUri) {
  console.error('❌ No MongoDB URI found. Set MONGO_URL in backend/.env');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const User = require('../src/models/User');
const Post = require('../src/models/Post');

async function seedTestData() {
  try {
    console.log('🌱 Starting to seed test data (Apple 1.2 UGC demo)...');

    // Check if data already exists
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log(`ℹ️  Database already has ${userCount} users. Skipping seed.`);
      process.exit(0);
    }

    const testUsers = await User.create([
      { fullName: 'John Doe', username: 'johndoe', email: 'john@example.com', password: 'Password1!', bio: 'Travel enthusiast', termsAcceptedAt: new Date(), isVerified: true },
      { fullName: 'Jane Smith', username: 'janesmith', email: 'jane@example.com', password: 'Password1!', bio: 'Adventure seeker', termsAcceptedAt: new Date(), isVerified: true },
      { fullName: 'Mike Johnson', username: 'mikejohnson', email: 'mike@example.com', password: 'Password1!', bio: 'World traveler', termsAcceptedAt: new Date(), isVerified: true }
    ]);
    console.log(`✅ Created ${testUsers.length} test users (sign in: any email above + Password1!)`);

    const testPosts = [];
    for (const u of testUsers) {
      for (let j = 0; j < 2; j++) {
        testPosts.push({
          user: u._id,
          caption: `Test post ${j + 1} from ${u.fullName}`,
          imageUrl: 'https://picsum.photos/600/400',
          type: 'photo',
          location: { address: 'Unknown Location', coordinates: { latitude: 0, longitude: 0 } },
          status: 'active'
        });
      }
    }
    const createdPosts = await Post.create(testPosts);
    console.log(`✅ Created ${createdPosts.length} test posts`);

    console.log('🎉 Test data seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Users: ${testUsers.length}`);
    console.log(`   - Posts: ${createdPosts.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    process.exit(1);
  }
}

seedTestData();

