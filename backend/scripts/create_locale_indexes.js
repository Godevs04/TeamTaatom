/**
 * Safe script to create Locale collection indexes
 * This script ensures indexes are created without data loss
 * Idempotent: Can be run multiple times safely
 * 
 * Usage: node scripts/create_locale_indexes.js
 */

const mongoose = require('mongoose');
const Locale = require('../src/models/Locale');
require('dotenv').config();

const createIndexes = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
    if (!mongoUri) {
      console.error('❌ MONGO_URL not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get collection
    const collection = mongoose.connection.db.collection('locales');
    
    // Check current indexes
    const existingIndexes = await collection.indexes();
    console.log(`\n📊 Current indexes (${existingIndexes.length}):`);
    existingIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Create indexes using Mongoose (safest method - uses schema definitions)
    console.log('\n🔨 Creating indexes from schema...');
    
    try {
      // Mongoose will automatically create indexes defined in the schema
      // This ensures indexes match the schema exactly
      await Locale.createIndexes();
      console.log('✅ Indexes created successfully from schema');
    } catch (error) {
      // Handle index conflicts gracefully (existing index with different options)
      if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
        console.log('⚠️  Some indexes already exist with different options (this is safe to ignore)');
        // Extract the conflicting index name from error message
        const match = error.message.match(/name: "([^"]+)"/);
        if (match) {
          console.log(`   Conflicting index: ${match[1]}`);
          console.log('   Note: Existing index has different options (e.g., missing sparse: true)');
        }
        console.log('   Continuing with index verification...');
      } else {
        throw error; // Re-throw unexpected errors
      }
    }

    // Verify critical indexes exist
    const newIndexes = await collection.indexes();
    console.log(`\n📊 Updated indexes (${newIndexes.length}):`);
    newIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Verify critical compound indexes exist
    console.log('\n🔍 Verifying critical indexes...');
    const criticalIndexes = [
      'isActive_1_countryCode_1_displayOrder_1_createdAt_-1',
      'isActive_1_stateCode_1',
      'isActive_1_spotTypes_1'
    ];
    
    const indexNames = newIndexes.map(idx => idx.name);
    let allCriticalIndexesExist = true;
    
    criticalIndexes.forEach(indexName => {
      if (indexNames.includes(indexName)) {
        console.log(`   ✅ ${indexName}`);
      } else {
        console.log(`   ❌ ${indexName} - MISSING!`);
        allCriticalIndexesExist = false;
      }
    });
    
    if (allCriticalIndexesExist) {
      console.log('\n✅ All critical indexes are present');
    } else {
      console.log('\n⚠️  Some critical indexes are missing - performance may be impacted');
    }

    // Performance check: Test query with index
    console.log('\n⚡ Testing query performance...');
    const startTime = Date.now();
    const testQuery = { isActive: true, countryCode: 'US' };
    const count = await Locale.countDocuments(testQuery).maxTimeMS(2000);
    const queryTime = Date.now() - startTime;
    
    console.log(`   Query: { isActive: true, countryCode: 'US' }`);
    console.log(`   Result: ${count} locales`);
    console.log(`   Time: ${queryTime}ms`);
    
    if (queryTime < 20) {
      console.log('   ✅ Query performance is excellent (<20ms)');
    } else if (queryTime < 100) {
      console.log('   ⚠️  Query performance is acceptable (<100ms)');
    } else {
      console.log('   ❌ Query performance is slow (>100ms) - check index usage');
    }

    console.log('\n✅ Index creation complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
};

// Run if called directly
if (require.main === module) {
  createIndexes();
}

module.exports = { createIndexes };
