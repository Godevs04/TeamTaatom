require('dotenv').config();

// Validate required environment variables before starting
const validateEnvironment = () => {
  const requiredVars = [
    'MONGO_URL',
    'JWT_SECRET',
    'NODE_ENV',
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these variables in your .env file or environment.');
    process.exit(1);
  }

  // Validate NODE_ENV
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(process.env.NODE_ENV)) {
    console.error(`❌ Invalid NODE_ENV: ${process.env.NODE_ENV}`);
    console.error(`   Valid values: ${validEnvs.join(', ')}`);
    process.exit(1);
  }

  // Warn about missing optional but recommended variables in production
  if (process.env.NODE_ENV === 'production') {
    const recommendedVars = [
      'FRONTEND_URL',
      'SENTRY_DSN',
    ];
    
    const missingRecommended = recommendedVars.filter(varName => !process.env[varName]);
    if (missingRecommended.length > 0) {
      console.warn('⚠️  Missing recommended environment variables for production:');
      missingRecommended.forEach(varName => {
        console.warn(`   - ${varName}`);
      });
    }
  }
};

// Validate environment before proceeding
validateEnvironment();

// Initialize Sentry as early as possible (before any other imports)
require('./instrument');

const { app, dbConnectionPromise } = require('./app');
const http = require('http');
const { setupSocket } = require('./socket');
const { initializeRedis, checkRedisHealth } = require('./utils/redisHealth');
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

// Global references for graceful shutdown
let server = null;
let io = null;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Close HTTP server
  if (server) {
    return new Promise((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
      
      // Force close after timeout
      setTimeout(() => {
        logger.warn('Forcing server close after timeout');
        resolve();
      }, 10000);
    }).then(async () => {
      // Close Socket.IO server
      if (io) {
        io.close(() => {
          logger.info('Socket.IO server closed');
        });
      }
      
      // Close database connection
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.close();
          logger.info('MongoDB connection closed');
        }
      } catch (error) {
        logger.error('Error closing MongoDB connection', error);
      }
      
      // Close Redis connection
      try {
        const { closeRedis } = require('./utils/redisHealth');
        await closeRedis();
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection', error);
      }
      
      // Stop background job workers
      try {
        const workers = require('./jobs/workers');
        if (workers && typeof workers.stopWorkers === 'function') {
          await workers.stopWorkers();
          logger.info('Background job workers stopped');
        }
      } catch (error) {
        // Workers might not be initialized, ignore error
        logger.debug('Background job workers not running or already stopped');
      }
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    });
  } else {
    logger.info('Server not initialized, exiting');
    process.exit(0);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception:', error);
  
  // CRITICAL: Send to Sentry before shutdown
  if (process.env.SENTRY_DSN) {
    const Sentry = require('./instrument');
    Sentry.captureException(error, {
      tags: {
        error_type: 'uncaughtException',
        fatal: true,
      },
      level: 'fatal',
    });
    // Flush Sentry before shutdown
    try {
      await Sentry.flush(5000);
      logger.log('✅ Uncaught exception sent to Sentry');
    } catch (flushError) {
      logger.error('Failed to flush Sentry:', flushError);
    }
  }
  
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // CRITICAL: Send to Sentry before shutdown
  if (process.env.SENTRY_DSN) {
    const Sentry = require('./instrument');
    const error = reason instanceof Error ? reason : new Error(String(reason));
    Sentry.captureException(error, {
      tags: {
        error_type: 'unhandledRejection',
        fatal: true,
      },
      level: 'error',
      extra: {
        promise: promise.toString(),
        reason: reason,
      },
    });
    // Flush Sentry before shutdown
    try {
      await Sentry.flush(5000);
      logger.log('✅ Unhandled rejection sent to Sentry');
    } catch (flushError) {
      logger.error('Failed to flush Sentry:', flushError);
    }
  }
  
  gracefulShutdown('unhandledRejection');
});

// Wait for database connection before starting the server
(async () => {
  try {
    // Wait for MongoDB connection
    await dbConnectionPromise;
    logger.info('✅ Database connection established, starting server...');

    server = http.createServer(app);
    setupSocket(server); // Sets up Socket.IO and stores io in global.socketIO
    // Get io instance from global reference
    io = global.socketIO;

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Signal PM2 that app is ready (if using PM2)
      if (process.send) {
        process.send('ready');
      }
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();
