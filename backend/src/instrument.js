// Initialize Sentry as early as possible in the application lifecycle
// This file should be imported before any other modules

const Sentry = require('@sentry/node');
const logger = require('./utils/logger');

// Get Sentry DSN from environment variables
const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: process.env.SENTRY_SEND_DEFAULT_PII !== 'false',
    
    // Environment configuration
    environment: process.env.NODE_ENV || process.env.SENTRY_ENVIRONMENT || 'development',
    
    // Traces sample rate for performance monitoring (0.0 to 1.0)
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE 
      ? parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) 
      : 1.0,
    
    // Enable debug mode in development
    debug: process.env.SENTRY_DEBUG === 'true' || false,
    
    // Before send hook - ensure errors are properly formatted
    beforeSend(event, hint) {
      // Ensure error is properly formatted
      if (event.exception && event.exception.values) {
        event.exception.values.forEach(exception => {
          if (!exception.type || (exception.type === 'Error' && !exception.value)) {
            exception.type = exception.type || 'Error';
            exception.value = exception.value || 'Unknown error';
          }
        });
      }
      
      // Log that we're sending the event (development only)
      if (process.env.NODE_ENV === 'development') {
        logger.log('📤 Sending error to Sentry:', event.message || event.exception?.values?.[0]?.value);
      }
      
      return event;
    },
    
    // Release version (optional, useful for tracking deployments)
    // Use environment variable or fallback to package.json version
    release: process.env.SENTRY_RELEASE || (() => {
      try {
        const pkg = require('../package.json');
        return pkg.version ? `taatom-backend@${pkg.version}` : undefined;
      } catch {
        return undefined;
      }
    })(),
    
    // Integrations
    integrations: [
      // Enable HTTP integration for capturing HTTP errors
      Sentry.httpIntegration(),
      // Enable Express integration for capturing Express errors
      Sentry.expressIntegration(),
    ],
  });
  
  logger.log('✅ Sentry initialized successfully');
} else {
  logger.warn('⚠️  Sentry DSN not found. Sentry error tracking is disabled.');
  logger.warn('   Set SENTRY_DSN in your .env file to enable error tracking.');
}

module.exports = Sentry;

