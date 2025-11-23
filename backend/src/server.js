require('dotenv').config();
const { app, dbConnectionPromise } = require('./app');
const http = require('http');
const { setupSocket } = require('./socket');
const { initializeRedis, checkRedisHealth } = require('./utils/redisHealth');
const { verifyS3Connection } = require('./config/s3');
const logger = require('./utils/logger');

// Initialize Redis connection
(async () => {
  try {
    const isHealthy = await checkRedisHealth();
    if (isHealthy) {
      logger.info('✅ Redis is running and ready');
      await initializeRedis();
    } else {
      logger.warn('⚠️  Redis is not available - background jobs will not work');
    }
  } catch (error) {
    logger.warn('⚠️  Redis connection check failed:', error.message);
    logger.warn('   Background jobs require Redis. Install Redis or set ENABLE_BACKGROUND_JOBS=false');
  }
})();

// Initialize AWS S3 connection
(async () => {
  try {
    await verifyS3Connection();
  } catch (error) {
    logger.error('❌ AWS S3 initialization error:', error.message);
  }
})();

// Start background job workers (only in production or when explicitly enabled)
if (process.env.ENABLE_BACKGROUND_JOBS === 'true' || process.env.NODE_ENV === 'production') {
  // Check Redis before starting workers
  // Use setTimeout to ensure Redis initialization completes first
  setTimeout(async () => {
    try {
      const isHealthy = await checkRedisHealth();
      if (isHealthy) {
        require('./jobs/workers');
        logger.info('✅ Background job workers started');
      } else {
        logger.warn('⚠️  Skipping background job workers - Redis not available');
      }
    } catch (err) {
      logger.warn('⚠️  Skipping background job workers - Redis check failed:', err.message || err);
    }
  }, 1000); // Wait 1 second for Redis to initialize
}

const PORT = process.env.PORT || 5000;

// Wait for database connection before starting the server
(async () => {
  try {
    // Wait for MongoDB connection
    await dbConnectionPromise;
    logger.info('✅ Database connection established, starting server...');

    const server = http.createServer(app);
    setupSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();
