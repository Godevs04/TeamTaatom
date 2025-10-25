const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../environment.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const User = require('../src/models/User');
const Post = require('../src/models/Post');

async function seedTestData() {
  try {
    console.log('🌱 Starting to seed test data...');

    // Check if data already exists
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log(`ℹ️  Database already has ${userCount} users. Skipping seed.`);
      process.exit(0);
    }

    // Create test users
    const testUsers = await User.create([
      {
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        bio: 'Travel enthusiast from New York',
        location: 'New York, USA',
        isActive: true
      },
      {
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        bio: 'Adventure seeker and photographer',
        location: 'London, UK',
        isActive: true
      },
      {
        fullName: 'Mike Johnson',
        email: 'mike@example.com',
        password: 'password123',
        bio: 'World traveler and blogger',
        location: 'Sydney, Australia',
        isActive: true
      },
      {
        fullName: 'Sarah Williams',
        email: 'sarah@example.com',
        password: 'password123',
        bio: 'Digital nomad',
        location: 'Tokyo, Japan',
        isActive: false
      },
      {
        fullName: 'Tom Brown',
        email: 'tom@example.com',
        password: 'password123',
        bio: 'Backpacker and explorer',
        location: 'Paris, France',
        isActive: true
      }
    ]);

    console.log(`✅ Created ${testUsers.length} test users`);

    // Create test posts
    const testPosts = [];
    for (let i = 0; i < testUsers.length; i++) {
      for (let j = 0; j < 3; j++) {
        testPosts.push({
          user: testUsers[i]._id,
          caption: `Test post ${j + 1} from ${testUsers[i].fullName}`,
          content: `This is test content for post ${j + 1}`,
          location: testUsers[i].location,
          imageUrl: 'https://via.placeholder.com/600x400',
          type: 'post',
          likes: Math.floor(Math.random() * 100),
          comments: []
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

