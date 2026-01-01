/**
 * Initial schema migration
 * This migration creates indexes and ensures proper schema setup
 * Idempotent: checks if indexes exist before creating them
 */
module.exports = {
  async up(db) {
    // Helper function to create index only if it doesn't exist
    const createIndexIfNotExists = async (collectionName, indexSpec, options = {}) => {
      // Calculate index name first (before try block)
      const indexName = options.name || Object.keys(indexSpec)[0] + '_' + Object.values(indexSpec)[0];
      
      try {
        // Check if collection exists
        const collections = await db.listCollections({ name: collectionName }).toArray();
        if (collections.length === 0) {
          console.log(`Collection ${collectionName} does not exist yet - skipping index creation`);
          return;
        }
        
        const collection = db.collection(collectionName);
        const indexes = await collection.indexes();
        const exists = indexes.some(idx => idx.name === indexName);
        
        if (!exists) {
          await collection.createIndex(indexSpec, options);
          console.log(`Created index: ${indexName} on ${collectionName}`);
        } else {
          console.log(`Index already exists: ${indexName} on ${collectionName}`);
        }
      } catch (error) {
        // If collection doesn't exist, skip silently
        if (error.message.includes('ns does not exist') || error.message.includes('does not exist')) {
          console.log(`Collection ${collectionName} does not exist - skipping index creation`);
          return;
        }
        // If index exists with different options, skip it
        if (error.message.includes('existing index')) {
          console.log(`Index exists with different options, skipping: ${indexName}`);
          return;
        }
        // If geospatial index fails due to data format issues, skip it gracefully
        if (error.message.includes('Can\'t extract geo keys') || 
            error.message.includes('can\'t project geometry') ||
            error.message.includes('spherical CRS')) {
          console.warn(`⚠️  Skipping geospatial index due to incompatible data format: ${indexName}`);
          console.warn(`   MongoDB 2dsphere requires GeoJSON: { type: "Point", coordinates: [longitude, latitude] }`);
          console.warn(`   Current format: { latitude: X, longitude: Y }`);
          return;
        }
        throw error;
      }
    };

    // Users collection indexes
    // Note: email, username, and googleId indexes are automatically created by Mongoose schema's unique: true
    // Creating them here would cause duplicate index warnings
    // await createIndexIfNotExists('users', { email: 1 }, { unique: true, sparse: true, name: 'email_1' });
    // await createIndexIfNotExists('users', { username: 1 }, { unique: true, sparse: true, name: 'username_1' });
    // await createIndexIfNotExists('users', { googleId: 1 }, { unique: true, sparse: true, name: 'googleId_1' });
    await createIndexIfNotExists('users', { isVerified: 1 }, { name: 'isVerified_1' });
    await createIndexIfNotExists('users', { createdAt: -1 }, { name: 'createdAt_-1' });
    await createIndexIfNotExists('users', { lastLogin: -1 }, { name: 'lastLogin_-1' });
    // Geospatial index (will be skipped if data format is incompatible)
    // Current format: { latitude: X, longitude: Y }
    // Required format: { type: "Point", coordinates: [longitude, latitude] }
    await createIndexIfNotExists('users', { 'location.coordinates': '2dsphere' }, { name: 'location.coordinates_2dsphere' });

    // Posts collection indexes
    await createIndexIfNotExists('posts', { user: 1, createdAt: -1 }, { name: 'user_1_createdAt_-1' });
    await createIndexIfNotExists('posts', { tags: 1 }, { name: 'tags_1' });
    // Skip geospatial index for posts (data format incompatible with 2dsphere)
    // Current format: { latitude: X, longitude: Y }
    // Required format: { type: "Point", coordinates: [longitude, latitude] }
    // Note: The helper function will catch and skip this automatically
    await createIndexIfNotExists('posts', { 'location.coordinates': '2dsphere' }, { name: 'location.coordinates_2dsphere' });
    await createIndexIfNotExists('posts', { likes: -1 }, { name: 'likes_-1' });
    await createIndexIfNotExists('posts', { isHidden: 1 }, { name: 'isHidden_1' });

    // Chats collection indexes
    await createIndexIfNotExists('chats', { participants: 1 }, { name: 'participants_1' });
    await createIndexIfNotExists('chats', { 'messages.timestamp': -1 }, { name: 'messages.timestamp_-1' });
    await createIndexIfNotExists('chats', { updatedAt: -1 }, { name: 'updatedAt_-1' });
    await createIndexIfNotExists('chats', { participants: 1, updatedAt: -1 }, { name: 'participants_1_updatedAt_-1' });

    // Analytics events indexes (collection may not exist yet - will be created when first event is logged)
    await createIndexIfNotExists('analyticevents', { userId: 1, timestamp: -1 }, { name: 'userId_1_timestamp_-1' });
    await createIndexIfNotExists('analyticevents', { event: 1, timestamp: -1 }, { name: 'event_1_timestamp_-1' });
    await createIndexIfNotExists('analyticevents', { sessionId: 1, timestamp: -1 }, { name: 'sessionId_1_timestamp_-1' });
    await createIndexIfNotExists('analyticevents', { timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60, name: 'timestamp_1_ttl' });

    // Error logs indexes (collection may not exist yet - will be created when first error is logged)
    await createIndexIfNotExists('errorlogs', { platform: 1, timestamp: -1 }, { name: 'platform_1_timestamp_-1' });
    await createIndexIfNotExists('errorlogs', { userId: 1, timestamp: -1 }, { name: 'userId_1_timestamp_-1' });
    await createIndexIfNotExists('errorlogs', { resolved: 1, timestamp: -1 }, { name: 'resolved_1_timestamp_-1' });

    console.log('Migration 001_initial_schema: up');
  },

  async down(db) {
    // Drop indexes (be careful in production)
    await db.collection('users').dropIndexes();
    await db.collection('posts').dropIndexes();
    await db.collection('chats').dropIndexes();
    await db.collection('analyticevents').dropIndexes();
    await db.collection('errorlogs').dropIndexes();

    console.log('Migration 001_initial_schema: down');
  },
};

