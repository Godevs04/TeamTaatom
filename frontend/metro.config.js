const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Enable network access for development
config.server = {
  ...config.server,
  // Bind to all network interfaces
  port: 8081,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Allow CORS for development
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }
      
      return middleware(req, res, next);
    };
  }
};

// Enable network access
const defaultResolver = require('metro-resolver');

config.resolver = {
  ...config.resolver,
  platforms: ['ios', 'android', 'native', 'web'],
  // Custom resolver to exclude react-native-maps on web
  resolveRequest: (context, moduleName, platform) => {
    // Exclude react-native-maps on web platform
    if (platform === 'web' && moduleName === 'react-native-maps') {
      return {
        type: 'empty',
      };
    }
    
    // Use default resolver for everything else
    return defaultResolver.resolve(context, moduleName, platform);
  },
};

module.exports = config;