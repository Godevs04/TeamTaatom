# Taatom - Photo Sharing App

A complete React Native + Express.js photo sharing application with location features.

## 🏗️ Project Structure

```
Taatom/
├── frontend/          # React Native (Expo) app
├── backend/           # Express.js API server
└── README.md         # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MongoDB Atlas account
- Cloudinary account  
- Gmail with App Password
- Expo CLI (`npm install -g @expo/cli`)

### 1. Backend Setup

```bash
cd backend
npm install
cp env.example .env
# Edit .env with your MongoDB, Cloudinary, and email credentials
npm run dev
```

The backend will start on `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm start
# Press 'i' for iOS or 'a' for Android
```

## 📱 Features

### Authentication
- ✅ Email/Password signup with OTP verification
- ✅ Secure JWT-based authentication
- ✅ Password reset via email
- ✅ Persistent login sessions

### Photo Sharing
- ✅ Upload photos from camera or gallery
- ✅ Add captions and location data
- ✅ Automatic location detection
- ✅ Cloudinary image optimization

### Social Features
- ✅ Real-time feed with pagination
- ✅ Like and comment on posts
- ✅ Follow/unfollow users
- ✅ User profiles with stats

### UI/UX
- ✅ iOS-style dark mode theme
- ✅ Neumorphic design elements
- ✅ Smooth animations and transitions
- ✅ Pull-to-refresh and infinite scroll

## 🔧 Technical Stack

### Frontend
- **React Native (Expo)** - Mobile app framework
- **TypeScript** - Type safety
- **Expo Router** - File-based navigation
- **Formik + Yup** - Form handling and validation
- **Axios** - HTTP client
- **AsyncStorage** - Local storage

### Backend
- **Express.js** - Web framework
- **MongoDB + Mongoose** - Database
- **JWT** - Authentication
- **Cloudinary** - Image storage
- **Nodemailer** - Email service
- **bcryptjs** - Password hashing

## 📊 API Endpoints

### Authentication
```
POST /auth/signup       - Register user
POST /auth/verify-otp   - Verify email OTP
POST /auth/signin       - Login user
GET  /auth/me          - Get current user
```

### Posts
```
GET    /posts          - Get all posts
POST   /posts          - Create new post
POST   /posts/:id/like - Like/unlike post
POST   /posts/:id/comments - Add comment
```

### Profile
```
GET  /profile/:id      - Get user profile
PUT  /profile/:id      - Update profile
POST /profile/:id/follow - Follow/unfollow user
```

## 🗄️ Database Schema

### Users
```javascript
{
  fullName: String,
  email: String (unique),
  password: String (hashed),
  profilePic: String,
  followers: [ObjectId],
  following: [ObjectId],
  totalLikes: Number,
  isVerified: Boolean
}
```

### Posts
```javascript
{
  user: ObjectId,
  caption: String,
  imageUrl: String,
  location: {
    address: String,
    coordinates: { latitude: Number, longitude: Number }
  },
  likes: [ObjectId],
  comments: [{ user: ObjectId, text: String, createdAt: Date }]
}
```

## 🔑 Environment Variables

### Backend (.env)
```env
PORT=5000
MONGO_URL=mongodb+srv://...
JWT_SECRET=your_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### Frontend (.env)
```env
API_BASE_URL=http://localhost:5000
```

## 🧪 Testing

### Backend
```bash
cd backend
npm test
# Or test with curl/Postman
curl http://localhost:5000/health
```

### Frontend
```bash
cd frontend
# Test on iOS simulator
npm run ios
# Test on Android emulator  
npm run android
```

## 🚀 Deployment

### Backend (Railway/Heroku)
```bash
# Set environment variables in dashboard
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

## 🐛 Troubleshooting

### Common Issues

1. **Backend not starting**
   - Check MongoDB connection string
   - Verify all environment variables
   - Ensure port 5000 is available

2. **Frontend API errors**
   - Verify backend is running on port 5000
   - Check API_BASE_URL in frontend .env
   - Test API endpoints with curl

3. **Image upload failing**
   - Verify Cloudinary credentials
   - Check image size limits (10MB max)
   - Ensure proper file permissions

4. **OTP emails not sending**
   - Use Gmail App Password (not regular password)
   - Enable 2FA on Gmail account
   - Check email credentials in backend .env

### Debug Commands
```bash
# Clear Metro cache
npx expo start -c

# Reset iOS simulator
npx expo run:ios --device

# Check backend logs
cd backend && npm run dev

# Check network requests
# Use React Native Debugger or Flipper
```

## 📚 Documentation

- [Frontend README](./frontend/README.md) - Detailed frontend documentation
- [Backend README](./backend/README.md) - API documentation and deployment guide
- [Expo Documentation](https://docs.expo.dev/) - React Native Expo framework
- [Express.js Guide](https://expressjs.com/) - Backend framework documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 📞 Support

For issues and questions:
- Open a GitHub issue
- Email: support@taatom.com

---

Built with ❤️ using React Native, Express.js, and MongoDB.
