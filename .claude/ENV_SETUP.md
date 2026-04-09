# Environment Setup & Configuration

## Prerequisites
- Node.js 16+
- MongoDB Atlas account (or local MongoDB)
- Cloudinary account (for image/video uploads)
- Gmail with App Password (for email notifications)
- Expo CLI: `npm install -g @expo/cli`

---

## Backend (.env)

Located: `backend/.env`

### Required Variables
```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=7d
REFRESH_TOKEN_SECRET=refresh-secret

# Email (Gmail)
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-app-password

# Cloudinary (Image/Video)
CLOUDINARY_NAME=your-cloudinary-name
CLOUDINARY_KEY=your-api-key
CLOUDINARY_SECRET=your-api-secret

# Firebase (if needed)
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=

# Twilio (SMS - optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Redis (for background jobs - currently optional)
REDIS_URL=redis://localhost:6379

# Admin Panel
SUPER_ADMIN_EMAIL=admin@example.com
```

### Setup Steps

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env

# 3. Edit .env with your credentials
# Use a text editor to add your API keys

# 4. Run migrations (if database schema needs setup)
npm run migrate:up

# 5. Start dev server
npm run dev
```

The backend will run on `http://localhost:3000`

---

## Frontend (.env)

Located: `frontend/.env`

### Required Variables
```env
# API Configuration
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
EXPO_PUBLIC_API_TIMEOUT=30000

# Google OAuth (mobile)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-mobile-client-id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your-android-client-id

# Cloudinary
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloudinary-name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-preset

# App Settings
EXPO_PUBLIC_APP_NAME=Taatom
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_ENVIRONMENT=development

# Feature Flags (optional)
EXPO_PUBLIC_FEATURE_TRAVEL_HISTORY=true
EXPO_PUBLIC_FEATURE_PAGE_BUILDER=false
```

### Setup Steps

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env

# 3. Edit .env with your credentials

# 4. Sync .env to app.json (important for Expo)
npm run update-config

# 5. Start Expo
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Press `w` for web
- Scan QR code with Expo Go app on physical device

---

## SuperAdmin (.env)

Located: `SuperAdmin/.env`

### Required Variables
```env
# API Configuration
VITE_API_URL=http://localhost:3000/api/v1
VITE_API_TIMEOUT=30000

# Admin Settings
VITE_APP_NAME=Taatom Admin
VITE_ENVIRONMENT=development

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_REAL_TIME=true
```

### Setup Steps

```bash
cd SuperAdmin

# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env

# 3. Edit .env with your API URL

# 4. Start admin dashboard
npm run dev
```

Admin dashboard runs on `http://localhost:5173`

---

## Database Setup

### MongoDB

```bash
# Check if MongoDB is running
cd backend

# Run migrations
npm run migrate:up

# View migration status
npm run migrate:status

# Rollback a migration (if needed)
npm run migrate:down
```

**Important migration files**: `backend/migrations/001_initial_schema.js`

---

## Email Configuration

### Gmail App Password Setup

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Security → App passwords
3. Select "Mail" and "Windows Computer"
4. Google will generate a password (16 characters)
5. Copy that password to `backend/.env` as `GMAIL_PASSWORD`

**Note**: You must have 2FA enabled on your Google account

---

## Cloudinary Setup

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Go to Dashboard → Settings
3. Copy:
   - `CLOUDINARY_NAME` (Cloud Name)
   - `CLOUDINARY_KEY` (API Key)
   - `CLOUDINARY_SECRET` (API Secret)
4. Add to `backend/.env`

**For uploads**: Create upload presets in Cloudinary dashboard
- Preset name goes in frontend `.env` as `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

---

## Google OAuth Setup

### For Web/Admin
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google+ API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:5173` (SuperAdmin)
   - `http://localhost:3000/api/v1/auth/google/callback` (Backend)

### For Mobile (Expo)
1. In Google Cloud Console, create credentials (iOS and Android)
2. For Android: Get SHA-1 fingerprint from keystore
3. Add credentials to `frontend/.env`

---

## Development Workflow

### Running All Services Locally

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm start

# Terminal 3: SuperAdmin (optional)
cd SuperAdmin
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Backend with coverage
npm test -- --coverage
```

### Linting & Formatting

```bash
# Backend
cd backend
npm run lint
npm run lint:fix

# Frontend
cd frontend
npm run lint
npm run lint:fix

# SuperAdmin
cd SuperAdmin
npm run lint
npm run lint:fix
```

---

## Common Issues & Fixes

### "Cannot find module" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run update-config  # Frontend only
```

### Expo app won't load
```bash
# Clear Expo cache
cd frontend
npm start -- -c

# Check that backend is running on correct port
```

### MongoDB connection error
```bash
# Verify connection string in .env
# Check credentials are correct
# Make sure MongoDB Atlas network access includes your IP
```

### Email not sending
```bash
# Check Gmail app password is correct (not regular password)
# Verify 2FA is enabled on Google account
# Check GMAIL_USER is correct
```

---

## Security Checklist

✅ **Before committing**:
- [ ] Remove `.env` files (they should be in `.gitignore`)
- [ ] Never commit API keys or secrets
- [ ] Check for hardcoded credentials

✅ **Before deploying**:
- [ ] Use production database (MongoDB Atlas)
- [ ] Use production Cloudinary account
- [ ] Generate strong JWT secrets
- [ ] Enable HTTPS/TLS
- [ ] Set proper CORS origins

---

## CI/CD Pipeline

The project has GitHub Actions workflows (check `.github/workflows/`)

**Key workflows**:
- Tests on PR
- Linting on PR
- Deploy on merge to main

---

**Setup Status**: Follow these steps in order
1. Install Node.js and npm
2. Set up MongoDB Atlas
3. Set up Cloudinary
4. Set up Google OAuth
5. Configure each .env file
6. Run migrations
7. Start services

**Need help?** Check the specific service docs or ask the team.

**Last updated**: 2026-04-09
