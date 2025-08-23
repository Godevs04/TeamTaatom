// Usage: node backend/scripts/migrate_add_message_ids.js
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const path = require('path');
// const Chat = require(path.join(__dirname, '../models/Chat'));
const Chat = require(path.join(__dirname, '../src/models/Chat'));
require('dotenv').config({ path: '../environment.env' });

async function migrate() {
  await mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  const chats = await Chat.find();
  let updatedCount = 0;
  for (const chat of chats) {
    let updated = false;
    chat.messages.forEach((msg) => {
      if (!msg._id) {
        msg._id = new ObjectId();
        updated = true;
      }
      if (msg.seen === undefined) {
        msg.seen = false;
        updated = true;
      }
    });
    if (updated) {
      await chat.save();
      updatedCount++;
      console.log(`Updated chat ${chat._id}`);
    }
  }
  console.log(`Migration complete. Updated ${updatedCount} chats.`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
