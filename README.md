# Taatom - Travel & Location-Based Social Platform
 
A comprehensive React Native + Express.js social media platform focused on travel, location sharing, and community building. Built with modern best practices, security-first architecture, and scalable infrastructure.
 
## 🏗️ Project Structure

```
TeamTaatom/
├── frontend/          # React Native (Expo) app
│   ├── app/          # Expo Router pages
│   ├── components/   # Reusable components
│   ├── services/     # API services
│   ├── utils/        # Utilities & config
│   └── .env         # Environment variables
├── backend/           # Express.js API server
│   ├── src/
│   │   ├── controllers/  # Route handlers
│   │   ├── models/       # Mongoose schemas
│   │   ├── routes/       # API routes (v1)
│   │   ├── middleware/   # Auth, validation, security
│   │   ├── jobs/         # Background job processors
│   │   └── utils/        # Utilities
│   ├── migrations/   # Database migrations
│   └── .env         # Environment variables
├── superAdmin/       # Admin dashboard (React)
└── Tool/Notes/      # Documentation & guides
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MongoDB Atlas account
- Cloudinary account  
- Gmail with App Password
- Redis (optional - for background jobs, currently disabled)
- Expo CLI (`npm install -g @expo/cli`)

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)
npm run dev
```

The backend will start on `http://localhost:3000` (or PORT from .env)

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your API URLs and credentials
npm run update-config  # Syncs .env to app.json
npm start
# Press 'i' for iOS, 'a' for Android, or 'w' for web
```

### 3. Database Migrations (Optional)

```bash
cd backend
npm run migrate:up  # Run database migrations
```

## 📱 Features

### Authentication & Security
- ✅ Email/Password signup with OTP verification
- ✅ Google OAuth integration
- ✅ Secure JWT-based authentication with httpOnly cookies (web)
- ✅ Password reset via email
- ✅ CSRF protection
- ✅ XSS input sanitization
- ✅ Rate limiting (granular per endpoint)
- ✅ Password strength enforcement
- ✅ Security headers (Helmet.js)

### Content Sharing
- ✅ Photo/Video upload with Cloudinary optimization
- ✅ Short-form video posts (Shorts)
- ✅ Add captions, hashtags, and location data
- ✅ Automatic location detection
- ✅ Image optimization and caching
- ✅ Share to external platforms (Instagram, Facebook, Twitter)
- ✅ Custom share cards with deep linking

### Social Features
- ✅ Real-time feed with pagination
- ✅ Like, comment, and bookmark posts
- ✅ Follow/unfollow users with private account support
- ✅ User profiles with stats and posts
- ✅ Real-time notifications
- ✅ Chat with typing indicators and read receipts
- ✅ Block/unblock users
- ✅ Mute notifications per chat

### Hashtag System
- ✅ Automatic hashtag extraction from captions
- ✅ Hashtag search and trending hashtags
- ✅ Hashtag detail pages with related posts
- ✅ Auto-suggest hashtags while typing
- ✅ Clickable hashtags in posts

### Location Features
- ✅ Location tagging on posts
- ✅ TripScore tracking (continents, countries, locations)
- ✅ Interactive world map visualization
- ✅ Location-based post discovery
- ✅ Travel statistics and milestones

### UI/UX Enhancements
- ✅ iOS-style dark/light mode theme
- ✅ Responsive web design
- ✅ Onboarding flow (welcome, interests, suggested users)
- ✅ Empty states with actionable CTAs
- ✅ Loading skeletons for better perceived performance
- ✅ Optimistic updates for instant feedback
- ✅ Error messages with retry mechanisms
- ✅ Pull-to-refresh and infinite scroll

### Analytics & Tracking
- ✅ Post views tracking
- ✅ Engagement rate analytics
- ✅ User retention metrics
- ✅ Feature usage tracking
- ✅ Drop-off point analysis
- ✅ Crash reporting service

### Backend Infrastructure
- ✅ API versioning (`/api/v1`)
- ✅ Request validation with express-validator
- ✅ Database migrations (migrate-mongo)
- ✅ Background jobs (currently disabled - Redis not configured)
  - Email sending
  - Image processing
  - Analytics aggregation
  - Cleanup tasks
- ✅ Comprehensive logging system
- ✅ Error handling middleware
- ✅ Database indexing for performance

## 🔧 Technical Stack

### Frontend
- **React Native (Expo)** - Cross-platform mobile framework
- **TypeScript** - Type safety
- **Expo Router** - File-based navigation
- **Formik + Yup** - Form handling and validation
- **Axios** - HTTP client with interceptors
- **Socket.IO Client** - Real-time communication
- **AsyncStorage** - Local storage (mobile)
- **httpOnly Cookies** - Secure token storage (web)
- **React Native Web** - Web compatibility

### Backend
- **Express.js** - Web framework
- **MongoDB + Mongoose** - Database with migrations
- **JWT** - Authentication tokens
- **Cloudinary** - Image/video storage & optimization
- **Nodemailer** - Email service
- **bcryptjs** - Password hashing
- **Socket.IO** - Real-time WebSocket server
- **Background Jobs** - Queue system (currently disabled - Redis not configured)
- **Helmet.js** - Security headers
- **express-rate-limit** - Rate limiting
- **xss** - Input sanitization
- **express-validator** - Request validation

## 📊 API Endpoints

All endpoints are versioned under `/api/v1`:

### Authentication (`/api/v1/auth`)
```
POST   /auth/signup          - Register user
POST   /auth/verify-otp      - Verify email OTP
POST   /auth/signin          - Login user
POST   /auth/google          - Google OAuth login
GET    /auth/me              - Get current user
POST   /auth/refresh         - Refresh JWT token
POST   /auth/logout          - Logout user
POST   /auth/forgot-password - Request password reset
POST   /auth/reset-password  - Reset password
```

### Posts (`/api/v1/posts`)
```
GET    /posts                - Get all posts (paginated)
POST   /posts                - Create new post
GET    /posts/:id            - Get post by ID
PUT    /posts/:id            - Update post
DELETE /posts/:id            - Delete post
POST   /posts/:id/like       - Like/unlike post
POST   /posts/:id/comments   - Add comment
DELETE /posts/:id/comments/:commentId - Delete comment
POST   /posts/:id/save       - Save/unsave post
```

### Shorts (`/api/v1/shorts`)
```
GET    /shorts               - Get all shorts
POST   /shorts                - Create short video
GET    /shorts/:id           - Get short by ID
```

### Hashtags (`/api/v1/hashtags`)
```
GET    /hashtags/search      - Search hashtags
GET    /hashtags/trending    - Get trending hashtags
GET    /hashtags/:hashtag    - Get hashtag details
GET    /hashtags/:hashtag/posts - Get posts by hashtag
```

### Profile (`/api/v1/profile`)
```
GET    /profile/:id           - Get user profile
PUT    /profile/:id          - Update profile
POST   /profile/:id/follow   - Follow/unfollow user
GET    /profile/:id/posts    - Get user posts
GET    /profile/:id/followers - Get followers
GET    /profile/:id/following - Get following
```

### Chat (`/api/v1/chat`)
```
GET    /chats                - Get user chats
GET    /chats/:chatId        - Get chat details
POST   /chats                - Create chat
POST   /chats/:chatId/messages - Send message
PUT    /chats/:chatId/mute   - Mute/unmute chat
POST   /chats/:chatId/block  - Block/unblock user
DELETE /chats/:chatId        - Clear chat
```

### Analytics (`/api/v1/analytics`)
```
POST   /analytics/events     - Track analytics event
POST   /analytics/errors     - Log error/crash
```

## 🔑 Environment Variables

### Frontend (`frontend/.env`)

All frontend variables must start with `EXPO_PUBLIC_`:

```env
# API Configuration
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.9:3000
EXPO_PUBLIC_WEB_SHARE_URL=http://192.168.1.9:3000

# Logo Image URL
EXPO_PUBLIC_LOGO_IMAGE=https://res.cloudinary.com/.../logo.png

# Google OAuth
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=your_ios_client_id
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=your_android_client_id
EXPO_PUBLIC_GOOGLE_CLIENT_SECRET=your_client_secret
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=your_redirect_uri

# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key
```

**Note**: After updating `.env`, run `npm run update-config` to sync with `app.json`.

### Backend (`backend/.env`)

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/Taatom?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Logo
LOGO_IMAGE=https://res.cloudinary.com/.../logo.png

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com

# URLs & CORS
FRONTEND_URL=http://192.168.1.9:8081
API_BASE_URL=http://192.168.1.9:3000
SUPERADMIN_URL=http://localhost:5001

# Background Jobs (currently disabled - Redis not configured)
# To enable background jobs in the future, configure Redis and set:
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=
ENABLE_BACKGROUND_JOBS=false

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri

# WebSocket
WS_ALLOWED_ORIGIN=http://localhost:19006
WS_PATH=/socket.io
```

## 🗄️ Database Schema

### Users
```javascript
{
  fullName: String,
  email: String (unique, indexed),
  username: String (unique, indexed),
  password: String (hashed),
  profilePic: String,
  bio: String,
  followers: [ObjectId],
  following: [ObjectId],
  blockedUsers: [ObjectId],
  totalLikes: Number,
  isVerified: Boolean,
  isPrivate: Boolean,
  googleId: String (indexed),
  location: {
    address: String,
    coordinates: { latitude: Number, longitude: Number }
  }
}
```

### Posts
```javascript
{
  user: ObjectId (indexed),
  caption: String,
  imageUrl: String,
  images: [String],
  location: {
    address: String,
    coordinates: { latitude: Number, longitude: Number }
  },
  tags: [String] (indexed),
  likes: [ObjectId] (indexed),
  comments: [{ user: ObjectId, text: String, createdAt: Date }],
  type: String (indexed), // 'photo', 'video', 'short'
  isActive: Boolean (indexed),
  isHidden: Boolean (indexed),
  createdAt: Date (indexed)
}
```

### Hashtags
```javascript
{
  name: String (unique, indexed),
  postCount: Number,
  posts: [ObjectId],
  lastUsed: Date
}
```

### Chats
```javascript
{
  participants: [ObjectId],
  messages: [{
    sender: ObjectId,
    text: String,
    timestamp: Date,
    read: Boolean
  }],
  lastMessage: Date,
  mutedBy: [ObjectId]
}
```

## 🧪 Testing

### Backend
```bash
cd backend
npm test
# Or test with curl/Postman
curl http://localhost:3000/api/v1/health
```

### Frontend
```bash
cd frontend
# Test on iOS simulator
npm run ios
# Test on Android emulator  
npm run android
# Test on web
npm run web
```

## 🚀 Deployment

### Backend (Railway/Heroku/Render)
```bash
# Set environment variables in dashboard
# Background jobs are currently disabled (Redis not configured)
# Deploy from GitHub repository
```

### Frontend (EAS Build)
```bash
cd frontend
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios
eas build --platform android
```

## 🔒 Security Features

- ✅ **CSRF Protection** - Token-based CSRF protection for web
- ✅ **XSS Prevention** - Input sanitization on all user inputs
- ✅ **Rate Limiting** - Granular rate limits per endpoint
- ✅ **Password Security** - Strength requirements + bcrypt hashing
- ✅ **JWT Security** - httpOnly cookies for web, secure storage for mobile
- ✅ **Security Headers** - Helmet.js configuration
- ✅ **Input Validation** - express-validator on all endpoints
- ✅ **CORS Configuration** - Strict origin validation

## 📈 Recent Improvements (January 2025)

### ✅ Completed Features

1. **Hashtag System**
   - Automatic extraction from captions
   - Search and trending hashtags
   - Hashtag detail pages
   - Auto-suggest while typing

2. **Social Sharing**
   - Share to Instagram, Facebook, Twitter
   - Custom share cards
   - Deep linking support

3. **API Versioning**
   - All routes under `/api/v1`
   - Backward compatibility maintained

4. **Security Enhancements**
   - CSRF protection
   - XSS sanitization
   - Enhanced rate limiting
   - Password strength enforcement
   - Security headers

5. **Backend Infrastructure**
   - Database migrations
   - Background jobs (BullMQ)
   - Background jobs (currently disabled)
   - Comprehensive logging

6. **Analytics & Tracking**
   - Post views tracking
   - Engagement analytics
   - User retention metrics
   - Crash reporting

7. **UX Improvements**
   - Onboarding flow
   - Empty states
   - Loading skeletons
   - Error handling

8. **Dynamic Configuration**
   - Environment-based config
   - Centralized config utility
   - Easy environment switching

## 🐛 Troubleshooting

### Common Issues

1. **Backend not starting**
   - Check MongoDB connection string
   - Verify all environment variables
   - Ensure port 3000 is available
   - Background jobs are currently disabled

2. **Frontend API errors**
   - Verify backend is running
   - Check `EXPO_PUBLIC_API_BASE_URL` in frontend `.env`
   - Run `npm run update-config` after changing `.env`
   - Test API endpoints with curl

3. **Image upload failing**
   - Verify Cloudinary credentials
   - Check image size limits (10MB max)
   - Ensure proper file permissions

4. **OTP emails not sending**
   - Use Gmail App Password (not regular password)
   - Enable 2FA on Gmail account
   - Check SMTP credentials in backend `.env`

5. **Background jobs not working**
   - Background jobs are currently disabled (Redis not configured)
   - To enable: Configure Redis and set `ENABLE_BACKGROUND_JOBS=true` in `.env`

6. **CSRF token errors (web)**
   - Clear browser cookies
   - Ensure backend CORS is configured correctly
   - Check that cookies are enabled

### Debug Commands
```bash
# Clear Metro cache
npx expo start -c

# Reset iOS simulator
npx expo run:ios --device

# Check backend logs
cd backend && npm run dev

# Background jobs are currently disabled (Redis not configured)
# To enable: Install Redis and configure REDIS_HOST, REDIS_PORT in .env

# Run database migrations
cd backend && npm run migrate:up

# Update frontend config
cd frontend && npm run update-config
```

## 📚 Documentation

- [Frontend README](./frontend/README.md) - Detailed frontend documentation
- [Frontend Environment Guide](./frontend/README_ENV.md) - Environment variables guide
- [Backend README](./backend/README.md) - API documentation
- [Business Documentation](./Tool/Notes/TeamTaatom_Business_Documentation.md) - Business context
- [Development Guide](./Tool/Notes/TeamTaatom_Development_Guide.md) - Technical guide
- [Codebase Analysis](./Tool/Notes/CODEBASE_ANALYSIS_AND_RECOMMENDATIONS.md) - Analysis & recommendations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (frontend + backend)
5. Update documentation if needed
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 📞 Support

For issues and questions:
- Open a GitHub issue
- Check documentation in `Tool/Notes/`
- Review troubleshooting section above

---

**Built with ❤️ using React Native, Express.js, MongoDB, and modern best practices.**

**Last Updated**: April 2026
**Version**: 1.4.0
