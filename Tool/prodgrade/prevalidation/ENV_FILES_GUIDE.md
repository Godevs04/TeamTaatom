# Environment Variables Guide - Production Grade Setup

This guide provides `.env.example` templates for all three projects (Frontend, Backend, SuperAdmin).

## 📁 Frontend (.env.example)

Create `frontend/.env.example`:

```env
# Taatom Frontend - Environment Variables
# Copy this file to .env and update with your actual values

# ============================================
# API Configuration (REQUIRED for Production)
# ============================================
# Production: Use your production API URL (e.g., https://api.taatom.com)
# Development: Use local IP (e.g., http://192.168.1.15:3000)
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_WEB_SHARE_URL=http://localhost:3000

# ============================================
# Google Services Configuration
# ============================================
# Google Maps API Key (REQUIRED for maps functionality)
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here

# Google OAuth Client IDs
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your-google-client-id-ios
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your-google-client-id-android
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=your-google-redirect-uri

# ============================================
# Logo & Assets
# ============================================
EXPO_PUBLIC_LOGO_IMAGE=https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png

# ============================================
# Environment
# ============================================
# Set to 'production' for production builds
# Set to 'staging' for staging builds
# Leave empty or 'development' for development
EXPO_PUBLIC_ENV=development

# ============================================
# Sentry Error Tracking (Optional)
# ============================================
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn-here
EXPO_PUBLIC_SENTRY_ENVIRONMENT=development
EXPO_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE=0.1
EXPO_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1.0

# ============================================
# Security Notes
# ============================================
# - NEVER commit .env file to git
# - NEVER expose GOOGLE_CLIENT_SECRET in frontend
# - Production builds will fail if EXPO_PUBLIC_API_BASE_URL is not set
# - Production builds will reject localhost/local IP addresses
```

## 📁 Backend (.env.example)

Create `backend/.env.example`:

```env
# Taatom Backend - Environment Variables
# Copy this file to .env and update with your actual values

# ============================================
# Server Configuration
# ============================================
PORT=3000
NODE_ENV=development

# ============================================
# Database Configuration (REQUIRED)
# ============================================
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/taatom?retryWrites=true&w=majority
# Optional: Explicit database name (if not specified in MONGO_URL)
# If not set, database name will be extracted from MONGO_URL or default to 'TaatomProd'
MONGO_DB_NAME=TaatomProd

# ============================================
# JWT & Security (REQUIRED)
# ============================================
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random_minimum_32_characters
JWT_REFRESH_SECRET=your_refresh_token_secret_here_also_long_and_random
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# ============================================
# CORS & Frontend URLs (REQUIRED for Production)
# ============================================
# Production: Use your production URLs
# Development: Can use localhost
FRONTEND_URL=http://localhost:8081
SUPERADMIN_URL=http://localhost:5001

# ============================================
# API URLs (Optional - for Swagger docs)
# ============================================
API_BASE_URL=http://localhost:3000
API_PUBLIC_URL=https://api.taatom.com
API_BASE_URL_PROD=https://api.taatom.com

# ============================================
# Cloudinary Configuration (REQUIRED for image uploads)
# ============================================
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ============================================
# Email Service (REQUIRED for OTP)
# ============================================
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@taatom.com

# ============================================
# Storage Configuration (Sevalla/R2)
# ============================================
SEVALLA_STORAGE_ENDPOINT=your-storage-endpoint
SEVALLA_STORAGE_REGION=auto
SEVALLA_STORAGE_ACCESS_KEY=your-access-key
SEVALLA_STORAGE_SECRET_KEY=your-secret-key
SEVALLA_STORAGE_BUCKET=your-bucket-name
SEVALLA_STORAGE_PUBLIC_URL=https://your-public-url.com

# ============================================
# Firebase Configuration (Optional - for FCM)
# ============================================
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# ============================================
# Redis Configuration (Optional - for caching)
# ============================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ============================================
# Sentry Error Tracking (Optional)
# ============================================
SENTRY_DSN=your-sentry-dsn-here
SENTRY_ENVIRONMENT=development

# ============================================
# Feature Flags & Monitoring
# ============================================
ENABLE_QUERY_MONITORING=true
MAX_JSON_BODY_SIZE=1mb
MAX_URLENCODED_BODY_SIZE=1mb

# ============================================
# Security Notes
# ============================================
# - NEVER commit .env file to git
# - Use strong, random values for JWT_SECRET
# - Keep all secrets secure
# - Production: Use HTTPS URLs only
# - Production: Restrict CORS to specific domains
```

## 📁 SuperAdmin (.env.example)

Create `superAdmin/.env.example`:

```env
# Taatom SuperAdmin - Environment Variables
# Copy this file to .env and update with your actual values

# ============================================
# API Configuration (REQUIRED for Production)
# ============================================
# Production: Use your production API URL (e.g., https://api.taatom.com)
# Development: Leave empty to use Vite proxy, or use http://localhost:3000
VITE_API_URL=http://localhost:3000

# ============================================
# App Configuration
# ============================================
VITE_APP_NAME=TeamTaatom SuperAdmin
VITE_APP_VERSION=1.0.0

# ============================================
# Sentry Error Tracking (Optional)
# ============================================
VITE_SENTRY_DSN=your-sentry-dsn-here
VITE_SENTRY_ENVIRONMENT=development
VITE_SENTRY_SEND_DEFAULT_PII=false

# ============================================
# Security Notes
# ============================================
# - NEVER commit .env file to git
# - Production builds will fail if VITE_API_URL is not set
# - Use HTTPS URLs for production
# - Development: Empty VITE_API_URL uses Vite proxy (recommended)
```

## 🚀 Quick Setup

### Frontend
```bash
cd frontend
cp .env.example .env
# Edit .env with your values
```

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your values
```

### SuperAdmin
```bash
cd superAdmin
cp .env.example .env
# Edit .env with your values
```

## ✅ Production Checklist

Before production deployment:

- [ ] All `.env` files created from `.env.example`
- [ ] All hardcoded values replaced with environment variables
- [ ] Production URLs use HTTPS (not HTTP)
- [ ] No localhost or local IP addresses in production configs
- [ ] All secrets are strong and unique
- [ ] `.env` files are in `.gitignore`
- [ ] `.env.example` files are committed (without secrets)

---

**Note:** This guide provides templates. Create actual `.env.example` files in each project directory.

