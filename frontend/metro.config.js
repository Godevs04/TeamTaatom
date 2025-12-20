const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Production optimizations
const isProduction = process.env.NODE_ENV === 'production';

// Enable network access for development
config.server = {
  ...config.server,
  // Bind to all network interfaces
  port: 8081,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Allow CORS for development
      if (!isProduction) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (req.method === 'OPTIONS') {
          res.status(200).end();
          return;
        }
      }
      
      return middleware(req, res, next);
    };
  }
};

// Production build optimizations
if (isProduction) {
  // Minify code in production
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      keep_classnames: false,
      keep_fnames: false,
      mangle: {
        keep_classnames: false,
        keep_fnames: false,
      },
      output: {
        ascii_only: true,
        quote_style: 3,
        wrap_iife: true,
      },
      sourceMap: {
        includeSources: false,
      },
      toplevel: false,
      compress: {
        // Aggressive compression for production
        dead_code: true,
        drop_console: false, // Handled by Babel
        drop_debugger: true,
        evaluate: true,
        inline: true,
        passes: 3,
        unsafe: false,
        unsafe_comps: false,
        unsafe_math: false,
        unsafe_methods: false,
        unsafe_proto: false,
        unsafe_regexp: false,
        unsafe_undefined: false,
      },
    },
  };

  // Source map configuration for production
  config.transformer = {
    ...config.transformer,
    // Generate separate source maps (not inline) for production
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: false,
      },
    }),
  };
}

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