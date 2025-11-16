require('dotenv').config({ path: './environment.env' });

// Extract database name from MONGO_URL or use default "Taatom"
const getDatabaseName = () => {
  const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/Taatom';
  // Extract database name from URI (after last / and before ?)
  const match = mongoUri.match(/\/([^/?]+)(\?|$)/);
  return match ? match[1] : 'Taatom';
};

module.exports = {
  mongodb: {
    url: process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/Taatom',
    databaseName: getDatabaseName(),
    options: {
      // Removed deprecated options (useNewUrlParser, useUnifiedTopology)
      // These are no longer needed in MongoDB Driver v4.0.0+
    },
  },
  migrationsDir: './migrations',
  changelogCollectionName: 'migrations',
  migrationFileExtension: '.js',
  useFileHash: false,
};

