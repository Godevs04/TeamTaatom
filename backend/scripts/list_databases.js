const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://Kavin_14:1421Kavin@godevs.cfgexon.mongodb.net/Taatom?retryWrites=true&w=majority';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUrl);
    console.log('Connected!');

    const adminDb = mongoose.connection.client.db().admin();
    const dbs = await adminDb.listDatabases();
    console.log('Databases in cluster:');
    console.log(JSON.stringify(dbs.databases, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
