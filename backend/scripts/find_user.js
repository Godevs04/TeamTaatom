const mongoose = require('mongoose');
const User = require('../src/models/User');

const mongoUrl = 'mongodb+srv://Kavin_14:1421Kavin@godevs.cfgexon.mongodb.net/Taatom?retryWrites=true&w=majority';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUrl);
    console.log('Connected!');

    const email = '727721eumt032@skcet.ac.in';
    const user = await User.findOne({ email }).lean();
    console.log('User found:', JSON.stringify(user, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
