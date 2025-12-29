# Google Authentication Sign-In and Sign-Up Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture & Flow](#architecture--flow)
3. [Regular Sign-Up vs Google Sign-Up](#regular-sign-up-vs-google-sign-up)
4. [Data Collection & Storage](#data-collection--storage)
5. [Technical Implementation](#technical-implementation)
6. [Security Considerations](#security-considerations)
7. [User Experience Flow](#user-experience-flow)
8. [Code Locations](#code-locations)
9. [Testing Scenarios](#testing-scenarios)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This document provides a comprehensive guide to how Google OAuth authentication is implemented in the Taatom application, covering both sign-in and sign-up flows, data storage, and the differences between regular email/password authentication and Google OAuth authentication.

### Key Concepts

- **Google OAuth 2.0**: Uses authorization code flow for secure authentication
- **JWT Tokens**: 30-day expiration tokens for session management
- **Account Linking**: Existing email accounts can be linked with Google accounts
- **Auto-Verification**: Google accounts are automatically verified (no OTP required)
- **Platform-Aware**: Different token storage for web (httpOnly cookies) vs mobile (AsyncStorage)

---

## Architecture & Flow

### High-Level Flow Diagram

```
┌─────────────┐
│   Frontend  │
│  (React     │
│   Native)   │
└──────┬──────┘
       │
       │ 1. User clicks "Continue with Google"
       │
       ▼
┌─────────────────────────────────────┐
│  Google OAuth Authorization Request │
│  - Client ID                        │
│  - Scopes: openid, profile, email   │
│  - Redirect URI                     │
│  - State (CSRF protection)         │
└──────┬──────────────────────────────┘
       │
       │ 2. Redirect to Google
       │
       ▼
┌─────────────┐
│   Google    │
│  Accounts   │
└──────┬──────┘
       │
       │ 3. User authenticates with Google
       │
       │ 4. Google returns authorization code
       │
       ▼
┌─────────────────────────────────────┐
│  Frontend receives authorization code│
│  - Verifies state parameter          │
│  - Sends code to backend             │
└──────┬──────────────────────────────┘
       │
       │ 5. POST /api/v1/auth/google
       │    { code, redirectUri }
       │
       ▼
┌─────────────────────────────────────┐
│         Backend Processing           │
│  1. Exchange code for tokens         │
│  2. Verify ID token                 │
│  3. Extract user info               │
│  4. Check/create user account       │
│  5. Generate JWT token              │
│  6. Set auth token (cookie/response)│
└──────┬──────────────────────────────┘
       │
       │ 6. Return { token, user }
       │
       ▼
┌─────────────────────────────────────┐
│  Frontend stores token & navigates  │
│  - AsyncStorage (mobile)             │
│  - SessionStorage (web fallback)     │
│  - Navigate to onboarding/home      │
└─────────────────────────────────────┘
```

---

## Regular Sign-Up vs Google Sign-Up

### Comparison Table

| Aspect | Regular Sign-Up | Google Sign-Up |
|--------|----------------|----------------|
| **User Input Required** | Full Name, Username, Email, Password, Confirm Password | None (all from Google) |
| **Email Verification** | Required (OTP sent to email) | Not required (Google pre-verified) |
| **Password** | User creates password (hashed with bcrypt) | Placeholder: `'google_oauth_placeholder'` |
| **Username** | User chooses (validated for uniqueness) | Not set initially (user must set later) |
| **Profile Picture** | Not set initially | Automatically set from Google profile picture |
| **Account Status** | `isVerified: false` until OTP verified | `isVerified: true` immediately |
| **Google ID** | Not set | Stored in `googleId` field |
| **Welcome Email** | Sent after OTP verification | Sent immediately after account creation |
| **Onboarding** | Navigate to OTP verification screen | Navigate directly to onboarding or home |

### Detailed Differences

#### 1. **Data Collection**

**Regular Sign-Up:**
```javascript
// User provides:
{
  fullName: "John Doe",        // Required
  username: "johndoe",         // Required, unique, validated
  email: "john@example.com",   // Required, unique, validated
  password: "SecurePass123!"   // Required, min 6 chars, hashed
}
```

**Google Sign-Up:**
```javascript
// Extracted from Google OAuth payload:
{
  fullName: "John Doe",        // From Google 'name' field
  email: "john@gmail.com",     // From Google 'email' field
  googleId: "1234567890",      // From Google 'sub' (subject) field
  profilePic: "https://...",   // From Google 'picture' field
  username: undefined,          // NOT set - user must set later
  password: "google_oauth_placeholder", // Placeholder
  isVerified: true             // Auto-verified
}
```

#### 2. **Verification Process**

**Regular Sign-Up:**
1. User submits sign-up form
2. Backend creates user with `isVerified: false`
3. Backend generates 6-digit OTP
4. OTP sent to user's email (expires in 10 minutes)
5. User enters OTP on verification screen
6. Backend verifies OTP and sets `isVerified: true`
7. User can now sign in

**Google Sign-Up:**
1. User clicks "Continue with Google"
2. Google OAuth flow completes
3. Backend creates user with `isVerified: true` immediately
4. No OTP required
5. User can immediately use the app

#### 3. **Account Linking**

If a user signs up with Google using an email that already exists in the system:

**Scenario 1: Existing Regular Account**
- Backend finds user by email
- If `googleId` is not set, it links the Google account
- User can now sign in with either email/password OR Google
- No duplicate account created

**Scenario 2: Existing Google Account**
- Backend finds user by email
- If `googleId` already matches, user is signed in
- If `googleId` doesn't match, error (shouldn't happen)

#### 4. **Username Handling**

**Regular Sign-Up:**
- Username is required and validated:
  - 3-20 characters
  - Lowercase letters, numbers, underscores only
  - Unique across all users
  - Real-time availability checking

**Google Sign-Up:**
- Username is **NOT** set initially
- User must set username later (likely during onboarding)
- Username field in User model is required, so this must be handled

---

## Data Collection & Storage

### User Model Schema

```javascript
{
  // Basic Info (from Google or manual input)
  fullName: String,           // From Google 'name' or user input
  username: String,           // User input (required, unique)
  email: String,              // From Google or user input (required, unique)
  bio: String,                // Optional, set later
  
  // Authentication
  password: String,            // Hashed with bcrypt (or placeholder for Google)
  googleId: String,           // Google user ID (unique, sparse index)
  isVerified: Boolean,         // true for Google, false until OTP for regular
  
  // Profile
  profilePic: String,         // URL from Google or uploaded later
  profilePicStorageKey: String, // Storage key for uploaded images
  
  // OTP (only for regular sign-up)
  otp: String,                // 6-digit code
  otpExpires: Date,           // 10 minutes from generation
  
  // Session
  lastLogin: Date,            // Updated on each sign-in
  
  // Social
  followers: [ObjectId],      // Array of user IDs
  following: [ObjectId],      // Array of user IDs
  
  // Timestamps
  createdAt: Date,            // Auto-generated
  updatedAt: Date             // Auto-generated
}
```

### What Data is Collected from Google?

When a user signs in with Google, the following data is extracted from the Google OAuth ID token:

```javascript
const payload = ticket.getPayload();
const {
  sub: googleId,        // Google user ID (unique identifier)
  email,                // User's Google email
  name,                 // User's full name from Google
  picture              // User's profile picture URL
} = payload;
```

**Note:** The app requests these scopes:
- `openid`: Required for OpenID Connect
- `profile`: Access to basic profile information (name, picture)
- `email`: Access to email address

### Storage Location

**Backend (MongoDB):**
- User document stored in `users` collection
- Password hashed with bcrypt (10 rounds)
- Google ID stored as plain string (unique, sparse index)

**Frontend (Client-Side):**
- **Mobile (React Native):**
  - Token: `AsyncStorage.setItem('authToken', token)`
  - User Data: `AsyncStorage.setItem('userData', JSON.stringify(user))`
  
- **Web:**
  - Token: httpOnly cookie (secure, sameSite: 'strict' in production)
  - Fallback: SessionStorage if cross-origin in development
  - User Data: Not stored (fetched from `/auth/me` endpoint)

---

## Technical Implementation

### Frontend Implementation

#### File: `frontend/services/googleAuth.ts`

```typescript
export const signInWithGoogle = async (): Promise<GoogleAuthResponse> => {
  // 1. Generate state parameter for CSRF protection
  const state = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    Math.random().toString(),
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  // 2. Configure OAuth request
  const authRequest = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    redirectUri: REDIRECT_URI,
    state,
    extraParams: {
      access_type: 'offline',  // Request refresh token
    },
  });

  // 3. Prompt user for Google authentication
  const authResponse = await authRequest.promptAsync({
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  });

  if (authResponse.type === 'success') {
    const { code, state: returnedState } = authResponse.params;
    
    // 4. Verify state parameter (CSRF protection)
    if (returnedState !== state) {
      throw new Error('State parameter mismatch');
    }
    
    // 5. Exchange authorization code for tokens on backend
    const response = await api.post('/api/v1/auth/google', {
      code,
      redirectUri: REDIRECT_URI,
    });
    
    const { token, user } = response.data;
    
    // 6. Store token and user data
    if (token) {
      await AsyncStorage.setItem('authToken', token);
    }
    if (user) {
      await AsyncStorage.setItem('userData', JSON.stringify(user));
    }
    
    return response.data;
  }
};
```

#### Sign-Up Screen Integration

**File: `frontend/app/(auth)/signup.tsx`**

```typescript
const handleGoogleSignIn = async () => {
  setIsGoogleLoading(true);
  try {
    const response = await signInWithGoogle();
    
    // Check if user is new (no onboarding completed)
    const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
    if (!onboardingCompleted) {
      // New user - navigate to onboarding
      router.replace('/onboarding/welcome');
    } else {
      // Existing user - navigate to home
      router.replace('/(tabs)/home');
    }
  } catch (error: any) {
    showError(error.message);
  } finally {
    setIsGoogleLoading(false);
  }
};
```

#### Sign-In Screen Integration

**File: `frontend/app/(auth)/signin.tsx`**

```typescript
const handleGoogleSignIn = async () => {
  setIsGoogleLoading(true);
  try {
    const response = await signInWithGoogle();
    
    // Track login event
    track('user_login', {
      method: 'google',
      user_id: response.user?._id,
    });
    
    // Check onboarding status
    const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
    if (!onboardingCompleted) {
      router.replace('/onboarding/welcome');
    } else {
      router.replace('/(tabs)/home');
    }
  } catch (error: any) {
    showError(error.message);
  } finally {
    setIsGoogleLoading(false);
  }
};
```

### Backend Implementation

#### File: `backend/src/controllers/authController.js`

```javascript
// Google OAuth client initialization
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Google sign-in endpoint
const googleSignIn = async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    // 1. Exchange authorization code for tokens
    const { tokens } = await googleClient.getToken({
      code,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    });

    // 2. Verify the ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Failed to verify Google ID token'
      });
    }

    // 3. Extract user information
    const { sub: googleId, email, name, picture } = payload;

    // 4. Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists - link Google account if not already linked
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Create new user
      user = new User({
        fullName: name || 'Google User',
        email,
        googleId,
        profilePic: picture || '',
        isVerified: true,  // Google accounts are pre-verified
        password: 'google_oauth_placeholder',  // Placeholder password
      });
      await user.save();

      // Send welcome email (async, don't await)
      sendWelcomeEmail(email, user.fullName).catch(err => 
        logger.error('Welcome email failed:', err)
      );
    }

    // 5. Update last login
    user.lastLogin = new Date();
    await user.save();

    // 6. Generate JWT token
    const token = generateToken(user._id);

    // 7. Set token (cookie for web, response for mobile)
    const tokenResponse = setAuthToken(res, token, req);

    res.status(200).json({
      message: 'Google sign-in successful',
      ...tokenResponse,  // Includes token for mobile
      user: user.getPublicProfile()
    });

  } catch (error) {
    logger.error('Google sign-in error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error processing Google sign-in'
    });
  }
};
```

#### JWT Token Generation

```javascript
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: '30d'  // 30 days expiration
  });
};
```

#### Token Storage (Platform-Aware)

**File: `backend/src/utils/authHelpers.js`**

```javascript
const setAuthToken = (res, token, req) => {
  const platform = req.headers['x-platform'];
  const userAgent = req.headers['user-agent'] || '';
  const isWeb = platform === 'web' || 
    (userAgent.includes('Mozilla') && !userAgent.includes('Mobile'));

  if (isWeb) {
    // Web: Set httpOnly cookie
    res.cookie('authToken', token, {
      httpOnly: true,        // Prevents JavaScript access (XSS protection)
      secure: isProduction,  // HTTPS only in production
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
      path: '/'
    });
    return {};  // Don't send token in response body
  }
  
  // Mobile: Return token in response (stored in AsyncStorage)
  return { token };
};
```

---

## Security Considerations

### 1. **CSRF Protection**

- **State Parameter**: Random state generated on frontend, verified on backend
- **Purpose**: Prevents cross-site request forgery attacks
- **Implementation**: SHA256 hash of random string

```typescript
const state = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  Math.random().toString(),
  { encoding: Crypto.CryptoEncoding.HEX }
);
```

### 2. **Token Security**

- **JWT Secret**: Stored in environment variables, never exposed
- **Token Expiration**: 30 days (configurable)
- **Storage**:
  - **Web**: httpOnly cookies (prevents XSS attacks)
  - **Mobile**: AsyncStorage (secure storage on device)

### 3. **ID Token Verification**

- **Audience Check**: Verifies token was issued for our client ID
- **Signature Verification**: Google's public keys used to verify token signature
- **Expiration Check**: Token must not be expired

```javascript
const ticket = await googleClient.verifyIdToken({
  idToken: tokens.id_token,
  audience: process.env.GOOGLE_CLIENT_ID,  // Must match our client ID
});
```

### 4. **Account Linking Security**

- **Email Verification**: Only links if email matches existing account
- **Google ID Uniqueness**: `googleId` field has unique sparse index
- **No Password Override**: Google users cannot override existing password-based accounts

### 5. **Password Handling for Google Users**

- **Placeholder Password**: `'google_oauth_placeholder'`
- **Purpose**: Satisfies User model requirement (password field is required)
- **Security**: Google users cannot sign in with email/password (password comparison will fail)
- **Future Enhancement**: Consider making password optional for Google users

---

## User Experience Flow

### New User Sign-Up with Google

1. **User Action**: Clicks "Continue with Google" on sign-up screen
2. **Google OAuth**: Redirected to Google account selection
3. **Google Authentication**: User selects account and grants permissions
4. **Account Creation**: Backend creates account automatically
5. **Welcome Email**: Sent immediately (async)
6. **Navigation**: 
   - If `onboarding_completed` flag not set → Navigate to `/onboarding/welcome`
   - If flag is set → Navigate to `/(tabs)/home`

### Existing User Sign-In with Google

1. **User Action**: Clicks "Continue with Google" on sign-in screen
2. **Google OAuth**: Redirected to Google account selection
3. **Google Authentication**: User selects account
4. **Account Lookup**: Backend finds user by email
5. **Account Linking**: If `googleId` not set, links Google account
6. **Token Generation**: JWT token generated and stored
7. **Navigation**: 
   - If `onboarding_completed` flag not set → Navigate to `/onboarding/welcome`
   - If flag is set → Navigate to `/(tabs)/home`

### Regular Sign-Up vs Google Sign-Up Flow Comparison

**Regular Sign-Up:**
```
Sign-Up Form → Backend Creates Account (isVerified: false) 
→ OTP Email Sent → User Enters OTP → Account Verified 
→ Navigate to Onboarding/Home
```

**Google Sign-Up:**
```
Click "Continue with Google" → Google OAuth → Backend Creates Account (isVerified: true) 
→ Welcome Email Sent → Navigate to Onboarding/Home
```

---

## Code Locations

### Frontend Files

1. **Google Auth Service**: `frontend/services/googleAuth.ts`
   - `signInWithGoogle()`: Main function for Google authentication
   - `signOutGoogle()`: Clears stored tokens

2. **Sign-Up Screen**: `frontend/app/(auth)/signup.tsx`
   - `handleGoogleSignIn()`: Handles Google sign-up flow
   - Form validation and username availability checking

3. **Sign-In Screen**: `frontend/app/(auth)/signin.tsx`
   - `handleGoogleSignIn()`: Handles Google sign-in flow
   - Analytics tracking

4. **Config**: `frontend/utils/config.ts`
   - `GOOGLE_CLIENT_ID`: Google OAuth client ID
   - `GOOGLE_REDIRECT_URI`: Redirect URI for OAuth

### Backend Files

1. **Auth Controller**: `backend/src/controllers/authController.js`
   - `googleSignIn()`: Main Google authentication handler
   - `signup()`: Regular email/password sign-up
   - `signin()`: Regular email/password sign-in
   - `generateToken()`: JWT token generation

2. **User Model**: `backend/src/models/User.js`
   - User schema definition
   - Password hashing (pre-save hook)
   - OTP generation/verification methods
   - `getPublicProfile()`: Returns safe user data

3. **Auth Helpers**: `backend/src/utils/authHelpers.js`
   - `setAuthToken()`: Platform-aware token storage
   - `clearAuthToken()`: Clears authentication cookie
   - `getAuthToken()`: Retrieves token from request

4. **Auth Routes**: `backend/src/routes/authRoutes.js`
   - `POST /api/v1/auth/google`: Google sign-in endpoint
   - `POST /api/v1/auth/signup`: Regular sign-up endpoint
   - `POST /api/v1/auth/signin`: Regular sign-in endpoint

### Environment Variables

**Backend:**
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=your-redirect-uri
JWT_SECRET=your-jwt-secret
```

**Frontend:**
```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
EXPO_PUBLIC_GOOGLE_REDIRECT_URI=your-redirect-uri
```

---

## Testing Scenarios

### Test Case 1: New User Google Sign-Up

**Steps:**
1. Navigate to sign-up screen
2. Click "Continue with Google"
3. Select Google account
4. Grant permissions

**Expected Result:**
- New user account created with `isVerified: true`
- `googleId` stored in database
- Profile picture set from Google
- Welcome email sent
- Navigate to onboarding screen

**Database Check:**
```javascript
{
  email: "user@gmail.com",
  googleId: "1234567890",
  isVerified: true,
  profilePic: "https://lh3.googleusercontent.com/...",
  password: "google_oauth_placeholder"
}
```

### Test Case 2: Existing User Google Sign-In

**Steps:**
1. Navigate to sign-in screen
2. Click "Continue with Google"
3. Select same Google account used in sign-up

**Expected Result:**
- User found by email
- `lastLogin` updated
- JWT token generated
- Navigate to home screen

### Test Case 3: Account Linking

**Steps:**
1. Create account with email/password
2. Sign out
3. Sign in with Google using same email

**Expected Result:**
- User found by email
- `googleId` added to existing account
- User can now sign in with either method
- No duplicate account created

### Test Case 4: Regular Sign-Up After Google Sign-Up

**Steps:**
1. Sign up with Google
2. Sign out
3. Try to sign up with email/password using same email

**Expected Result:**
- Error: "An account with this email already exists and is verified"
- User should use sign-in instead

### Test Case 5: State Parameter Verification

**Steps:**
1. Intercept OAuth request
2. Modify state parameter
3. Complete authentication

**Expected Result:**
- Error: "State parameter mismatch"
- Authentication fails

### Test Case 6: Token Storage (Web vs Mobile)

**Web:**
- Token stored in httpOnly cookie
- Not accessible via JavaScript
- Sent automatically with requests

**Mobile:**
- Token stored in AsyncStorage
- Accessible via `AsyncStorage.getItem('authToken')`
- Sent in `Authorization: Bearer <token>` header

---

## Troubleshooting

### Issue 1: "State parameter mismatch"

**Cause:** CSRF protection detected state mismatch
**Solution:** Ensure state is generated and verified correctly

### Issue 2: "Invalid token" or "Failed to verify Google ID token"

**Causes:**
- Token expired
- Wrong client ID
- Token not from Google

**Solution:**
- Check `GOOGLE_CLIENT_ID` matches Google Console
- Verify token hasn't expired
- Ensure `verifyIdToken` is called correctly

### Issue 3: "User already exists" when signing up with Google

**Cause:** Email already registered
**Solution:** User should sign in instead, or account will be linked

### Issue 4: Token not persisting on web

**Causes:**
- Cross-origin request (development)
- Cookie settings incorrect
- Browser blocking cookies

**Solution:**
- Check `sameSite` and `secure` flags
- Verify frontend and backend domains
- Check browser console for cookie errors

### Issue 5: Username not set for Google users

**Cause:** Google sign-up doesn't collect username
**Solution:** 
- Username must be set during onboarding
- Or add username collection step after Google sign-up
- Consider making username optional for Google users

### Issue 6: Profile picture not loading

**Causes:**
- Google picture URL expired
- CORS issues
- Invalid URL format

**Solution:**
- Download and store picture in our storage
- Use `profilePicStorageKey` for uploaded images
- Generate signed URLs for profile pictures

---

## Key Learnings & Best Practices

### 1. **Always Verify ID Tokens**

Never trust the authorization code alone. Always exchange it for tokens and verify the ID token on the backend.

### 2. **Use State Parameter for CSRF Protection**

Generate a random state, store it, and verify it matches on return. This prevents CSRF attacks.

### 3. **Platform-Aware Token Storage**

- Web: Use httpOnly cookies for security
- Mobile: Use secure storage (AsyncStorage)
- Never store tokens in localStorage on web (XSS vulnerability)

### 4. **Account Linking Strategy**

- Link accounts by email (most reliable)
- Store `googleId` for future Google sign-ins
- Don't create duplicate accounts

### 5. **Auto-Verification for OAuth**

Google accounts are pre-verified, so set `isVerified: true` immediately. No OTP needed.

### 6. **Placeholder Passwords**

For OAuth users, use a placeholder password that cannot be used for email/password sign-in. Consider making password optional in the future.

### 7. **Welcome Emails**

Send welcome emails asynchronously to avoid blocking the authentication response.

### 8. **Error Handling**

Always handle OAuth errors gracefully:
- User cancellation
- Network errors
- Invalid tokens
- Account conflicts

---

## Future Enhancements

1. **Username Collection**: Add username input step after Google sign-up
2. **Profile Picture Storage**: Download and store Google profile pictures in our storage
3. **Optional Password**: Make password field optional for OAuth users
4. **Multiple OAuth Providers**: Support Apple, Facebook, etc.
5. **Account Merging**: Allow users to merge accounts with different emails
6. **Refresh Tokens**: Implement refresh token flow for longer sessions
7. **OAuth Revocation**: Handle token revocation when user disconnects Google account

---

## Conclusion

Google OAuth authentication provides a seamless sign-up and sign-in experience for users, eliminating the need for email verification and password creation. The implementation follows OAuth 2.0 best practices with CSRF protection, secure token storage, and proper account linking. The system handles both new user registration and existing user authentication, with platform-aware token storage for web and mobile clients.

**Key Takeaways:**
- Google sign-up is faster (no OTP verification)
- Account linking prevents duplicate accounts
- Secure token storage (httpOnly cookies for web)
- Auto-verification for Google accounts
- Username must be set separately for Google users

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Author:** Development Team  
**Review Status:** Ready for Production

