const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Configuration
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD) || 100; // milliseconds
const ENABLE_QUERY_MONITORING = process.env.ENABLE_QUERY_MONITORING !== 'false'; // Default to true

// Store for query statistics
const queryStats = {
  totalQueries: 0,
  slowQueries: [],
  queryTimes: [],
  maxSlowQueries: 100, // Keep last 100 slow queries
};

// Store original exec to avoid multiple overrides
let originalExec = null;
let isMonitoring = false;

/**
 * Initialize query monitoring (call once at startup, after mongoose connection)
 */
const initializeQueryMonitoring = () => {
  if (!ENABLE_QUERY_MONITORING || isMonitoring) {
    return;
  }

  try {
    originalExec = mongoose.Query.prototype.exec;
    isMonitoring = true;

    // Override mongoose query execution to track timing
    // Note: Mongoose 7+ uses promises, not callbacks
    mongoose.Query.prototype.exec = function() {
      const start = Date.now();
      const query = this;
      const modelName = query.model?.modelName || 'Unknown';
      const operation = query.op || 'unknown';

      // Call original exec (which returns a promise)
      const promise = originalExec.call(this);

      // Track timing when promise resolves
      return promise
        .then((result) => {
          const duration = Date.now() - start;
          queryStats.totalQueries++;
          queryStats.queryTimes.push(duration);

          // Track slow queries
          if (duration > SLOW_QUERY_THRESHOLD) {
            const slowQuery = {
              model: modelName,
              operation,
              duration,
              timestamp: new Date(),
              query: query.getQuery ? query.getQuery() : {},
            };

            queryStats.slowQueries.push(slowQuery);
            
            // Keep only last N slow queries
            if (queryStats.slowQueries.length > queryStats.maxSlowQueries) {
              queryStats.slowQueries.shift();
            }

            // Log slow query
            logger.warn(`[Slow Query] ${modelName}.${operation} took ${duration}ms`, {
              duration,
              query: slowQuery.query,
              threshold: SLOW_QUERY_THRESHOLD,
            });
          }

          return result;
        })
        .catch((error) => {
          const duration = Date.now() - start;
          queryStats.totalQueries++;
          queryStats.queryTimes.push(duration);
          
          // Re-throw the error
          throw error;
        });
    };

    logger.info('Query monitoring initialized');
  } catch (error) {
    logger.error('Failed to initialize query monitoring:', error);
  }
};

/**
 * Middleware to monitor request-level query performance
 */
const queryMonitor = (req, res, next) => {
  if (!ENABLE_QUERY_MONITORING) {
    return next();
  }

  const startTime = Date.now();
  let requestQueryCount = 0;

  // Track request duration
  res.on('finish', () => {
    const requestDuration = Date.now() - startTime;
    
    // Log if request took too long
    if (requestDuration > 1000) { // 1 second
      logger.warn(`[Slow Request] ${req.method} ${req.path} took ${requestDuration}ms`, {
        method: req.method,
        path: req.path,
        duration: requestDuration,
      });
    }
  });

  next();
};

/**
 * Get query statistics
 */
const getQueryStats = () => {
  const avgQueryTime = queryStats.queryTimes.length > 0
    ? queryStats.queryTimes.reduce((a, b) => a + b, 0) / queryStats.queryTimes.length
    : 0;

  const maxQueryTime = queryStats.queryTimes.length > 0
    ? Math.max(...queryStats.queryTimes)
    : 0;

  // Keep only last 1000 query times for memory efficiency
  if (queryStats.queryTimes.length > 1000) {
    queryStats.queryTimes = queryStats.queryTimes.slice(-1000);
  }

  return {
    totalQueries: queryStats.totalQueries,
    slowQueriesCount: queryStats.slowQueries.length,
    averageQueryTime: Math.round(avgQueryTime * 100) / 100,
    maxQueryTime,
    slowQueries: queryStats.slowQueries.slice(-10), // Last 10 slow queries
    threshold: SLOW_QUERY_THRESHOLD,
  };
};

/**
 * Reset query statistics
 */
const resetQueryStats = () => {
  queryStats.totalQueries = 0;
  queryStats.slowQueries = [];
  queryStats.queryTimes = [];
};

// Note: initializeQueryMonitoring() should be called after mongoose connection
// It's called in app.js after connectDB()

module.exports = {
  queryMonitor,
  getQueryStats,
  resetQueryStats,
  initializeQueryMonitoring,
};
