/**
 * Health Check Controller
 * Provides comprehensive health monitoring endpoints for production use
 */

const mongoose = require('mongoose');
const { checkRedisHealth } = require('../utils/redisHealth');
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/errorCodes');

/**
 * Basic health check - quick response for load balancers
 * GET /health
 */
const basicHealthCheck = async (req, res) => {
  try {
    // Quick check - just verify server is responding
    return sendSuccess(res, 200, 'Service is healthy', {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    logger.error('Basic health check failed', error);
    return sendError(res, 500, 'Service is unhealthy');
  }
};

/**
 * Detailed health check - comprehensive system status
 * GET /health/detailed
 */
const detailedHealthCheck = async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0',
    services: {},
    system: {
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        unit: 'MB',
      },
      cpu: {
        usage: process.cpuUsage(),
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  let overallHealthy = true;

  // Check MongoDB connection
  try {
    const dbState = mongoose.connection.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    const isDbHealthy = dbState === 1;
    healthStatus.services.database = {
      status: isDbHealthy ? 'healthy' : 'unhealthy',
      state: dbStates[dbState] || 'unknown',
      name: mongoose.connection.name || 'unknown',
      host: mongoose.connection.host || 'unknown',
      port: mongoose.connection.port || 'unknown',
    };

    if (!isDbHealthy) {
      overallHealthy = false;
      healthStatus.status = 'degraded';
    }

    // Get database stats if connected
    if (isDbHealthy) {
      try {
        const dbStats = await mongoose.connection.db.stats();
        healthStatus.services.database.stats = {
          collections: dbStats.collections,
          dataSize: Math.round(dbStats.dataSize / 1024 / 1024),
          storageSize: Math.round(dbStats.storageSize / 1024 / 1024),
          indexes: dbStats.indexes,
          indexSize: Math.round(dbStats.indexSize / 1024 / 1024),
          unit: 'MB',
        };
      } catch (statsError) {
        logger.warn('Failed to get database stats', { error: statsError.message });
      }
    }
  } catch (error) {
    logger.error('Database health check failed', error);
    healthStatus.services.database = {
      status: 'unhealthy',
      error: error.message,
    };
    overallHealthy = false;
    healthStatus.status = 'unhealthy';
  }

  // Check Redis connection
  try {
    const redisHealthy = await checkRedisHealth();
    healthStatus.services.redis = {
      status: redisHealthy ? 'healthy' : 'unhealthy',
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
    };

    if (!redisHealthy) {
      overallHealthy = false;
      if (healthStatus.status === 'healthy') {
        healthStatus.status = 'degraded';
      }
    }
  } catch (error) {
    logger.error('Redis health check failed', error);
    healthStatus.services.redis = {
      status: 'unhealthy',
      error: error.message,
    };
    overallHealthy = false;
    healthStatus.status = 'unhealthy';
  }

  // Check external services (if configured)
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    healthStatus.services.cloudinary = {
      status: 'configured',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    };
  }

  if (process.env.AWS_S3_BUCKET_NAME) {
    healthStatus.services.s3 = {
      status: 'configured',
      bucket: process.env.AWS_S3_BUCKET_NAME,
    };
  }

  // Determine HTTP status code
  const httpStatus = overallHealthy ? 200 : 503;

  return res.status(httpStatus).json({
    success: overallHealthy,
    message: overallHealthy ? 'All services are healthy' : 'Some services are unhealthy',
    data: healthStatus,
  });
};

/**
 * Readiness check - indicates if service is ready to accept traffic
 * GET /health/ready
 */
const readinessCheck = async (req, res) => {
  try {
    // Check critical services
    const dbReady = mongoose.connection.readyState === 1;
    const redisReady = await checkRedisHealth();

    const isReady = dbReady && redisReady;

    if (!isReady) {
      return res.status(503).json({
        success: false,
        message: 'Service is not ready',
        data: {
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          database: dbReady ? 'ready' : 'not_ready',
          redis: redisReady ? 'ready' : 'not_ready',
        },
      });
    }

    return sendSuccess(res, 200, 'Service is ready', {
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'ready',
      redis: 'ready',
    });
  } catch (error) {
    logger.error('Readiness check failed', error);
    return res.status(503).json({
      success: false,
      message: 'Service is not ready',
      data: {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: error.message,
      },
    });
  }
};

/**
 * Liveness check - indicates if service is alive (for Kubernetes)
 * GET /health/live
 */
const livenessCheck = async (req, res) => {
  try {
    // Simple check - just verify process is running
    return sendSuccess(res, 200, 'Service is alive', {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.error('Liveness check failed', error);
    return sendError(res, 500, 'Service is not alive');
  }
};

module.exports = {
  basicHealthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
};

