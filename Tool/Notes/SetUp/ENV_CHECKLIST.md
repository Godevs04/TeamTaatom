# Environment Variables Checklist

This document helps you verify that all required environment variables are set in your `.env` files.

## Frontend `.env` File (`frontend/.env`)

### Required Variables:

- [ ] `EXPO_PUBLIC_API_BASE_URL` - Backend API URL (e.g., `http://192.168.1.9:3000`)
- [ ] `EXPO_PUBLIC_WEB_SHARE_URL` - Web share URL (usually same as API_BASE_URL or production domain)
- [ ] `EXPO_PUBLIC_LOGO_IMAGE` - Logo image URL
- [ ] `EXPO_PUBLIC_GOOGLE_CLIENT_ID` - Google OAuth client ID
- [ ] `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS` - iOS-specific Google OAuth client ID (optional, falls back to GOOGLE_CLIENT_ID)
- [ ] `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID` - Android-specific Google OAuth client ID (optional, falls back to GOOGLE_CLIENT_ID)
- [ ] `EXPO_PUBLIC_GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- [ ] `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` - Google OAuth redirect URI
- [ ] `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key

### Notes:
- All frontend variables must start with `EXPO_PUBLIC_` to be accessible in the app
- These values are embedded at build time
- Update `app.json` by running `npm run update-config` after changing `.env`

## Backend `.env` File (`backend/.env`)

### Required Variables:

#### Server & Database:
- [ ] `PORT` - Server port (default: 3000)
- [ ] `NODE_ENV` - Environment (development/production)
- [ ] `MONGO_URL` - MongoDB connection string
- [ ] `JWT_SECRET` - Secret key for JWT tokens (use a long, random string)

#### Cloudinary (Image/Video Storage):
- [ ] `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- [ ] `CLOUDINARY_API_KEY` - Cloudinary API key
- [ ] `CLOUDINARY_API_SECRET` - Cloudinary API secret

#### Email (SMTP):
- [ ] `SMTP_HOST` - SMTP server host (default: smtp.gmail.com)
- [ ] `SMTP_PORT` - SMTP port (default: 587)
- [ ] `SMTP_USER` - SMTP username/email
- [ ] `SMTP_PASS` - SMTP password/app password
- [ ] `SMTP_FROM` - From email address (optional, defaults to SMTP_USER)

#### URLs & CORS:
- [ ] `FRONTEND_URL` - Frontend URL for CORS (e.g., `http://192.168.1.9:8081`)
- [ ] `API_BASE_URL` - Backend API URL (e.g., `http://192.168.1.9:3000`)
- [ ] `SUPERADMIN_URL` - Super admin panel URL (optional)

#### Redis (Background Jobs):
- [ ] `REDIS_HOST` - Redis host (default: localhost)
- [ ] `REDIS_PORT` - Redis port (default: 6379)
- [ ] `REDIS_PASSWORD` - Redis password (optional, leave empty if no password)
- [ ] `ENABLE_BACKGROUND_JOBS` - Enable background jobs (true/false)

#### Google OAuth:
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth client ID
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- [ ] `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI

#### WebSocket:
- [ ] `WS_ALLOWED_ORIGIN` - WebSocket allowed origin (default: http://localhost:19006)
- [ ] `WS_PATH` - WebSocket path (default: /socket.io)

#### Branding:
- [ ] `LOGO_IMAGE` - Logo image URL (for sharing and branding)

## Quick Setup Commands

### Frontend:
```bash
cd frontend
cp .env.example .env
# Edit .env with your values
npm run update-config  # Updates app.json from .env
```

### Backend:
```bash
cd backend
cp .env.example .env
# Edit .env with your values
```

## Important Notes

1. **Never commit `.env` files** - They contain sensitive information
2. **Keep `.env.example` files updated** - These are safe to commit
3. **Match URLs** - Frontend `EXPO_PUBLIC_API_BASE_URL` should match backend `API_BASE_URL`
4. **Google OAuth** - Frontend and backend should use matching Google OAuth credentials
5. **Redis** - Required for background jobs (email, image processing, analytics)
6. **SMTP Password** - For Gmail, use an App Password, not your regular password

## Verification

After setting up your `.env` files:

1. **Frontend**: Run `npm run update-config` to sync with `app.json`
2. **Backend**: Restart the server to load new environment variables
3. **Test**: Verify API calls work and OAuth login functions correctly

