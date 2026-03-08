const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
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
const mapsRoutes = require('./routes/mapsRoutes');
const policyRoutes = require('./routes/policyRoutes');
const shortUrlRoutes = require('./routes/shortUrlRoutes');

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
    
    // Production: Only allow specific domains (FRONTEND_URL, WEB_FRONTEND_URL, SUPERADMIN_URL)
    if (isProduction) {
      const productionOrigins = [
        process.env.FRONTEND_URL,
        process.env.WEB_FRONTEND_URL,
        process.env.SUPERADMIN_URL,
      ].filter(Boolean); // Remove undefined values
      
      if (productionOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn('CORS blocked origin in production. Set FRONTEND_URL, WEB_FRONTEND_URL, or SUPERADMIN_URL in backend env to the allowed origin.');
      return callback(new Error('Not allowed by CORS'));
    }
    
    // Development: Allow localhost and local network (development-only fallbacks)
    const devOrigins = [
      process.env.FRONTEND_URL,
      process.env.WEB_FRONTEND_URL,
      process.env.SUPERADMIN_URL,
      // Development-only fallbacks (never used in production)
      ...(isDevelopment ? [
        'http://localhost:5003',
        'http://localhost:8081',
        'http://localhost:3001',
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

// Request ID for tracing (X-Request-Id header; do not log tokens or full body)
const crypto = require('crypto');
app.use((req, res, next) => {
  req.id = req.get('x-request-id') || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

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
    const platform = req.headers['x-platform'] || req.headers['X-Platform'];
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    
    // Skip CSRF if:
    // 1. Platform header indicates mobile app (not 'web')
    // 2. Request uses Bearer token authentication (mobile apps)
    // 3. User-Agent indicates mobile app (Expo, React Native, etc.)
    const userAgent = (req.headers['user-agent'] || req.headers['User-Agent'] || '').toLowerCase();
    const isMobileApp = 
      (platform && platform.toLowerCase() !== 'web') ||
      (authHeader && authHeader.trim().toLowerCase().startsWith('bearer')) ||
      (userAgent && (
        userAgent.includes('expo') ||
        userAgent.includes('reactnative') ||
        userAgent.includes('okhttp') ||
        userAgent.includes('cfnetwork') ||
        userAgent.includes('darwin') // iOS/macOS native apps
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
app.use('/api/v1/maps', mapsRoutes);

// Swagger API Documentation
// Enable in development or when ENABLE_SWAGGER=true (for production)
const enableSwagger = process.env.NODE_ENV === 'development' || process.env.ENABLE_SWAGGER === 'true';
if (enableSwagger) {
  try {
    const swaggerUi = require('swagger-ui-express');
    const swaggerSpec = require('./config/swagger');
    
    // Swagger UI setup — Elegant white theme
    const swaggerOptions = {
      customCss: `
        /* ============================================
           TAATOM API DOCS — Elegant white theme
           ============================================ */
        
        /* Force elegant white theme (override any Swagger default dark theme) */
        body,
        body.swagger-ui-body,
        .swagger-ui,
        #swagger-ui,
        #swagger-ui .swagger-ui,
        .swagger-ui .information-container,
        .swagger-ui .wrapper {
          background: #f8fafc !important;
          color: #0f172a !important;
        }
        
        .swagger-ui {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          padding: 0 0 48px;
        }
        
        .swagger-ui .topbar { display: none !important; }
        
        /* Header — clean and minimal */
        .swagger-ui .info {
          margin: 0 0 48px 0;
          padding: 32px 0 36px;
          background: #ffffff !important;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          padding: 32px 40px 36px;
        }
        
        .swagger-ui .info .title {
          color: #0f172a !important;
          font-size: 2rem;
          font-weight: 700;
          margin: 0 0 6px 0;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .swagger-ui .info .title::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 28px;
          background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
          border-radius: 2px;
        }
        
        .swagger-ui .info .description {
          color: #0f172a !important;
          line-height: 1.75;
          font-size: 0.9375rem;
          margin-top: 20px;
          max-width: 720px;
        }
        .swagger-ui .info .description p,
        .swagger-ui .info .description li,
        .swagger-ui .info .description span {
          color: #0f172a !important;
        }
        
        .swagger-ui .info .description h1 {
          color: #0f172a !important;
          font-size: 1.375rem;
          font-weight: 600;
          margin: 28px 0 10px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .swagger-ui .info .description h2 {
          color: #1e293b !important;
          font-size: 1.125rem;
          font-weight: 600;
          margin: 20px 0 8px 0;
        }
        
        .swagger-ui .info .description h3 {
          color: #334155 !important;
          font-size: 1rem;
          font-weight: 600;
          margin: 16px 0 6px 0;
        }
        
        .swagger-ui .info .description code {
          background: #f1f5f9 !important;
          color: #2563eb !important;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
          border: 1px solid #e2e8f0;
        }
        
        .swagger-ui .info .description pre {
          background: #1e293b !important;
          color: #e2e8f0 !important;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          border: 1px solid #334155;
        }
        
        .swagger-ui .info .description pre code {
          background: transparent !important;
          color: #e2e8f0 !important;
          border: none;
        }
        
        /* Auth / scheme container */
        .swagger-ui .scheme-container {
          background: #ffffff !important;
          padding: 24px 28px;
          margin: 32px 0;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        
        .swagger-ui .btn.authorize {
          background: #2563eb !important;
          border: none !important;
          color: #fff !important;
          padding: 10px 22px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.875rem;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
        }
        
        .swagger-ui .btn.authorize:hover {
          background: #1d4ed8 !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
          transform: translateY(-1px);
        }
        
        /* Operation blocks — white cards */
        .swagger-ui .opblock {
          border-radius: 10px !important;
          margin-bottom: 14px !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;
          transition: all 0.2s ease;
          background: #ffffff !important;
        }
        
        .swagger-ui .opblock:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.06) !important;
          border-color: #cbd5e1 !important;
        }
        
        .swagger-ui .opblock.opblock-post {
          border-left: 4px solid #059669 !important;
          background: #ffffff !important;
        }
        
        .swagger-ui .opblock.opblock-get {
          border-left: 4px solid #2563eb !important;
          background: #ffffff !important;
        }
        
        .swagger-ui .opblock.opblock-put {
          border-left: 4px solid #d97706 !important;
          background: #ffffff !important;
        }
        
        .swagger-ui .opblock.opblock-delete {
          border-left: 4px solid #dc2626 !important;
          background: #ffffff !important;
        }
        
        .swagger-ui .opblock.opblock-patch {
          border-left: 4px solid #0891b2 !important;
          background: #ffffff !important;
        }
        
        .swagger-ui .opblock-summary {
          padding: 18px 22px;
          cursor: pointer;
        }
        
        .swagger-ui .opblock-summary-method {
          padding: 5px 12px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          min-width: 56px;
          text-align: center;
        }
        
        .swagger-ui .opblock-summary-path {
          font-weight: 600 !important;
          font-size: 1rem;
          color: #0f172a !important;
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        }
        
        .swagger-ui .opblock-summary-description {
          color: #0f172a !important;
          font-size: 0.875rem;
          margin-top: 4px;
        }
        
        .swagger-ui .btn {
          border-radius: 8px;
          font-weight: 500;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }
        
        .swagger-ui .btn.execute {
          background: #2563eb !important;
          border-color: #2563eb !important;
          color: #fff !important;
          padding: 8px 18px;
        }
        
        .swagger-ui .btn.execute:hover {
          background: #1d4ed8 !important;
          border-color: #1d4ed8 !important;
        }
        
        .swagger-ui .btn.cancel {
          background: #64748b !important;
          border-color: #64748b !important;
          color: #fff !important;
        }
        
        .swagger-ui .btn.cancel:hover {
          background: #475569 !important;
          border-color: #475569 !important;
        }
        
        .swagger-ui .parameters-container {
          background: #f8fafc !important;
          padding: 20px 24px;
          border-radius: 10px;
          margin: 16px 0;
          border: 1px solid #e2e8f0;
        }
        
        .swagger-ui .parameter__name {
          font-weight: 600 !important;
          color: #0f172a !important;
          font-size: 0.875rem;
        }
        
        .swagger-ui .parameter__type {
          color: #2563eb !important;
          font-weight: 500;
          font-size: 0.8125rem;
        }
        
        .swagger-ui .parameter__in {
          background: #dbeafe !important;
          color: #1e40af !important;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        .swagger-ui .body-param-content {
          background: #ffffff !important;
          border-radius: 8px;
          padding: 16px;
          border: 1px solid #e2e8f0;
        }
        
        .swagger-ui .response-col_status {
          font-weight: 700;
          font-size: 0.8125rem;
          padding: 4px 10px;
          border-radius: 6px;
        }
        
        .swagger-ui .response-col_status[data-code="200"],
        .swagger-ui .response-col_status[data-code="201"] {
          color: #047857 !important;
          background: #d1fae5 !important;
        }
        
        .swagger-ui .response-col_status[data-code="400"] {
          color: #b45309 !important;
          background: #fef3c7 !important;
        }
        
        .swagger-ui .response-col_status[data-code="401"],
        .swagger-ui .response-col_status[data-code="403"] {
          color: #b91c1c !important;
          background: #fee2e2 !important;
        }
        
        .swagger-ui .response-col_status[data-code="404"] {
          color: #6d28d9 !important;
          background: #ede9fe !important;
        }
        
        .swagger-ui .response-col_status[data-code="500"] {
          color: #b91c1c !important;
          background: #fee2e2 !important;
        }
        
        /* Parameters / Responses section headers — light theme (fix partial black) */
        .swagger-ui .opblock-section-header,
        .swagger-ui .opblock-section-header h4,
        .swagger-ui .opblock-section-header h3,
        .swagger-ui .tab-header,
        .swagger-ui .opblock-section .opblock-section-header,
        .swagger-ui [class*="opblock-section"] [class*="header"],
        .swagger-ui .responses-inner h4,
        .swagger-ui .parameters-col__name {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border-bottom: 1px solid #e2e8f0 !important;
          border-top: none !important;
        }
        .swagger-ui .opblock-section-header:hover {
          background: #e2e8f0 !important;
        }
        /* Override any dark header bar Swagger might add */
        .swagger-ui .opblock-body .opblock-section-header {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
        }
        
        /* All body text in opblock and responses — black for visibility */
        .swagger-ui .opblock-body p,
        .swagger-ui .opblock-body span,
        .swagger-ui .opblock-body .parameter__name,
        .swagger-ui .response-col_description,
        .swagger-ui .response-col_links,
        .swagger-ui .responses-inner td,
        .swagger-ui .responses-table td,
        .swagger-ui .table-container,
        .swagger-ui .parameter__name.required,
        .swagger-ui .parameter-row,
        .swagger-ui .opblock-description-wrapper,
        .swagger-ui .opblock-external-docs-wrapper,
        .swagger-ui .opblock-title_normal {
          color: #0f172a !important;
        }
        .swagger-ui .opblock-body .renderedMarkdown,
        .swagger-ui .opblock-body .markdown {
          color: #0f172a !important;
        }
        .swagger-ui .no-margin,
        .swagger-ui .parameter__empty,
        .swagger-ui .opblock-body .opblock-description {
          color: #0f172a !important;
        }
        
        .swagger-ui .response-content-type {
          margin-top: 12px;
          padding: 12px 16px;
          background: #f8fafc !important;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        
        .swagger-ui .model-title {
          font-weight: 700 !important;
          color: #0f172a !important;
          font-size: 1.0625rem;
          margin-bottom: 12px;
        }
        
        .swagger-ui .model-box {
          background: #ffffff !important;
          border-radius: 10px;
          padding: 20px 24px;
          margin: 12px 0;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        
        .swagger-ui .model-toggle {
          cursor: pointer;
          color: #2563eb !important;
          font-weight: 500;
        }
        
        .swagger-ui .model-toggle:hover {
          color: #1d4ed8 !important;
        }
        
        .swagger-ui .property-row {
          padding: 10px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        
        .swagger-ui .property-row:last-child { border-bottom: none; }
        
        /* Model/schema headers — light theme (fix black header bars e.g. Song, Success) */
        .swagger-ui .model-box-control,
        .swagger-ui .model-box-control .model-box-control,
        .swagger-ui .models-control,
        .swagger-ui .model .model-box-control,
        .swagger-ui [class*="model"] > div:first-child,
        .swagger-ui .prop-wrap .prop-name {
          background: #f8fafc !important;
          color: #0f172a !important;
          border: 1px solid #e2e8f0 !important;
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .swagger-ui .model-box-control:hover,
        .swagger-ui .models-control:hover {
          background: #f1f5f9 !important;
        }
        
        /* Schema/model property names and types — black text for visibility */
        .swagger-ui .prop-name,
        .swagger-ui .prop-type,
        .swagger-ui .prop-format,
        .swagger-ui .property-row .prop-name,
        .swagger-ui .property-row .prop-type,
        .swagger-ui .property-row span,
        .swagger-ui .model .prop-wrap,
        .swagger-ui .model .prop-name,
        .swagger-ui .model .prop-type,
        .swagger-ui .model .renderedMarkdown,
        .swagger-ui table.model .prop-name {
          color: #0f172a !important;
        }
        .swagger-ui .prop-type { color: #1d4ed8 !important; }
        
        /* Thick black dividers — light gray (fix black issue) */
        .swagger-ui hr,
        .swagger-ui .opblock-section hr,
        .swagger-ui .model-container hr,
        .swagger-ui .model-box-control + div,
        .swagger-ui [class*="model"] hr {
          border: none !important;
          border-top: 1px solid #e2e8f0 !important;
          margin: 16px 0;
        }
        .swagger-ui .model-box,
        .swagger-ui .model {
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px;
        }
        
        /* Schemas section — remove dark backedges / thick dark bars */
        .swagger-ui .models,
        .swagger-ui section.models,
        .swagger-ui .model-container,
        .swagger-ui .schemas,
        .swagger-ui [class*="models"] {
          background: transparent !important;
          border: none !important;
        }
        .swagger-ui .models h2,
        .swagger-ui .models .section-title,
        .swagger-ui section.models h2,
        .swagger-ui .model-container > h2,
        .swagger-ui .schemas h2 {
          background: #f8fafc !important;
          color: #0f172a !important;
          border: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
          padding: 16px 0;
          margin: 0 0 16px 0;
        }
        .swagger-ui .model-container .model,
        .swagger-ui .models .model,
        .swagger-ui .model-container > .model {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px;
          margin-bottom: 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .swagger-ui .model-container .model + .model,
        .swagger-ui .models .model + .model {
          margin-top: 0;
          border-top: 1px solid #e2e8f0 !important;
        }
        .swagger-ui .model-container .model-box-control,
        .swagger-ui .models .model-box-control {
          border-bottom: 1px solid #e2e8f0 !important;
        }
        .swagger-ui .model .model-box-control {
          border-radius: 10px 10px 0 0;
        }
        .swagger-ui .models .model-box-control,
        .swagger-ui .model-container .model-box-control {
          background: #f8fafc !important;
        }
        .swagger-ui .models .model-box,
        .swagger-ui .models .model,
        .swagger-ui .models .property-row,
        .swagger-ui .model-container .model-box,
        .swagger-ui .model-container .model {
          border-color: #e2e8f0 !important;
        }
        
        /* Snippets / cURL tabs — light theme (fix dark tab black issue) */
        .swagger-ui .tab-list,
        .swagger-ui .tab-item,
        .swagger-ui [class*="snippet"] .tab,
        .swagger-ui [class*="Snippet"] .tab,
        .swagger-ui .request-snippets .tab-list li,
        .swagger-ui .request-snippets .tab-item,
        .swagger-ui .snippet-tabs li,
        .swagger-ui .snippet-tab,
        .swagger-ui a.tablinks,
        .swagger-ui button[class*="tab"],
        .swagger-ui .responses-inner .tab-item {
          background: #f1f5f9 !important;
          color: #0f172a !important;
          border: 1px solid #e2e8f0 !important;
          border-bottom-color: #e2e8f0 !important;
        }
        .swagger-ui .tab-list li.selected,
        .swagger-ui .tab-item.active,
        .swagger-ui .request-snippets .tab-list li[aria-selected="true"],
        .swagger-ui .snippet-tabs li.selected,
        .swagger-ui a.tablinks.active,
        .swagger-ui button[class*="tab"][aria-selected="true"] {
          background: #ffffff !important;
          color: #0f172a !important;
          border-bottom-color: #ffffff !important;
          box-shadow: 0 -1px 0 0 #fff;
        }
        .swagger-ui .request-snippets,
        .swagger-ui [class*="snippet"] {
          border: 1px solid #e2e8f0 !important;
          background: #ffffff !important;
        }
        
        /* Example value / response code blocks — light text on dark (readable) */
        .swagger-ui .highlight-code,
        .swagger-ui pre,
        .swagger-ui .model-example,
        .swagger-ui .responses-inner pre,
        .swagger-ui .opblock-body pre,
        .swagger-ui .opblock-body .highlight-code,
        .swagger-ui [class*="example"] pre,
        .swagger-ui [class*="Example"] {
          background: #1e293b !important;
          color: #e2e8f0 !important;
          padding: 16px;
          border-radius: 8px;
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
          border: 1px solid #334155;
        }
        .swagger-ui pre code,
        .swagger-ui pre span,
        .swagger-ui pre div,
        .swagger-ui .highlight-code code,
        .swagger-ui .highlight-code span,
        .swagger-ui .highlight-code div,
        .swagger-ui .model-example code,
        .swagger-ui .model-example span,
        .swagger-ui .opblock-body pre *,
        .swagger-ui .opblock-body .highlight-code *,
        .swagger-ui .responses-inner pre *,
        .swagger-ui .microlight {
          background: transparent !important;
          color: #e2e8f0 !important;
          border: none;
        }
        
        /* Inline code (not inside pre / example blocks) */
        .swagger-ui code {
          background: #f1f5f9 !important;
          color: #2563eb !important;
          padding: 2px 6px;
          border-radius: 6px;
          font-size: 0.8125rem;
          border: 1px solid #e2e8f0;
        }
        .swagger-ui pre code,
        .swagger-ui .highlight-code code,
        .swagger-ui .model-example code {
          background: transparent !important;
          color: #e2e8f0 !important;
          padding: 0;
          border: none;
        }
        
        .swagger-ui .tag {
          background: #f1f5f9 !important;
          color: #334155 !important;
          padding: 6px 14px;
          border-radius: 8px;
          margin: 4px 8px 4px 0;
          font-weight: 500;
          font-size: 0.875rem;
          border: 1px solid #e2e8f0;
        }
        
        .swagger-ui .tag-item {
          margin: 18px 0;
          padding: 20px 24px;
          background: #ffffff !important;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        
        .swagger-ui .tag-description {
          color: #0f172a !important;
          margin-top: 8px;
          font-size: 0.875rem;
        }
        
        .swagger-ui .filter-container {
          padding: 20px 24px;
          background: #ffffff !important;
          border-radius: 10px;
          margin-bottom: 28px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        
        .swagger-ui .filter-container input {
          padding: 10px 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          width: 100%;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }
        
        .swagger-ui .filter-container input:focus {
          border-color: #2563eb;
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        
        .swagger-ui .loading-container {
          text-align: center;
          padding: 48px;
          color: #0f172a !important;
        }
        
        /* Force any remaining dark section headers to light + black text */
        .swagger-ui .model-container .model-box-control,
        .swagger-ui .model-container h4,
        .swagger-ui .model-container h5,
        .swagger-ui .schema-container .model-box-control,
        .swagger-ui div[class*="model"] h4,
        .swagger-ui div[class*="model"] h5 {
          background: #f8fafc !important;
          color: #0f172a !important;
          border: 1px solid #e2e8f0 !important;
        }
        
        /* Light scrollbars everywhere (fix partial dark scrollbar) */
        body,
        .swagger-ui,
        #swagger-ui {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        body::-webkit-scrollbar,
        .swagger-ui ::-webkit-scrollbar,
        #swagger-ui ::-webkit-scrollbar { width: 8px; height: 8px; }
        body::-webkit-scrollbar-track,
        .swagger-ui ::-webkit-scrollbar-track,
        #swagger-ui ::-webkit-scrollbar-track { background: #f1f5f9 !important; border-radius: 4px; }
        body::-webkit-scrollbar-thumb,
        .swagger-ui ::-webkit-scrollbar-thumb,
        #swagger-ui ::-webkit-scrollbar-thumb { background: #cbd5e1 !important; border-radius: 4px; }
        body::-webkit-scrollbar-thumb:hover,
        .swagger-ui ::-webkit-scrollbar-thumb:hover,
        #swagger-ui ::-webkit-scrollbar-thumb:hover { background: #94a3b8 !important; }
        
        .swagger-ui table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .swagger-ui table th {
          background: #f8fafc !important;
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          color: #0f172a !important;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .swagger-ui table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155 !important;
        }
        
        .swagger-ui table tr:hover {
          background: #f8fafc !important;
        }
        
        .swagger-ui .opblock-body { transition: all 0.2s ease; }
        
        .swagger-ui input[type="text"],
        .swagger-ui input[type="email"],
        .swagger-ui input[type="password"],
        .swagger-ui input[type="number"],
        .swagger-ui textarea,
        .swagger-ui select {
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 0.875rem;
          background: #ffffff !important;
          color: #0f172a !important;
        }
        
        .swagger-ui input:focus,
        .swagger-ui textarea:focus,
        .swagger-ui select:focus {
          border-color: #2563eb !important;
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        
        .swagger-ui a {
          color: #2563eb !important;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        
        .swagger-ui a:hover {
          color: #1d4ed8 !important;
          text-decoration: underline;
        }
        
        @media (max-width: 768px) {
          .swagger-ui .info .title { font-size: 1.5rem; }
          .swagger-ui .info { padding: 24px 20px 28px; }
          .swagger-ui .scheme-container { padding: 20px; }
          .swagger-ui .opblock-summary { padding: 14px 18px; }
        }
      `,
      customSiteTitle: 'Taatom API Documentation',
      customfavIcon: '/favicon.ico',
      customCssUrl: null, // Can be used to load external CSS
      swaggerOptions: {
        // Authorization persistence
        persistAuthorization: true,
        
        // Display options
        displayRequestDuration: true,
        displayOperationId: false,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        docExpansion: 'list', // 'none', 'list', or 'full'
        filter: true, // Enable filter box
        showExtensions: true,
        showCommonExtensions: true,
        showRequestHeaders: true,
        tryItOutEnabled: true, // Enable "Try it out" by default
        
        // Supported HTTP methods
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'],
        
        // Validation
        validatorUrl: null, // Disable online validator (faster loading)
        
        // Deep linking
        deepLinking: true, // Enable deep linking for operations
        
        // Request/Response interceptors
        requestInterceptor: (request) => {
          // Add CSRF token if available (runs in browser when Swagger UI is loaded)
          /* eslint-disable no-undef */
          if (typeof document !== 'undefined') {
            const csrfToken = document.cookie
              .split('; ')
              .find(row => row.startsWith('csrf-token='))
              ?.split('=')[1];
            if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
              request.headers['X-CSRF-Token'] = csrfToken;
            }
            
            // Add timestamp to prevent caching
            if (request.url && !request.url.includes('?')) {
              request.url += `?_t=${Date.now()}`;
            } else if (request.url && request.url.includes('?')) {
              request.url += `&_t=${Date.now()}`;
            }
          }
          /* eslint-enable no-undef */
          return request;
        },
        responseInterceptor: (response) => {
          // Log response for debugging (only in development)
          if (process.env.NODE_ENV === 'development' && typeof console !== 'undefined') {
            console.log('📡 Swagger Response:', {
              url: response.url,
              status: response.status,
              statusText: response.statusText,
              ok: response.ok
            });
          }
          return response;
        },
        
        // Callbacks
        onComplete: () => {
          if (typeof window !== 'undefined') {
            console.log('✅ Swagger UI loaded successfully');
            /* eslint-disable no-undef */
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
              anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              });
            });
            /* eslint-enable no-undef */
          }
        },
        
        // Syntax highlighting
        syntaxHighlight: {
          activated: true,
          theme: 'agate' // 'agate', 'monokai', 'github', etc.
        },
        
        // OAuth configuration (if needed)
        oauth: {
          clientId: process.env.SWAGGER_OAUTH_CLIENT_ID || null,
          clientSecret: process.env.SWAGGER_OAUTH_CLIENT_SECRET || null,
          realm: process.env.SWAGGER_OAUTH_REALM || null,
          appName: 'Taatom API',
          scopeSeparator: ' ',
          additionalQueryStringParams: {},
          useBasicAuthenticationWithAccessCodeGrant: false,
          usePkceWithAuthorizationCodeGrant: false
        },
        
        // Request snippets
        requestSnippetsEnabled: true,
        requestSnippets: {
          generators: {
            'curl_bash': {
              title: 'cURL (bash)',
              syntax: 'bash'
            },
            'curl_powershell': {
              title: 'cURL (PowerShell)',
              syntax: 'powershell'
            },
            'curl_cmd': {
              title: 'cURL (CMD)',
              syntax: 'bash'
            },
            'node': {
              title: 'Node.js',
              syntax: 'javascript'
            },
            'python': {
              title: 'Python',
              syntax: 'python'
            },
            'javascript': {
              title: 'JavaScript',
              syntax: 'javascript'
            }
          },
          defaultExpanded: true
        }
      }
    };
    
    // Setup Swagger UI - this handles both /api-docs and /api-docs/ routes
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));
    
    const port = process.env.PORT || 3000;
    const swaggerUrl = process.env.API_PUBLIC_URL || process.env.API_BASE_URL_PROD || (isDevelopment ? `http://localhost:${port}` : '');
    if (swaggerUrl) {
      logger.log(`📚 Swagger docs available at ${swaggerUrl}/api-docs`);
    } else {
      logger.log(`📚 Swagger docs available at /api-docs`);
    }
  } catch (error) {
    logger.error('⚠️  Swagger setup failed:', error.message);
    logger.warn('⚠️  Swagger not available. Install dependencies: npm install swagger-jsdoc swagger-ui-express');
  }
} else {
  logger.info('📚 Swagger is disabled. Set ENABLE_SWAGGER=true to enable in production.');
}

// Short URL routes (public redirect route at root level, BEFORE policy routes)
// IMPORTANT: Mount redirect route early to ensure it's matched
// Mount redirect route at root level: /s/:shortCode
app.use('/s', shortUrlRoutes.redirectRoute);
// Mount create route under API: /api/v1/short-url/create
app.use('/api/v1/short-url', shortUrlRoutes.createRoute);

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
