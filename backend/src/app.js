const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

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

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const sanitizeInput = require('./middleware/sanitizeInput');
const { generateCSRF, verifyCSRF } = require('./middleware/csrfProtection');

const app = express();

// Connect to MongoDB
connectDB();

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

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:8081',
      process.env.SUPERADMIN_URL || 'http://localhost:5001',
      'http://localhost:5003',
      'http://localhost:8081',
      'http://192.168.1.9:8081',
      'http://192.168.1.8:8081',
      'http://192.168.1.9:3000',
      'http://192.168.1.8:3000',
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Allow any local network IP
      /^http:\/\/localhost:\d+$/, // Allow any localhost port
      'file://',
      'null'
    ];
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Platform', 'User-Agent', 'x-platform'],
  exposedHeaders: ['X-CSRF-Token']
}));

// Cookie parser (needed for CSRF tokens)
app.use(cookieParser());

// Enhanced rate limiting
const { generalLimiter } = require('./middleware/rateLimit');

// Apply general rate limiting
app.use(generalLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization middleware (applied to all routes)
app.use(sanitizeInput);

// CSRF protection - Generate token for all requests
app.use(generateCSRF);

// Note: Endpoint-specific rate limiting is applied in individual route files
// using endpointLimiters from rateLimit middleware

// CSRF verification for state-changing requests (POST, PUT, DELETE, PATCH)
// Skip CSRF for public auth endpoints (signin, signup, etc.) since user isn't authenticated yet
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Skip CSRF for public auth endpoints
    const publicAuthPaths = [
      '/auth/signin',
      '/auth/signup',
      '/auth/verify-otp',
      '/auth/resend-otp',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/google',
      '/auth/check-username'
    ];
    
    const isPublicAuthEndpoint = publicAuthPaths.some(path => req.path === path || req.path.startsWith(path + '/'));
    
    if (isPublicAuthEndpoint) {
      return next();
    }
    
    // For web, check if request has X-Platform header (indicates it's from our frontend)
    // Mobile apps don't need CSRF protection (they use Bearer tokens)
    const platform = req.headers['x-platform'];
    if (platform && platform !== 'web') {
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
app.use('/api/superadmin', enhancedSuperAdminRoutes);
app.use('/notifications', notificationRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/feature-flags', featureFlagsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    message: 'Taatom API is running!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
