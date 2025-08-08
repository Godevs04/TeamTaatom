# Taatom - React Native Photo Sharing App

A modern photo sharing mobile app built with React Native (Expo), TypeScript, and Firebase. Share your world through photos with location tagging and real-time social features.

## 🚀 Features

### Authentication
- **Sign Up**: Create account with email, password, and full name
- **Sign In**: Secure authentication with Firebase Auth
- **Forgot Password**: Email-based password reset
- **Form Validation**: Real-time validation using Formik + Yup

### Photo Sharing
- **Upload Photos**: Choose from library or take new photos
- **Location Tagging**: Automatic location detection and reverse geocoding
- **Comments**: Real-time commenting system
- **Likes**: Like/unlike posts with real-time updates

### Social Features
- **Real-time Feed**: Live updates using Firebase Firestore
- **User Profiles**: View user stats and recent posts
- **World Map**: 3D globe visualization of shared locations
- **Followers/Following**: Social networking features

### UI/UX
- **Dark Mode**: Beautiful iOS-style dark theme
- **Responsive Design**: Works on both iOS and Android
- **Modern UI**: Neumorphic design with smooth animations
- **Bottom Navigation**: Intuitive tab-based navigation

## 🛠️ Tech Stack

- **React Native** with **Expo**
- **TypeScript** for type safety
- **Firebase** (Auth, Firestore, Storage)
- **React Navigation** with bottom tabs
- **Formik + Yup** for form handling
- **Expo Image Picker** for photo selection
- **Expo Location** for geolocation
- **React Native Vector Icons**

## 📱 Screenshots

The app features a beautiful dark mode interface with:
- Authentication screens with gradient backgrounds
- Photo feed with card-based design
- Post creation with image picker and location
- Profile screen with stats and world map
- Real-time comments and likes

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Taatom
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Firebase Setup**
   - Create a new Firebase project
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Enable Storage
   - Update the Firebase config in `services/firebase.ts`

4. **Run the app**
   ```bash
   npm start
   ```

5. **Open in simulator/emulator**
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator
   - Or scan QR code with Expo Go app

## 📁 Project Structure

```
Taatom/
├── app/
│   ├── (auth)/
│   │   ├── signin.tsx
│   │   ├── signup.tsx
│   │   └── forgot.tsx
│   ├── (tabs)/
│   │   ├── home.tsx
│   │   ├── post.tsx
│   │   └── profile.tsx
│   ├── _layout.tsx
│   └── index.tsx
├── components/
│   ├── AuthInput.tsx
│   ├── PhotoCard.tsx
│   ├── CommentBox.tsx
│   └── NavBar.tsx
├── services/
│   ├── firebase.ts
│   ├── auth.ts
│   ├── firestore.ts
│   └── storage.ts
├── types/
│   ├── user.ts
│   └── post.ts
├── constants/
│   ├── colors.ts
│   └── theme.ts
└── utils/
    ├── validation.ts
    └── geo.ts
```

## 🔥 Firebase Configuration

The app uses the following Firebase services:

### Authentication
- Email/Password authentication
- Password reset functionality
- User session management

### Firestore Database
- **Users Collection**: User profiles and social data
- **Posts Collection**: Photo posts with metadata
- **Comments Subcollection**: Real-time comments

### Storage
- Profile images
- Post photos
- Automatic image optimization

## 🎨 Design System

The app follows a consistent design system with:
- **Dark Theme**: Primary colors and gradients
- **Typography**: Hierarchical text styles
- **Spacing**: Consistent spacing scale
- **Shadows**: Neumorphic design elements
- **Icons**: Ionicons for consistency

## 📊 Features in Detail

### Authentication Flow
1. User signs up with email/password
2. Firebase creates user account
3. User data stored in Firestore
4. Automatic navigation to main app

### Photo Sharing Flow
1. User selects/takes photo
2. Location automatically detected
3. User adds comment and optional place name
4. Photo uploaded to Firebase Storage
5. Post data saved to Firestore
6. Real-time updates in feed

### Real-time Features
- Live post updates using Firestore listeners
- Real-time comments and likes
- Instant UI updates without refresh

## 🚀 Deployment

### Expo Build
```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android
```

### App Store Deployment
1. Configure app.json with proper bundle identifiers
2. Build production version
3. Submit to App Store/Play Store

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Firebase for backend services
- Expo for the development platform
- React Native community for libraries and support

---

**Taatom** - Share your world, one photo at a time! 📸🌍
