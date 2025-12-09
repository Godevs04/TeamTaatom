/**
 * Migration Script: Convert existing Posts to TripVisits (TripScore v2)
 * 
 * This script migrates all existing posts with valid locations to TripVisit records.
 * Run this once after deploying TripScore v2 to backfill historical data.
 * 
 * Usage:
 *   node backend/scripts/migratePostsToTripVisits.js
 * 
 * Options:
 *   --dry-run: Preview changes without saving
 *   --limit=N: Process only N posts (for testing)
 *   --user-id=ID: Process only posts for a specific user
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Post = require('../src/models/Post');
const TripVisit = require('../src/models/TripVisit');
const { createTripVisitFromPost } = require('../src/services/tripVisitService');
const logger = require('../src/utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const userIdArg = args.find(arg => arg.startsWith('--user-id='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const userId = userIdArg ? userIdArg.split('=')[1] : null;

async function migratePostsToTripVisits() {
  try {
    // Connect to MongoDB
    // Note: useNewUrlParser and useUnifiedTopology are deprecated in MongoDB Driver v4+
    await mongoose.connect(process.env.MONGO_URL || 'mongodb+srv://Kavin_14:1421Kavin@godevs.cfgexon.mongodb.net/Taatom?retryWrites=true&w=majority');
    logger.info('Connected to MongoDB');

    // Build query
    const query = {
      isActive: true,
      'location.coordinates.latitude': { $ne: 0 },
      'location.coordinates.longitude': { $ne: 0 }
    };
    
    if (userId) {
      query.user = new mongoose.Types.ObjectId(userId);
    }

    // Get all posts with valid locations
    const posts = await Post.find(query)
      .select('user location createdAt type')
      .limit(limit || 10000) // Default limit to prevent memory issues
      .lean();

    logger.info(`Found ${posts.length} posts with valid locations to migrate`);

    if (isDryRun) {
      logger.info('DRY RUN MODE - No changes will be saved');
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Process posts in batches
    const batchSize = 100;
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (post) => {
          try {
            // Check if TripVisit already exists for this post
            const existingVisit = await TripVisit.findOne({
              post: post._id,
              contentType: post.type || 'post'
            });

            if (existingVisit) {
              skipCount++;
              logger.debug(`Skipping post ${post._id} - TripVisit already exists`);
              return;
            }

            // Check if visit already exists for this location (deduplication)
            const existingLocationVisit = await TripVisit.findOne({
              user: post.user,
              lat: post.location.coordinates.latitude,
              lng: post.location.coordinates.longitude,
              isActive: true
            });

            if (existingLocationVisit) {
              skipCount++;
              logger.debug(`Skipping post ${post._id} - Visit already exists for this location`);
              return;
            }

            if (!isDryRun) {
              // Create TripVisit from post
              // For migration, we'll use conservative defaults:
              // - source: 'gallery_no_exif' (most likely for old posts)
              // - trustLevel: will be assigned by service based on source
              const metadata = {
                source: 'gallery_no_exif', // Conservative default for old posts
                hasExifGps: false, // Assume no EXIF for old posts unless we can detect it
                takenAt: post.createdAt, // Use createdAt as takenAt fallback
                fromCamera: false
              };

              const tripVisit = await createTripVisitFromPost(
                await Post.findById(post._id), // Fetch full post for service
                metadata
              );

              if (tripVisit) {
                successCount++;
                logger.debug(`Created TripVisit for post ${post._id}`);
              } else {
                skipCount++;
                logger.debug(`Skipped post ${post._id} - No TripVisit created`);
              }
            } else {
              successCount++;
              logger.debug(`[DRY RUN] Would create TripVisit for post ${post._id}`);
            }
          } catch (error) {
            errorCount++;
            logger.error(`Error processing post ${post._id}:`, error);
          }
        })
      );

      // Log progress
      const processed = Math.min(i + batchSize, posts.length);
      logger.info(`Progress: ${processed}/${posts.length} posts processed (${successCount} created, ${skipCount} skipped, ${errorCount} errors)`);
    }

    logger.info('\n=== Migration Summary ===');
    logger.info(`Total posts processed: ${posts.length}`);
    logger.info(`TripVisits created: ${successCount}`);
    logger.info(`Skipped (already exists): ${skipCount}`);
    logger.info(`Errors: ${errorCount}`);
    
    if (isDryRun) {
      logger.info('\nThis was a DRY RUN - no changes were saved');
      logger.info('Run without --dry-run to perform the actual migration');
    }

    // Close connection
    await mongoose.connection.close();
    logger.info('Migration completed');

  } catch (error) {
    logger.error('Migration error:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migratePostsToTripVisits()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { migratePostsToTripVisits };

