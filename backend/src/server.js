require('dotenv').config();

// PRODUCTION-GRADE: Ensure NODE_ENV is set correctly for staging/production deployments
// If deploying to staging or production, force NODE_ENV to production
// This ensures consistent behavior across cloud environments
if (process.env.STAGING === 'true' || process.env.PRODUCTION === 'true' || process.env.DEPLOY_ENV === 'staging' || process.env.DEPLOY_ENV === 'production') {
  process.env.NODE_ENV = 'production';
  console.log('📡 Deployment environment detected - Setting NODE_ENV=production');
}

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
    
    // CRITICAL: Check Brevo configuration for SuperAdmin 2FA
    const brevoApiKey = process.env.BREVO_API_KEY;
    const smtpFrom = process.env.SMTP_FROM;
    if (!brevoApiKey) {
      console.error('❌ CRITICAL: BREVO_API_KEY not configured!');
      console.error('   SuperAdmin login requires 2FA email sending.');
      console.error('   Please set BREVO_API_KEY in production environment.');
      console.error('   Without this, SuperAdmin login will fail with SRV_6001 errors.');
    } else if (!smtpFrom) {
      console.warn('⚠️  SMTP_FROM not configured. Using default: contact@taatom.com');
      console.log('✅ Brevo email service configured');
    } else {
      console.log('✅ Brevo email service configured');
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
const logger = require('./utils/logger');

// Start background job workers (only in production or when explicitly enabled)
// Note: Queues are disabled (no Redis) - workers will use no-op queues
if (process.env.ENABLE_BACKGROUND_JOBS === 'true' || process.env.NODE_ENV === 'production') {
  try {
    require('./jobs/workers');
    logger.info('✅ Background job workers initialized (queues disabled - no Redis)');
  } catch (err) {
    logger.warn('⚠️  Failed to initialize background job workers:', err.message || err);
  }
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
    
    // Configure server timeouts for large file uploads
    // Increase timeout to 2 hours (7200000ms) to handle large video uploads (400MB+)
    server.timeout = 2 * 60 * 60 * 1000; // 2 hours
    server.keepAliveTimeout = 65000; // 65 seconds (slightly longer than default 60s)
    server.headersTimeout = 66000; // 66 seconds (must be > keepAliveTimeout)
    
    setupSocket(server); // Sets up Socket.IO and stores io in global.socketIO
    // Get io instance from global reference
    io = global.socketIO;

    server.listen(PORT, '0.0.0.0', () => {
      const env = process.env.NODE_ENV || 'development';
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 Environment: ${env}`);
      
      // Log Brevo email service configuration status
      const brevoApiKey = process.env.BREVO_API_KEY;
      const smtpFrom = process.env.SMTP_FROM;
      const { isConfigured } = require('./utils/brevoService');
      
      if (isConfigured) {
        const maskedKey = brevoApiKey && brevoApiKey.length > 8 
          ? `${brevoApiKey.substring(0, 4)}...${brevoApiKey.substring(brevoApiKey.length - 4)}`
          : '***';
        logger.info(`✅ Brevo email service: Configured`);
        logger.info(`   API Key: ${maskedKey}`);
        logger.info(`   From Email: ${smtpFrom || 'contact@taatom.com (default)'}`);
      } else {
        logger.warn('⚠️  Brevo email service: NOT configured - Email functionality disabled');
        if (!brevoApiKey) {
          logger.warn('   ❌ BREVO_API_KEY not found in environment variables');
          logger.warn('   📝 Add BREVO_API_KEY=d2K7bZEGX0mqagjA to your backend/.env file');
        }
        if (!smtpFrom) {
          logger.warn('   ⚠️  SMTP_FROM not set (using default: contact@taatom.com)');
        }
        logger.warn('   💡 After setting variables, restart the server');
      }
      
      // Warn if environment is not set correctly for production deployments
      if (env === 'development' && (process.env.STAGING === 'true' || process.env.PRODUCTION === 'true')) {
        logger.warn('⚠️  WARNING: NODE_ENV is "development" but deployment flags detected!');
        logger.warn('⚠️  This may cause issues. Ensure NODE_ENV=production in your deployment environment.');
      }
      
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
