const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../environment.env') });

// Import models
const SuperAdmin = require('../src/models/SuperAdmin');

const checkSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: 'Taatom'
    });
    console.log('✅ Connected to MongoDB');

    // Check SuperAdmin accounts
    const superAdmins = await SuperAdmin.find({});
    console.log(`📊 Found ${superAdmins.length} SuperAdmin accounts:`);
    
    superAdmins.forEach((admin, index) => {
      console.log(`\n${index + 1}. SuperAdmin Account:`);
      console.log(`   - Email: ${admin.email}`);
      console.log(`   - Full Name: ${admin.fullName}`);
      console.log(`   - isActive: ${admin.isActive}`);
      console.log(`   - isLocked: ${admin.isLocked}`);
      console.log(`   - Created: ${admin.createdAt}`);
      console.log(`   - Last Login: ${admin.lastLogin || 'Never'}`);
    });

    if (superAdmins.length === 0) {
      console.log('\n❌ No SuperAdmin accounts found!');
      console.log('You need to create a SuperAdmin account first.');
    }

  } catch (error) {
    console.error('❌ Error checking SuperAdmin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
};

// Run the check
checkSuperAdmin();
