/**
 * Migration Script: Extract Storage Keys from Signed URLs
 * 
 * This script safely migrates existing records that have signed URLs
 * but may be missing storage keys. It extracts keys from URLs and
 * stores them for future use.
 * 
 * ⚠️ SAFETY: This script is READ-ONLY by default. Set DRY_RUN=false to apply changes.
 * 
 * Usage:
 *   node scripts/migrate_storage_keys.js
 *   DRY_RUN=false node scripts/migrate_storage_keys.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Song = require('../src/models/Song');
const Post = require('../src/models/Post');
const User = require('../src/models/User');
const Locale = require('../src/models/Locale');
const { extractStorageKeyFromUrl } = require('../src/services/mediaService');
const logger = require('../src/utils/logger');

const DRY_RUN = process.env.DRY_RUN !== 'false';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/Taatom', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('✅ MongoDB connected for migration');
  } catch (error) {
    logger.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

/**
 * Extract storage key from R2 signed URL
 * Format: https://xxx.r2.cloudflarestorage.com/bucket-name/path/to/file?X-Amz-...
 */
const extractKeyFromR2Url = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Remove leading slash
    const cleanPath = path.replace(/^\//, '');
    
    // Split by '/' and skip bucket name (usually first part)
    const parts = cleanPath.split('/');
    
    // For R2: bucket-name is usually in the path
    // Format: bucket-name/path/to/file
    // We want: path/to/file
    if (parts.length > 1) {
      // Check if first part looks like a bucket name (contains 'taatom' or is short)
      if (parts[0].includes('taatom') || parts[0].length < 20) {
        return parts.slice(1).join('/');
      }
      // Otherwise, return full path
      return cleanPath;
    }
    
    return cleanPath;
  } catch (error) {
    logger.warn('Failed to parse URL:', { url, error: error.message });
    return null;
  }
};

/**
 * Migrate Songs
 */
const migrateSongs = async () => {
  logger.info('📦 Migrating Songs...');
  
  const songs = await Song.find({
    $or: [
      { storageKey: { $exists: false } },
      { storageKey: null },
      { storageKey: '' }
    ],
    $or: [
      { cloudinaryUrl: { $exists: true, $ne: null } },
      { s3Url: { $exists: true, $ne: null } }
    ]
  }).lean();

  logger.info(`Found ${songs.length} songs to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const song of songs) {
    try {
      // Try to extract key from URLs
      const url = song.cloudinaryUrl || song.s3Url;
      if (!url) {
        skipped++;
        continue;
      }

      const extractedKey = extractKeyFromR2Url(url);
      if (!extractedKey) {
        logger.warn(`Could not extract key from song ${song._id}:`, url);
        skipped++;
        continue;
      }

      // Check if we already have this key stored
      if (song.storageKey === extractedKey || 
          song.cloudinaryKey === extractedKey || 
          song.s3Key === extractedKey) {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        logger.info(`[DRY RUN] Would update song ${song._id}:`, {
          title: song.title,
          extractedKey,
          currentStorageKey: song.storageKey
        });
        migrated++;
      } else {
        await Song.findByIdAndUpdate(song._id, {
          $set: {
            storageKey: extractedKey,
            cloudinaryKey: song.cloudinaryKey || extractedKey,
            s3Key: song.s3Key || extractedKey
          }
        });
        migrated++;
        logger.debug(`✅ Migrated song ${song._id}`);
      }
    } catch (error) {
      logger.error(`Error migrating song ${song._id}:`, error);
      errors++;
    }
  }

  logger.info(`Songs migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  return { migrated, skipped, errors };
};

/**
 * Migrate Posts
 */
const migratePosts = async () => {
  logger.info('📦 Migrating Posts...');
  
  const posts = await Post.find({
    $or: [
      { storageKey: { $exists: false } },
      { storageKey: null },
      { storageKey: '' }
    ],
    imageUrl: { $exists: true, $ne: null }
  }).lean();

  logger.info(`Found ${posts.length} posts to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const post of posts) {
    try {
      // Extract key from primary image
      const primaryKey = extractKeyFromR2Url(post.imageUrl);
      
      // Extract keys from all images
      const imageKeys = [];
      if (post.images && Array.isArray(post.images)) {
        for (const imageUrl of post.images) {
          const key = extractKeyFromR2Url(imageUrl);
          if (key) imageKeys.push(key);
        }
      }

      if (!primaryKey && imageKeys.length === 0) {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        logger.info(`[DRY RUN] Would update post ${post._id}:`, {
          primaryKey,
          imageKeys,
          currentStorageKey: post.storageKey
        });
        migrated++;
      } else {
        const update = {};
        if (primaryKey) {
          update.storageKey = primaryKey;
        }
        if (imageKeys.length > 0) {
          update.storageKeys = imageKeys;
        }

        await Post.findByIdAndUpdate(post._id, { $set: update });
        migrated++;
        logger.debug(`✅ Migrated post ${post._id}`);
      }
    } catch (error) {
      logger.error(`Error migrating post ${post._id}:`, error);
      errors++;
    }
  }

  logger.info(`Posts migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  return { migrated, skipped, errors };
};

/**
 * Migrate Users (Profile Pictures)
 */
const migrateUsers = async () => {
  logger.info('📦 Migrating Users (Profile Pictures)...');
  
  const users = await User.find({
    $or: [
      { profilePicStorageKey: { $exists: false } },
      { profilePicStorageKey: null },
      { profilePicStorageKey: '' }
    ],
    profilePic: { $exists: true, $ne: null, $ne: '' }
  }).lean();

  logger.info(`Found ${users.length} users to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const extractedKey = extractKeyFromR2Url(user.profilePic);
      if (!extractedKey) {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        logger.info(`[DRY RUN] Would update user ${user._id}:`, {
          username: user.username,
          extractedKey,
          currentStorageKey: user.profilePicStorageKey
        });
        migrated++;
      } else {
        await User.findByIdAndUpdate(user._id, {
          $set: { profilePicStorageKey: extractedKey }
        });
        migrated++;
        logger.debug(`✅ Migrated user ${user._id}`);
      }
    } catch (error) {
      logger.error(`Error migrating user ${user._id}:`, error);
      errors++;
    }
  }

  logger.info(`Users migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  return { migrated, skipped, errors };
};

/**
 * Migrate Locales
 */
const migrateLocales = async () => {
  logger.info('📦 Migrating Locales...');
  
  const locales = await Locale.find({
    $or: [
      { storageKey: { $exists: false } },
      { storageKey: null },
      { storageKey: '' }
    ],
    $or: [
      { cloudinaryUrl: { $exists: true, $ne: null } },
      { imageUrl: { $exists: true, $ne: null } }
    ]
  }).lean();

  logger.info(`Found ${locales.length} locales to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const locale of locales) {
    try {
      const url = locale.cloudinaryUrl || locale.imageUrl;
      if (!url) {
        skipped++;
        continue;
      }

      const extractedKey = extractKeyFromR2Url(url);
      if (!extractedKey) {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        logger.info(`[DRY RUN] Would update locale ${locale._id}:`, {
          name: locale.name,
          extractedKey,
          currentStorageKey: locale.storageKey
        });
        migrated++;
      } else {
        await Locale.findByIdAndUpdate(locale._id, {
          $set: {
            storageKey: extractedKey,
            cloudinaryKey: locale.cloudinaryKey || extractedKey,
            imageKey: locale.imageKey || extractedKey
          }
        });
        migrated++;
        logger.debug(`✅ Migrated locale ${locale._id}`);
      }
    } catch (error) {
      logger.error(`Error migrating locale ${locale._id}:`, error);
      errors++;
    }
  }

  logger.info(`Locales migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
  return { migrated, skipped, errors };
};

/**
 * Main migration function
 */
const runMigration = async () => {
  await connectDB();

  logger.info(`\n🚀 Starting Storage Key Migration (DRY_RUN=${DRY_RUN})\n`);

  const results = {
    songs: { migrated: 0, skipped: 0, errors: 0 },
    posts: { migrated: 0, skipped: 0, errors: 0 },
    users: { migrated: 0, skipped: 0, errors: 0 },
    locales: { migrated: 0, skipped: 0, errors: 0 }
  };

  try {
    results.songs = await migrateSongs();
    results.posts = await migratePosts();
    results.users = await migrateUsers();
    results.locales = await migrateLocales();

    // Summary
    const totalMigrated = Object.values(results).reduce((sum, r) => sum + r.migrated, 0);
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);

    logger.info('\n📊 Migration Summary:');
    logger.info(`   Songs:   ${results.songs.migrated} migrated, ${results.songs.skipped} skipped, ${results.songs.errors} errors`);
    logger.info(`   Posts:   ${results.posts.migrated} migrated, ${results.posts.skipped} skipped, ${results.posts.errors} errors`);
    logger.info(`   Users:   ${results.users.migrated} migrated, ${results.users.skipped} skipped, ${results.users.errors} errors`);
    logger.info(`   Locales: ${results.locales.migrated} migrated, ${results.locales.skipped} skipped, ${results.locales.errors} errors`);
    logger.info(`\n   Total:   ${totalMigrated} migrated, ${totalSkipped} skipped, ${totalErrors} errors`);

    if (DRY_RUN) {
      logger.info('\n⚠️  DRY RUN MODE - No changes were made');
      logger.info('   Set DRY_RUN=false to apply changes');
    } else {
      logger.info('\n✅ Migration completed successfully!');
    }
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('✅ Database connection closed');
    process.exit(0);
  }
};

// Run migration
if (require.main === module) {
  runMigration().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { runMigration };

