require('dotenv').config();

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const supertest = require('supertest');
const { app, dbConnectionPromise } = require('../src/app');

async function runTest() {
  console.log('Awaiting database connection...');
  await dbConnectionPromise;
  console.log('Database connected!');

  const userId = '69d5e62c72f8ead63512b963';
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
  console.log('Generated JWT token:', token);

  console.log('Sending multipart POST request to /api/v1/posts using supertest...');
  try {
    const response = await supertest(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Platform', 'mobile') // Skip CSRF
      .attach('images', Buffer.from('fake image data'), 'test_image.jpg')
      .field('caption', 'Hello World from Supertest #test')
      .field('address', 'Test Location')
      .field('latitude', '12.971598')
      .field('longitude', '77.594562')
      .field('source', 'manual_only');

    console.log('Response Status:', response.status);
    console.log('Response Headers:', response.headers);
    console.log('Response Body:', JSON.stringify(response.body, null, 2));
  } catch (error) {
    console.error('Supertest failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

runTest();
