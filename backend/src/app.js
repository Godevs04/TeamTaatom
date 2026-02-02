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
    
    // Swagger UI setup - Enhanced with attractive styling and comprehensive options
    const swaggerOptions = {
      customCss: `
        /* ============================================
           PROFESSIONAL SWAGGER UI STYLING
           Enterprise-grade design with modern aesthetics
           ============================================ */
        
        /* Global Reset & Base Styles */
        .swagger-ui { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.6;
        }
        
        /* Hide Swagger topbar */
        .swagger-ui .topbar { display: none !important; }
        
        /* Professional Header Section */
        .swagger-ui .info { 
          margin: 0 0 40px 0; 
          padding: 0;
          background: transparent;
          border-bottom: 3px solid #e5e7eb;
          padding-bottom: 30px;
        }
        
        .swagger-ui .info .title { 
          color: #111827; 
          font-size: 2.25rem; 
          font-weight: 700; 
          margin: 0 0 8px 0;
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .swagger-ui .info .title::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 32px;
          background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
          border-radius: 2px;
        }
        
        .swagger-ui .info .description { 
          color: #4b5563; 
          line-height: 1.75; 
          font-size: 0.95rem;
          margin-top: 20px;
          max-width: 900px;
        }
        
        .swagger-ui .info .description h1 { 
          color: #111827; 
          font-size: 1.5rem;
          font-weight: 600;
          margin: 24px 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .swagger-ui .info .description h2 { 
          color: #1f2937; 
          font-size: 1.25rem;
          font-weight: 600;
          margin: 20px 0 10px 0;
        }
        
        .swagger-ui .info .description h3 { 
          color: #374151; 
          font-size: 1.1rem;
          font-weight: 600;
          margin: 16px 0 8px 0;
        }
        
        .swagger-ui .info .description code { 
          background: #f3f4f6; 
          color: #2563eb; 
          padding: 3px 8px; 
          border-radius: 4px; 
          font-size: 0.875rem;
          font-weight: 500;
          border: 1px solid #e5e7eb;
        }
        
        .swagger-ui .info .description pre {
          background: #1f2937;
          color: #f9fafb;
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
          border: 1px solid #374151;
        }
        
        .swagger-ui .info .description pre code {
          background: transparent;
          color: #f9fafb;
          border: none;
          padding: 0;
        }
        
        /* Professional Authentication Section */
        .swagger-ui .scheme-container { 
          background: #ffffff; 
          padding: 24px; 
          margin: 30px 0; 
          border-radius: 8px; 
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .swagger-ui .btn.authorize { 
          background: #2563eb; 
          border: none; 
          color: white; 
          padding: 10px 24px; 
          border-radius: 6px; 
          font-weight: 600; 
          font-size: 0.875rem;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
        }
        
        .swagger-ui .btn.authorize:hover { 
          background: #1d4ed8;
          box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);
          transform: translateY(-1px);
        }
        
        /* Professional HTTP Method Blocks */
        .swagger-ui .opblock { 
          border-radius: 6px; 
          margin-bottom: 12px; 
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          transition: all 0.2s ease;
          background: #ffffff;
        }
        
        .swagger-ui .opblock:hover { 
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          border-color: #d1d5db;
        }
        
        .swagger-ui .opblock.opblock-post { 
          border-left: 4px solid #10b981; 
          background: #ffffff;
        }
        
        .swagger-ui .opblock.opblock-get { 
          border-left: 4px solid #3b82f6; 
          background: #ffffff;
        }
        
        .swagger-ui .opblock.opblock-put { 
          border-left: 4px solid #f59e0b; 
          background: #ffffff;
        }
        
        .swagger-ui .opblock.opblock-delete { 
          border-left: 4px solid #ef4444; 
          background: #ffffff;
        }
        
        .swagger-ui .opblock.opblock-patch { 
          border-left: 4px solid #06b6d4; 
          background: #ffffff;
        }
        
        /* Operation Summary */
        .swagger-ui .opblock-summary { 
          padding: 16px 20px; 
          cursor: pointer;
        }
        
        .swagger-ui .opblock-summary-method { 
          padding: 4px 10px; 
          border-radius: 4px; 
          font-weight: 700; 
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          min-width: 60px;
          text-align: center;
        }
        
        .swagger-ui .opblock-summary-path { 
          font-weight: 600; 
          font-size: 1rem;
          color: #111827;
          font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
        }
        
        .swagger-ui .opblock-summary-description { 
          color: #6b7280; 
          font-size: 0.875rem;
          margin-top: 4px;
        }
        
        /* Professional Buttons */
        .swagger-ui .btn { 
          border-radius: 6px; 
          font-weight: 500; 
          font-size: 0.875rem;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }
        
        .swagger-ui .btn.execute { 
          background: #2563eb; 
          border-color: #2563eb; 
          color: white; 
          padding: 8px 20px;
        }
        
        .swagger-ui .btn.execute:hover { 
          background: #1d4ed8;
          border-color: #1d4ed8;
        }
        
        .swagger-ui .btn.cancel { 
          background: #6b7280; 
          border-color: #6b7280;
          color: white;
        }
        
        .swagger-ui .btn.cancel:hover {
          background: #4b5563;
          border-color: #4b5563;
        }
        
        /* Parameters Section */
        .swagger-ui .parameters-container { 
          background: #f9fafb; 
          padding: 20px; 
          border-radius: 6px; 
          margin: 16px 0; 
          border: 1px solid #e5e7eb;
        }
        
        .swagger-ui .parameter__name { 
          font-weight: 600; 
          color: #111827;
          font-size: 0.875rem;
        }
        
        .swagger-ui .parameter__type { 
          color: #2563eb; 
          font-weight: 500;
          font-size: 0.8125rem;
        }
        
        .swagger-ui .parameter__in { 
          background: #dbeafe; 
          color: #1e40af; 
          padding: 2px 8px; 
          border-radius: 4px; 
          font-size: 0.75rem;
          font-weight: 600;
        }
        
        .swagger-ui .body-param-content { 
          background: #ffffff; 
          border-radius: 6px; 
          padding: 16px;
          border: 1px solid #e5e7eb;
        }
        
        /* Response Section */
        .swagger-ui .response-col_status { 
          font-weight: 700; 
          font-size: 0.875rem;
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .swagger-ui .response-col_status[data-code="200"],
        .swagger-ui .response-col_status[data-code="201"] { 
          color: #10b981;
          background: #d1fae5;
        }
        
        .swagger-ui .response-col_status[data-code="400"] { 
          color: #f59e0b;
          background: #fef3c7;
        }
        
        .swagger-ui .response-col_status[data-code="401"],
        .swagger-ui .response-col_status[data-code="403"] { 
          color: #ef4444;
          background: #fee2e2;
        }
        
        .swagger-ui .response-col_status[data-code="404"] { 
          color: #8b5cf6;
          background: #ede9fe;
        }
        
        .swagger-ui .response-col_status[data-code="500"] { 
          color: #dc2626;
          background: #fee2e2;
        }
        
        .swagger-ui .response-col_links { 
          min-width: 6em; 
        }
        
        .swagger-ui .response-content-type { 
          margin-top: 12px; 
          padding: 12px; 
          background: #f9fafb; 
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        
        /* Models/Schemas */
        .swagger-ui .model-title { 
          font-weight: 700; 
          color: #111827; 
          font-size: 1.125rem;
          margin-bottom: 12px;
        }
        
        .swagger-ui .model-box { 
          background: #ffffff; 
          border-radius: 6px; 
          padding: 20px; 
          margin: 12px 0; 
          border: 1px solid #e5e7eb;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        
        .swagger-ui .model-toggle { 
          cursor: pointer; 
          color: #2563eb;
          font-weight: 500;
        }
        
        .swagger-ui .model-toggle:hover { 
          color: #1d4ed8;
        }
        
        .swagger-ui .property-row { 
          padding: 10px 0; 
          border-bottom: 1px solid #f3f4f6; 
        }
        
        .swagger-ui .property-row:last-child { 
          border-bottom: none; 
        }
        
        /* Code Blocks */
        .swagger-ui .highlight-code { 
          background: #1f2937; 
          color: #f9fafb; 
          padding: 16px; 
          border-radius: 6px; 
          font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
          border: 1px solid #374151;
        }
        
        .swagger-ui pre { 
          background: #1f2937; 
          color: #f9fafb; 
          padding: 16px; 
          border-radius: 6px; 
          overflow-x: auto;
          border: 1px solid #374151;
        }
        
        .swagger-ui code { 
          background: #f3f4f6; 
          color: #2563eb; 
          padding: 2px 6px; 
          border-radius: 4px; 
          font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
          font-size: 0.875rem;
          border: 1px solid #e5e7eb;
        }
        
        /* Tags */
        .swagger-ui .tag { 
          background: #f3f4f6; 
          color: #374151; 
          padding: 6px 14px; 
          border-radius: 6px; 
          margin: 4px 8px 4px 0; 
          display: inline-block;
          font-weight: 500;
          font-size: 0.875rem;
          border: 1px solid #e5e7eb;
        }
        
        .swagger-ui .tag-item { 
          margin: 16px 0;
          padding: 16px;
          background: #ffffff;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }
        
        .swagger-ui .tag-description { 
          color: #6b7280; 
          margin-top: 8px;
          font-size: 0.875rem;
        }
        
        /* Filter Box */
        .swagger-ui .filter-container { 
          padding: 20px; 
          background: #ffffff; 
          border-radius: 6px; 
          margin-bottom: 24px;
          border: 1px solid #e5e7eb;
        }
        
        .swagger-ui .filter-container input { 
          padding: 10px 16px; 
          border-radius: 6px; 
          border: 1px solid #d1d5db; 
          width: 100%;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }
        
        .swagger-ui .filter-container input:focus { 
          border-color: #2563eb; 
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        
        /* Loading States */
        .swagger-ui .loading-container { 
          text-align: center; 
          padding: 40px; 
          color: #6b7280; 
        }
        
        /* Professional Scrollbar */
        .swagger-ui ::-webkit-scrollbar { 
          width: 10px; 
          height: 10px; 
        }
        
        .swagger-ui ::-webkit-scrollbar-track { 
          background: #f9fafb; 
          border-radius: 5px; 
        }
        
        .swagger-ui ::-webkit-scrollbar-thumb { 
          background: #d1d5db; 
          border-radius: 5px; 
        }
        
        .swagger-ui ::-webkit-scrollbar-thumb:hover { 
          background: #9ca3af; 
        }
        
        /* Table Styling */
        .swagger-ui table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
        }
        
        .swagger-ui table th {
          background: #f9fafb;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #111827;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .swagger-ui table td {
          padding: 12px;
          border-bottom: 1px solid #f3f4f6;
        }
        
        .swagger-ui table tr:hover {
          background: #f9fafb;
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
          .swagger-ui .info .title { 
            font-size: 1.75rem; 
          }
          
          .swagger-ui .scheme-container { 
            padding: 16px; 
          }
          
          .swagger-ui .opblock-summary {
            padding: 12px 16px;
          }
        }
        
        /* Smooth Transitions */
        .swagger-ui .opblock-body { 
          transition: all 0.2s ease; 
        }
        
        /* Badge Styling */
        .swagger-ui .opblock-summary-method { 
          text-transform: uppercase; 
          letter-spacing: 0.5px; 
        }
        
        /* Input Fields */
        .swagger-ui input[type="text"],
        .swagger-ui input[type="email"],
        .swagger-ui input[type="password"],
        .swagger-ui input[type="number"],
        .swagger-ui textarea,
        .swagger-ui select {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }
        
        .swagger-ui input:focus,
        .swagger-ui textarea:focus,
        .swagger-ui select:focus {
          border-color: #2563eb;
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        
        /* Link Styling */
        .swagger-ui a {
          color: #2563eb;
          text-decoration: none;
          transition: color 0.2s ease;
        }
        
        .swagger-ui a:hover {
          color: #1d4ed8;
          text-decoration: underline;
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
          // Add CSRF token if available (runs in browser)
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
            // Add custom event listeners after Swagger UI loads
            console.log('✅ Swagger UI loaded successfully');
            
            // Add smooth scroll behavior
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
              anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              });
            });
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
