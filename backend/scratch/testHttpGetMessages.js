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

  console.log('\n--- 1. Fetching Chat List ---');
  try {
    const listResponse = await supertest(app)
      .get('/api/v1/chat')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Platform', 'mobile');

    console.log('Chat List Status:', listResponse.status);
    console.log('Chat List Body:', JSON.stringify(listResponse.body, null, 2));

    const chats = listResponse.body.chats || [];
    if (chats.length > 0) {
      const chat = chats[0];
      const otherParticipant = chat.participants.find(p => p._id !== userId);
      const otherUserId = otherParticipant ? otherParticipant._id : null;

      if (otherUserId) {
        console.log(`\n--- 2. Fetching Messages for user ${otherUserId} ---`);
        const messagesResponse = await supertest(app)
          .get(`/api/v1/chat/${otherUserId}/messages`)
          .set('Authorization', `Bearer ${token}`)
          .set('X-Platform', 'mobile');

        console.log('Messages Status:', messagesResponse.status);
        console.log('Messages Body:', JSON.stringify(messagesResponse.body, null, 2));
      } else {
        console.log('No other participant found in chat to fetch messages for');
      }
    } else {
      console.log('No chats found in chat list');
    }
  } catch (error) {
    console.error('Supertest failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

runTest();
