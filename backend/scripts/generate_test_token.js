const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../environment.env') });

// Import models
const SuperAdmin = require('../src/models/SuperAdmin');

const generateTestToken = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: 'Taatom'
    });
    console.log('✅ Connected to MongoDB');

    // Find the first SuperAdmin
    const superAdmin = await SuperAdmin.findOne({ isActive: true });
    
    if (!superAdmin) {
      console.log('❌ No active SuperAdmin found!');
      return;
    }

    console.log(`📊 Found SuperAdmin: ${superAdmin.email}`);

    // Generate a test token (bypass 2FA for testing)
    const testToken = jwt.sign(
      { 
        id: superAdmin._id, 
        email: superAdmin.email 
      },
      process.env.JWT_SECRET || 'superadmin_secret_key',
      { expiresIn: '24h' }
    );

    console.log('\n🔑 Test Token Generated:');
    console.log(testToken);
    console.log('\n📝 Instructions:');
    console.log('1. Open your SuperAdmin panel in the browser');
    console.log('2. Open Developer Tools (F12)');
    console.log('3. Go to Application/Storage tab');
    console.log('4. Find localStorage and add a new item:');
    console.log('   Key: founder_token');
    console.log('   Value: [paste the token above]');
    console.log('5. Refresh the page');

  } catch (error) {
    console.error('❌ Error generating test token:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
};

// Run the token generation
generateTestToken();
