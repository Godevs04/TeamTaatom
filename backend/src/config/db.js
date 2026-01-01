const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Extract database name from environment variable or MONGO_URL
const getDatabaseName = () => {
  // Priority 1: Use explicit MONGO_DB_NAME environment variable
  if (process.env.MONGO_DB_NAME) {
    return process.env.MONGO_DB_NAME;
  }
  
  // Priority 2: Extract from MONGO_URL if database name is specified in URI
  const mongoUri = process.env.MONGO_URL || '';
  if (mongoUri) {
    // Extract database name from URI (after last / and before ?)
    const match = mongoUri.match(/\/([^/?]+)(\?|$)/);
    if (match && match[1] && !match[1].includes('@')) {
      // Make sure it's not part of the connection string (username/password)
      return match[1];
    }
  }
  
  // Priority 3: Use default fallback
  return 'TaatomProd';
};

const connectDB = async () => {
  try {
    // Set up event listeners before connecting
    mongoose.connection.on('connected', () => {
      logger.info(`MongoDB Connected: ${mongoose.connection.host}`);
      logger.info(`Database: ${mongoose.connection.name}`);
      logger.debug(`Connection pool size: ${mongoose.connection.maxPoolSize || 'default'}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    // Get database name from environment or extract from MONGO_URL
    const dbName = getDatabaseName();
    logger.info(`Connecting to database: ${dbName}`);

    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGO_URL, {
      dbName: dbName,
      // Connection Pool Settings for Performance Optimization
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 10, // Maximum number of connections in the pool
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 2, // Minimum number of connections to maintain
      maxIdleTimeMS: parseInt(process.env.MONGO_MAX_IDLE_TIME_MS) || 30000, // Close connections after 30s of inactivity
      serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000, // Timeout for server selection
      socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000, // Socket timeout
      connectTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS) || 10000, // Connection timeout
      // Buffer settings (bufferCommands: false disables mongoose buffering)
      bufferCommands: false, // Disable mongoose buffering (fail fast)
      // Additional optimizations
      retryWrites: true, // Retry writes on network errors
      retryReads: true, // Retry reads on network errors
    });

    // Log pool statistics periodically (development only)
    if (process.env.NODE_ENV === 'development') {
      setInterval(() => {
        const poolStats = mongoose.connection.db?.admin()?.serverStatus?.connections;
        if (poolStats) {
          logger.debug(`MongoDB Pool Stats - Active: ${poolStats.active}, Available: ${poolStats.available}`);
        }
      }, 60000); // Every minute
    }

    // Return connection for chaining
    return conn;
  } catch (error) {
    logger.error('MongoDB connection error:', error.message);
    throw error; // Re-throw so server.js can handle it
  }
};

module.exports = connectDB;
