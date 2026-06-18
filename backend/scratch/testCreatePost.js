require('dotenv').config();

// Force Node.js to use Google DNS to bypass ISP restrictions on SRV records (mongodb+srv)
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const { createPost } = require('../src/controllers/postController');

async function test() {
  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      dbName: process.env.MONGO_DB_NAME || 'Taatom'
    });
    console.log('Connected successfully!');

    // Mock request
    const req = {
      user: { _id: new mongoose.Types.ObjectId('69d5e62c72f8ead63512b963') },
      files: {
        images: [
          {
            buffer: Buffer.from('fake image data'),
            originalname: 'fake_image.jpg',
            mimetype: 'image/jpeg'
          }
        ]
      },
      body: {
        caption: 'Hello World #test',
        address: 'Test Location',
        latitude: '12.971598',
        longitude: '77.594562',
        source: 'manual_only'
      }
    };

    // Mock response
    const res = {
      status(code) {
        console.log(`Response Status: ${code}`);
        return this;
      },
      json(data) {
        console.log('Response JSON:', JSON.stringify(data, null, 2));
        return this;
      }
    };

    console.log('Calling createPost controller directly...');
    await createPost(req, res);

  } catch (error) {
    console.error('TEST CAUGHT CRASH:', error);
  } finally {
    await mongoose.connection.close();
  }
}

test();
