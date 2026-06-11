const mongoose = require('mongoose');
const User = require('../src/models/User');

const mongoUrl = 'mongodb+srv://Kavin_14:1421Kavin@godevs.cfgexon.mongodb.net/Taatom?retryWrites=true&w=majority';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUrl);
    console.log('Connected!');

    const count = await User.countDocuments();
    console.log(`Total users: ${count}`);

    // Print all users (only username, email, isVerified, googleId, createdAt)
    const users = await User.find({}, 'username email isVerified googleId createdAt').lean();
    console.log('Users:');
    console.log(JSON.stringify(users, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
