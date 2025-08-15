# Taatom Frontend

React Native (Expo) mobile app for photo sharing with location features.

## 🚀 Features

- **Authentication**: OTP-based email verification
- **Photo Sharing**: Upload photos with captions and location
- **Real-time Feed**: Browse posts from all users
- **Social Features**: Like, comment, follow/unfollow
- **Profile Management**: User profiles with location mapping
- **Dark Mode**: Beautiful iOS-style dark theme
- **TypeScript**: Full type safety

## 📋 Prerequisites

- Node.js 16+
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator or Android Emulator
- Backend API running on `localhost:5000`

## 🛠️ Installation

1. **Navigate to frontend:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment setup:**
   ```bash
   cp env.example .env
   # Edit .env if needed (default: http://localhost:5000)
   ```

4. **Start the development server:**
   ```bash
   npm start
   # or
   npx expo start
   ```

5. **Run on device/simulator:**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

## 📱 App Structure

```
app/
├── (auth)/
│   ├── signin.tsx         # Login screen
│   ├── signup.tsx         # Registration screen
│   ├── verifyOtp.tsx      # OTP verification
│   └── forgot.tsx         # Password reset
├── (tabs)/
│   ├── home.tsx          # Main feed
│   ├── post.tsx          # Create post
│   └── profile.tsx       # User profile
├── _layout.tsx           # Root navigation
└── index.tsx             # Entry point

components/
├── AuthInput.tsx         # Input field for auth forms
├── PhotoCard.tsx         # Post card component
├── CommentBox.tsx        # Comments section
├── NavBar.tsx           # Navigation header
└── Card.tsx             # Reusable card component

services/
├── api.ts               # Axios instance with interceptors
├── auth.ts              # Authentication API calls
├── posts.ts             # Posts API calls
└── profile.ts           # Profile API calls

types/
├── user.ts              # User type definitions
└── post.ts              # Post type definitions
```

## 🔐 Authentication Flow

1. **Sign Up** → Enter name, email, password
2. **OTP Verification** → 6-digit code sent to email
3. **Account Activation** → Account becomes active
4. **Sign In** → Login with email/password
5. **Authenticated State** → Access to main app

## 📡 API Integration

All API calls are made through the centralized `services/api.ts` using Axios:

- **Base URL**: `http://localhost:5000`
- **Auth Token**: Automatically added to headers
- **Error Handling**: Centralized response interceptors
- **Token Storage**: AsyncStorage for persistence

### Auth Service (`services/auth.ts`)
```typescript
- signUp(data) → Register new user
- verifyOTP(email, otp) → Verify account
- signIn(email, password) → Login user
- getCurrentUser() → Get user profile
- signOut() → Logout and clear storage
```

### Posts Service (`services/posts.ts`)
```typescript
- getPosts(page, limit) → Fetch feed
- createPost(image, caption, location) → Upload post
- toggleLike(postId) → Like/unlike post
- addComment(postId, text) → Add comment
- deletePost(postId) → Remove post
```

### Profile Service (`services/profile.ts`)
```typescript
- getProfile(userId) → Get user profile
- updateProfile(userId, data) → Update profile
- toggleFollow(userId) → Follow/unfollow user
- searchUsers(query) → Search users
```

## 🎨 UI/UX Features

- **Dark Theme**: iOS-style dark mode with blue accents
- **Neumorphic Design**: Soft shadows and elevated cards
- **Responsive Layout**: Works on all screen sizes
- **Loading States**: Smooth loading indicators
- **Error Handling**: User-friendly error messages
- **Form Validation**: Real-time input validation
- **Navigation**: Bottom tabs + stack navigation

## 🖼️ Image Handling

- **Upload**: `expo-image-picker` for camera/gallery
- **Formats**: JPG, PNG, GIF, WebP
- **Size Limit**: 10MB max per post
- **Processing**: Automatic optimization via Cloudinary
- **Storage**: Secure cloud storage with CDN

## 📍 Location Features

- **Auto-detect**: `expo-location` for GPS coordinates
- **Reverse Geocoding**: Address from coordinates
- **Privacy**: Location sharing is optional
- **Map View**: 3D globe showing post locations
- **Search**: Location-based post discovery

## 🔧 Development

### Available Scripts

```bash
npm start          # Start Expo development server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run on web browser
```

### Code Structure

- **TypeScript**: Full type safety across the app
- **Formik + Yup**: Form handling and validation
- **Expo Router**: File-system based routing
- **AsyncStorage**: Local data persistence
- **Context API**: Theme and global state management

### Adding New Features

1. Create component in `components/`
2. Add type definitions in `types/`
3. Create API calls in `services/`
4. Add screen in appropriate folder
5. Update navigation in `_layout.tsx`

## 🐛 Troubleshooting

### Common Issues

1. **Metro bundler cache**
   ```bash
   npx expo start -c
   ```

2. **iOS simulator not working**
   ```bash
   npx expo run:ios
   ```

3. **Android build issues**
   ```bash
   npx expo run:android
   ```

4. **Network requests failing**
   - Check backend is running on `localhost:5000`
   - Verify API_BASE_URL in environment
   - Check device/simulator network connectivity

5. **Authentication errors**
   - Clear app data: Long press app → App Info → Storage → Clear
   - Check AsyncStorage in Flipper/React Native Debugger

### Debug Mode

Enable debug logging:
```typescript
// In services/api.ts
api.interceptors.request.use(config => {
  console.log('API Request:', config);
  return config;
});
```

## 📱 Device Testing

### iOS
- Requires macOS and Xcode
- Test on iOS Simulator or physical device
- Use Expo Go app for quick testing

### Android
- Works on Windows, macOS, Linux
- Test on Android Emulator or physical device
- Use Expo Go app or development build

### Physical Device Testing
1. Install Expo Go from App Store/Play Store
2. Scan QR code from `expo start`
3. Ensure device and computer on same network

## 🚀 Production Build

### Expo Application Services (EAS)

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Configure project:**
   ```bash
   eas build:configure
   ```

3. **Build for iOS:**
   ```bash
   eas build --platform ios
   ```

4. **Build for Android:**
   ```bash
   eas build --platform android
   ```

### Environment Variables

For production builds, update API_BASE_URL to your production backend:

```env
API_BASE_URL=https://your-backend-domain.com
```

## 📊 Performance

- **Bundle Size**: Optimized with Expo's tree-shaking
- **Image Loading**: Lazy loading and caching
- **API Calls**: Request deduplication and caching
- **Memory Usage**: Efficient state management
- **Battery Life**: Optimized location and camera usage

## 🆘 Support

- **Expo Documentation**: https://docs.expo.dev/
- **React Native Guide**: https://reactnative.dev/
- **TypeScript Handbook**: https://www.typescriptlang.org/

## 📄 License

MIT License - see LICENSE file for details.