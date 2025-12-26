const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const Sentry = require('./instrument');
const logger = require('./utils/logger');

// Import database connection
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const profileRoutes = require('./routes/profileRoutes');
const chatRoutes = require('./routes/chat.routes');
const shortsRoutes = require('./routes/shortsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const enhancedSuperAdminRoutes = require('./routes/enhancedSuperAdminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const featureFlagsRoutes = require('./routes/featureFlagsRoutes');
const hashtagRoutes = require('./routes/hashtagRoutes');
const collectionRoutes = require('./routes/collectionRoutes');
const songRoutes = require('./routes/songRoutes');
const localeRoutes = require('./routes/localeRoutes');
const policyRoutes = require('./routes/policyRoutes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const sanitizeInput = require('./middleware/sanitizeInput');
const { generateCSRF, verifyCSRF } = require('./middleware/csrfProtection');
const { queryMonitor } = require('./middleware/queryMonitor');

const app = express();

// Note: Sentry Express integration is handled by expressIntegration() in instrument.js
// setupExpressErrorHandler will be called after routes are defined

// Connect to MongoDB - store promise for server.js to await
// Skip connection in test environment if already connected (to avoid conflicts)
let dbConnectionPromise;
if (process.env.NODE_ENV === 'test') {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState === 1) {
    // Already connected (e.g., by test setup)
    dbConnectionPromise = Promise.resolve();
  } else {
    dbConnectionPromise = connectDB();
  }
} else {
  dbConnectionPromise = connectDB();
}

// Initialize query monitoring after DB connection is established
dbConnectionPromise
  .then(() => {
    // Wait a bit more to ensure mongoose is fully ready
    setTimeout(() => {
      const { initializeQueryMonitoring } = require('./middleware/queryMonitor');
      if (process.env.ENABLE_QUERY_MONITORING !== 'false') {
        initializeQueryMonitoring();
      }
    }, 500);
  })
  .catch((error) => {
    logger.error('Failed to initialize query monitoring:', error);
  });

// Security middleware - Helmet.js with comprehensive security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for images/videos
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true, // Prevent MIME type sniffing
  xssFilter: true, // Enable XSS filter
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: 'deny' }, // Prevent clickjacking
  hidePoweredBy: true, // Hide X-Powered-By header
  ieNoOpen: true, // Prevent IE from executing downloads
  permittedCrossDomainPolicies: false, // Block Adobe Flash and Acrobat
}));

// CORS configuration - environment-aware
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Production: Only allow specific domains
    if (isProduction) {
      const productionOrigins = [
        process.env.FRONTEND_URL,
        process.env.SUPERADMIN_URL,
      ].filter(Boolean); // Remove undefined values
      
      if (productionOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn(`CORS blocked origin in production: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
    
    // Development: Allow localhost and local network (development-only fallbacks)
    // In production, these should never be used - only FRONTEND_URL and SUPERADMIN_URL from env
    const devOrigins = [
      process.env.FRONTEND_URL,
      process.env.SUPERADMIN_URL,
      // Development-only fallbacks (never used in production)
      ...(isDevelopment ? [
        'http://localhost:5003',
        'http://localhost:8081',
        'http://x:8081',
        'http://x:3000',
        'file://',
        'null'
      ] : [])
    ].filter(Boolean); // Remove undefined values
    
    // In development, also allow localhost with any port and local network IPs
    const devPatterns = [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
    ];
    
    // Check exact matches first
    if (devOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check patterns in development only
    if (isDevelopment && devPatterns.some(pattern => pattern.test(origin))) {
      return callback(null, true);
    }
    
    // Default: reject
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Platform', 'User-Agent', 'x-platform'],
  exposedHeaders: ['X-CSRF-Token']
}));

// Cookie parser (needed for CSRF tokens)
app.use(cookieParser());

// Response compression middleware (compress all responses)
app.use(compression({
  filter: (req, res) => {
    // Compress all responses except if explicitly disabled
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for all text-based responses
    return compression.filter(req, res);
  },
  level: 6, // Compression level (0-9, 6 is a good balance)
  threshold: 1024 // Only compress responses larger than 1KB
}));

// Enhanced rate limiting
const { generalLimiter } = require('./middleware/rateLimit');

// Apply general rate limiting
app.use(generalLimiter);

// Body parsing middleware with stricter limits per endpoint type
// Default limits (can be overridden per route)
app.use(express.json({ 
  limit: process.env.MAX_JSON_BODY_SIZE || '1mb', // Stricter default: 1MB for JSON
  verify: (req, res, buf) => {
    // Additional validation: reject if body is too large
    if (buf.length > 1 * 1024 * 1024) { // 1MB
      throw new Error('Request body too large');
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_URLENCODED_BODY_SIZE || '1mb' // Stricter default: 1MB
}));

// Input sanitization middleware (applied to all routes)
app.use(sanitizeInput);

// Request/Response logging middleware (applied to all routes)
const requestLogger = require('./middleware/requestLogger');
app.use(requestLogger);

// Request size limiting middleware (applied to all routes)
const { requestSizeLimiter } = require('./middleware/requestSizeLimiter');
app.use(requestSizeLimiter);

// Database query monitoring middleware (applied to all routes)
app.use(queryMonitor);

// CSRF protection - Generate token for all requests
app.use(generateCSRF);

// Note: Endpoint-specific rate limiting is applied in individual route files
// using endpointLimiters from rateLimit middleware

// CSRF verification for state-changing requests (POST, PUT, DELETE, PATCH)
// Skip CSRF for public auth endpoints (signin, signup, etc.) since user isn't authenticated yet
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Skip CSRF for public auth endpoints
    // Check both with and without /api/v1 prefix
    const publicAuthPaths = [
      '/auth/signin',
      '/auth/signup',
      '/auth/verify-otp',
      '/auth/resend-otp',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/google',
      '/auth/check-username',
      '/api/v1/auth/signin',
      '/api/v1/auth/signup',
      '/api/v1/auth/verify-otp',
      '/api/v1/auth/resend-otp',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
      '/api/v1/auth/google',
      '/api/v1/auth/check-username',
      '/api/superadmin/login',
      '/api/superadmin/verify-2fa',
      '/api/superadmin/resend-2fa',
      '/api/superadmin/create',
      '/api/superadmin/csrf-token',
      '/api/v1/superadmin/login',
      '/api/v1/superadmin/verify-2fa',
      '/api/v1/superadmin/resend-2fa',
      '/api/v1/superadmin/create',
      '/api/v1/superadmin/csrf-token'
    ];
    
    // Check if path matches exactly or starts with any public auth path
    const isPublicAuthEndpoint = publicAuthPaths.some(path => {
      return req.path === path || req.path.startsWith(path + '/');
    });
    
    if (isPublicAuthEndpoint) {
      return next();
    }
    
    // For web, check if request has X-Platform header (indicates it's from our frontend)
    // Mobile apps don't need CSRF protection (they use Bearer tokens)
    const platform = req.headers['x-platform'];
    const authHeader = req.headers['authorization'];
    
    // Skip CSRF if:
    // 1. Platform header indicates mobile app (not 'web')
    // 2. Request uses Bearer token authentication (mobile apps)
    // 3. User-Agent indicates mobile app (Expo, React Native, etc.)
    const userAgent = req.headers['user-agent'] || '';
    const isMobileApp = 
      (platform && platform !== 'web') ||
      (authHeader && authHeader.startsWith('Bearer ')) ||
      (userAgent && (
        userAgent.toLowerCase().includes('expo') ||
        userAgent.toLowerCase().includes('reactnative') ||
        userAgent.toLowerCase().includes('okhttp') ||
        userAgent.toLowerCase().includes('cfnetwork')
      ));
    
    if (isMobileApp) {
      // Mobile app - skip CSRF (uses Bearer token authentication)
      return next();
    }
    
    return verifyCSRF(req, res, next);
  }
  next();
});

// API Versioning - Mount v1 routes
const v1Routes = require('./routes/v1');
app.use('/api/v1', v1Routes);

// Legacy routes (for backward compatibility - can be removed after frontend migration)
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/profile', profileRoutes);
app.use('/chat', chatRoutes);
app.use('/shorts', shortsRoutes);
app.use('/settings', settingsRoutes);
app.use('/api/v1/superadmin', enhancedSuperAdminRoutes);
app.use('/api/superadmin', enhancedSuperAdminRoutes); // backward compatibility for older clients
app.use('/notifications', notificationRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/feature-flags', featureFlagsRoutes);
app.use('/hashtags', hashtagRoutes);
app.use('/collections', collectionRoutes);
app.use('/api/v1/songs', songRoutes);
app.use('/api/v1/locales', localeRoutes);

// Swagger API Documentation (only in development)
if (process.env.NODE_ENV === 'development') {
  try {
    const swaggerUi = require('swagger-ui-express');
    const swaggerSpec = require('./config/swagger');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 50px 0; }
        .swagger-ui .scheme-container { background: #fafafa; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .swagger-ui .btn.authorize { background-color: #4CAF50; border-color: #4CAF50; }
        .swagger-ui .btn.authorize:hover { background-color: #45a049; }
        .swagger-ui .opblock.opblock-post { border-color: #49cc90; background: rgba(73, 204, 144, .1); }
        .swagger-ui .opblock.opblock-get { border-color: #61affe; background: rgba(97, 175, 254, .1); }
        .swagger-ui .opblock.opblock-put { border-color: #fca130; background: rgba(252, 161, 48, .1); }
        .swagger-ui .opblock.opblock-delete { border-color: #f93e3e; background: rgba(249, 62, 62, .1); }
      `,
      customSiteTitle: 'Taatom API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        requestInterceptor: (request) => {
          // Add CSRF token if available
          const csrfToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrf-token='))
            ?.split('=')[1];
          if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
            request.headers['X-CSRF-Token'] = csrfToken;
          }
          return request;
        },
        onComplete: () => {
          logger.log('Swagger UI loaded successfully');
        }
      }
    }));
    const port = process.env.PORT || 3000;
    const swaggerUrl = process.env.API_PUBLIC_URL || process.env.API_BASE_URL_PROD || (isDevelopment ? `http://localhost:${port}` : '');
    if (swaggerUrl) {
      logger.log(`📚 Swagger docs available at ${swaggerUrl}/api-docs`);
    }
  } catch (error) {
    logger.warn('⚠️  Swagger not available. Install dependencies: npm install swagger-jsdoc swagger-ui-express');
  }
}

// Policy routes (serve markdown files - public access, before 404 handler)
app.use('/', policyRoutes);

// Health check routes (before other routes for quick access)
const healthRoutes = require('./routes/healthRoutes');
app.use('/health', healthRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Sentry Express error handler (must be BEFORE custom error handler)
// This sets up Sentry's error handling middleware to capture errors first
// Skip in test environment to avoid warnings
if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler (runs after Sentry captures the error)
// This sends the response to the client
app.use(errorHandler);

// Export both app and dbConnectionPromise so server.js can wait for DB connection
module.exports = { app, dbConnectionPromise };
