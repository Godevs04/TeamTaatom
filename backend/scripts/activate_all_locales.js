/**
 * Script to activate all inactive locales
 * Sets all locales to isActive: true to ensure they're all active by default
 * 
 * Usage: node backend/scripts/activate_all_locales.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../environment.env') });
const mongoose = require('mongoose');
const logger = require('../src/utils/logger');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URL;
    if (!mongoUri) {
      throw new Error('MONGO_URL is not defined in environment.env');
    }
    await mongoose.connect(mongoUri);
    logger.info('✅ Connected to MongoDB');
  } catch (error) {
    logger.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Use the actual Locale model
const Locale = require('../src/models/Locale');

/**
 * Activate all inactive locales
 */
const activateAllLocales = async () => {
  try {
    logger.info('🚀 Starting locale activation...');
    
    // Find all inactive locales
    const inactiveLocales = await Locale.find({ isActive: false }).select('_id name country countryCode isActive');
    
    logger.info(`Found ${inactiveLocales.length} inactive locales`);
    
    if (inactiveLocales.length === 0) {
      logger.info('✅ All locales are already active. No changes needed.');
      return { activated: 0, total: 0 };
    }
    
    // Log some examples
    if (inactiveLocales.length > 0) {
      logger.info('Sample inactive locales:');
      inactiveLocales.slice(0, 5).forEach(locale => {
        logger.info(`  - ${locale.name} (${locale.country})`);
      });
      if (inactiveLocales.length > 5) {
        logger.info(`  ... and ${inactiveLocales.length - 5} more`);
      }
    }
    
    // Activate all inactive locales
    const updateResult = await Locale.updateMany(
      { isActive: false },
      { $set: { isActive: true } }
    );
    
    logger.info(`✅ Successfully activated ${updateResult.modifiedCount} locales`);
    
    // Verify the update
    const remainingInactive = await Locale.countDocuments({ isActive: false });
    const totalLocales = await Locale.countDocuments();
    const activeLocales = await Locale.countDocuments({ isActive: true });
    
    logger.info(`📊 Locale Status Summary:`);
    logger.info(`   Total locales: ${totalLocales}`);
    logger.info(`   Active locales: ${activeLocales}`);
    logger.info(`   Inactive locales: ${remainingInactive}`);
    
    return {
      activated: updateResult.modifiedCount,
      total: totalLocales,
      active: activeLocales,
      inactive: remainingInactive
    };
    
  } catch (error) {
    logger.error('❌ Error activating locales:', error);
    throw error;
  }
};

/**
 * Main execution
 */
const runScript = async () => {
  try {
    await connectDB();
    
    logger.info('\n🎯 Activating all inactive locales...\n');
    
    const result = await activateAllLocales();
    
    logger.info('\n✅ Script completed successfully!');
    logger.info(`   Activated: ${result.activated} locales`);
    logger.info(`   Total: ${result.total} locales`);
    logger.info(`   Active: ${result.active} locales`);
    logger.info(`   Inactive: ${result.inactive} locales\n`);
    
  } catch (error) {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    logger.info('✅ Database connection closed');
    process.exit(0);
  }
};

// Run script
if (require.main === module) {
  runScript();
}

module.exports = { activateAllLocales };

