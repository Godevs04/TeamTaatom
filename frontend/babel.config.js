module.exports = function (api) {
  api.cache(true);
  
  // Use process.env instead of api.env() to avoid caching conflicts
  const isProduction = process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production';
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Strip console.log, console.debug, console.info in production
      // Keep console.error and console.warn for production debugging
      ...(isProduction ? [
        ['transform-remove-console', {
          exclude: ['error', 'warn'], // Keep error and warn for production debugging
        }],
      ] : []),
      // Reanimated plugin has to be listed last.
      'react-native-reanimated/plugin',
    ],
  };
};
