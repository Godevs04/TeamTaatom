/* eslint-disable no-console */
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from environment.env or .env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', 'environment.env') });

const Like = require('../src/models/Like');
const Follow = require('../src/models/Follow');

async function migrate() {
  const uri = process.env.MONGO_URL || process.env.DATABASE_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taatom';
  console.log('Connecting to database:', uri.replace(/:([^:@]+)@/, ':***@')); // Hide password in logs

  await mongoose.connect(uri, { autoIndex: true });
  console.log('Connected to MongoDB successfully.');

  const db = mongoose.connection.db;

  // 1. Migrate Post likes
  console.log('\n--- Migrating Post Likes ---');
  const posts = await db.collection('posts').find({}).toArray();
  console.log(`Found ${posts.length} total posts.`);

  let postsLikesCount = 0;
  for (const post of posts) {
    // Check if the legacy likes array exists on the document
    const likes = post.likes;
    if (Array.isArray(likes) && likes.length > 0) {
      console.log(`Migrating ${likes.length} likes for post: ${post._id}`);
      for (const userId of likes) {
        if (userId) {
          try {
            await Like.updateOne(
              { post: post._id, user: userId },
              { $setOnInsert: { post: post._id, user: userId } },
              { upsert: true }
            );
          } catch (err) {
            console.error(`Error migrating like for post ${post._id}, user ${userId}:`, err.message);
          }
        }
      }
      postsLikesCount += likes.length;
    }

    // Set likesCount and unset legacy likes array
    const actualLikesCount = await Like.countDocuments({ post: post._id });
    await db.collection('posts').updateOne(
      { _id: post._id },
      { 
        $set: { likesCount: actualLikesCount },
        $unset: { likes: '' }
      }
    );
  }
  console.log(`Migrated ${postsLikesCount} likes into Like collection.`);

  // 2. Migrate User followers/following
  console.log('\n--- Migrating User Followers and Following ---');
  const users = await db.collection('users').find({}).toArray();
  console.log(`Found ${users.length} total users.`);

  let followersCountTotal = 0;
  let followingCountTotal = 0;

  for (const user of users) {
    // Migrate followers array
    const followers = user.followers;
    if (Array.isArray(followers) && followers.length > 0) {
      console.log(`Migrating ${followers.length} followers for user: ${user._id} (${user.fullName || 'No Name'})`);
      for (const followerId of followers) {
        if (followerId) {
          try {
            await Follow.updateOne(
              { follower: followerId, following: user._id },
              { $setOnInsert: { follower: followerId, following: user._id } },
              { upsert: true }
            );
          } catch (err) {
            console.error(`Error migrating follow (follower: ${followerId}, following: ${user._id}):`, err.message);
          }
        }
      }
      followersCountTotal += followers.length;
    }

    // Migrate following array
    const following = user.following;
    if (Array.isArray(following) && following.length > 0) {
      console.log(`Migrating ${following.length} following for user: ${user._id} (${user.fullName || 'No Name'})`);
      for (const followingId of following) {
        if (followingId) {
          try {
            await Follow.updateOne(
              { follower: user._id, following: followingId },
              { $setOnInsert: { follower: user._id, following: followingId } },
              { upsert: true }
            );
          } catch (err) {
            console.error(`Error migrating follow (follower: ${user._id}, following: ${followingId}):`, err.message);
          }
        }
      }
      followingCountTotal += following.length;
    }
  }

  // 3. Recalculate followersCount, followingCount, and totalLikes for all users
  console.log('\n--- Recalculating User Stats ---');
  for (const user of users) {
    const followersCount = await Follow.countDocuments({ following: user._id });
    const followingCount = await Follow.countDocuments({ follower: user._id });

    // Calculate totalLikes received by counting likes on user's posts
    const userPosts = await db.collection('posts').find({ user: user._id }).toArray();
    const userPostIds = userPosts.map(p => p._id);
    const totalLikes = userPostIds.length > 0 
      ? await Like.countDocuments({ post: { $in: userPostIds } })
      : 0;

    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          followersCount, 
          followingCount, 
          totalLikes 
        },
        $unset: { 
          followers: '', 
          following: '' 
        }
      }
    );
    console.log(`Updated user ${user._id} (${user.fullName || 'No Name'}): followersCount=${followersCount}, followingCount=${followingCount}, totalLikes=${totalLikes}`);
  }

  console.log('\nMigration and stats recalculation completed successfully.');
  await mongoose.disconnect();
}

migrate().catch(async (err) => {
  console.error('Migration error:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
