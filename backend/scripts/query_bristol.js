const mongoose = require('mongoose');

const mongoUrl = 'mongodb+srv://Kavin_14:1421Kavin@godevs.cfgexon.mongodb.net/Taatom?retryWrites=true&w=majority';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUrl);
    console.log('Connected!');

    const db = mongoose.connection.db;
    const localesCol = db.collection('locales');

    const gbDocs = await localesCol.find({ countryCode: 'GB' }).toArray();
    console.log(`Total GB documents in 'locales' collection: ${gbDocs.length}`);
    console.log(JSON.stringify(gbDocs, null, 2));

    const nonInDocs = await localesCol.find({ countryCode: { $ne: 'IN' } }).toArray();
    console.log(`Total non-IN documents in 'locales' collection: ${nonInDocs.length}`);
    console.log(JSON.stringify(nonInDocs, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
