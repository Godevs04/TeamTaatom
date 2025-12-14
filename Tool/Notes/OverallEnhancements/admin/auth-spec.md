# Authentication & Login - Product Specification

## 1. Overview

The Authentication system provides secure access to the SuperAdmin panel through email/password login with mandatory two-factor authentication (2FA). It includes session management, auto-logout on inactivity, and comprehensive security logging.

### User Personas & Goals

- **Founders**: Secure access to full platform control
- **Admins**: Access with role-based permissions
- **Moderators**: Limited access based on assigned permissions

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/Login.jsx`): Login form, 2FA verification, password visibility toggle
- **Backend** (`backend/src/controllers/superAdminController.js`): Handles login, 2FA generation/verification, token management
- **Auth Context** (`superAdmin/src/context/AuthContext.jsx`): Manages authentication state, session timeout, auto-logout

---

## 2. Screen & Navigation Map (Frontend)

### Login Screen

**File**: `superAdmin/src/pages/Login.jsx`

**Purpose**: Authenticate SuperAdmin users with email/password and 2FA

**Entry Points**:
- Direct URL: `/login`
- Redirect from protected routes when not authenticated
- Auto-redirect after session timeout

**Exit Points**:
- Successful login → Redirect to `/dashboard`
- Cancel/Back → Stay on login page (no navigation)

**Components Used**:
- `ProtectedRoute` (`superAdmin/src/components/ProtectedRoute.jsx`): Guards routes, redirects to login if not authenticated
- `Layout`: Not used on login page (standalone page)

**Flow States**:
1. **Email/Password Form**: Initial login form
2. **2FA Verification**: After email/password validation, show 2FA code input
3. **Success**: Redirect to dashboard

---

## 3. Detailed Features & User Flows

### 3.1 Email/Password Login

**Feature Name**: Initial Authentication

**Business Description**: User enters email and password. System validates credentials and sends 2FA code via email.

**Preconditions**:
- User must have valid SuperAdmin account
- Email must be verified (if required)
- Account must be active (`isActive: true`)

**Step-by-Step Flow**:
1. User navigates to `/login` or is redirected
2. User enters email and password
3. User clicks "Sign In" button
4. Frontend validates email format (client-side)
5. Frontend calls `login(email, password)` from `AuthContext`
6. Backend endpoint `POST /api/v1/superadmin/login` is called
7. Backend validates email/password:
   - Find SuperAdmin by email
   - Check if account is locked (`isLocked: true`)
   - Verify password using bcrypt
   - Check login attempts (lock after 5 failed attempts)
8. If valid, generate 6-digit OTP
9. Send OTP via email using `sendSuperAdmin2FAEmail()`
10. Generate temporary token for 2FA verification
11. Return response with `requires2FA: true` and `token`
12. Frontend shows 2FA code input form
13. Frontend stores temporary token in state

**Validations**:
- Email: Must be valid email format, required
- Password: Minimum 8 characters, required
- Account status: Must be active, not locked
- Login attempts: Max 5 attempts before lockout (15 minutes)

**Error States**:
- Invalid email/password: Show "Invalid email or password" error
- Account locked: Show "Account temporarily locked" with unlock time
- Email send failure: Show "Failed to send 2FA code. Please try again."
- Network error: Show "Connection error. Please check your internet."

**Success States**:
- Valid credentials: Show "2FA code sent to your email" toast
- Transition to 2FA verification form
- Temporary token stored in `AuthContext` state

### 3.2 Two-Factor Authentication (2FA)

**Feature Name**: 2FA Verification

**Business Description**: User enters 6-digit code received via email to complete authentication.

**Preconditions**:
- User must have completed email/password login
- 2FA code must have been sent (within last 10 minutes)
- Temporary token must be valid

**Step-by-Step Flow**:
1. User receives email with 6-digit OTP
2. User enters OTP in 2FA input field
3. User clicks "Verify" button
4. Frontend calls `verify2FA(code)` from `AuthContext`
5. Backend endpoint `POST /api/v1/superadmin/verify-2fa` is called with:
   - Temporary token (from previous step)
   - OTP code
6. Backend validates:
   - Temporary token is valid and not expired
   - OTP matches stored OTP
   - OTP has not expired (10 minute window)
   - OTP attempts < 3 (lock after 3 failed attempts)
7. If valid:
   - Generate permanent JWT token (expires in 24 hours or configurable)
   - Update `lastLogin` timestamp
   - Reset `loginAttempts` to 0
   - Log successful login in security logs
   - Send login alert email (if configured)
8. Return JWT token and user data
9. Frontend stores token in `localStorage` as `founder_token`
10. Frontend sets token in API default headers
11. Frontend updates `AuthContext` with user data
12. Redirect to `/dashboard`

**Validations**:
- OTP: Must be 6 digits, required
- OTP expiration: 10 minutes from generation
- OTP attempts: Max 3 attempts before requiring resend
- Temporary token: Must be valid and not expired

**Error States**:
- Invalid OTP: Show "Invalid verification code" error
- Expired OTP: Show "Code expired. Please request a new code."
- Too many attempts: Show "Too many attempts. Please request a new code."
- Network error: Show connection error message

**Success States**:
- Valid OTP: Show "Login successful" toast
- Redirect to dashboard
- Token stored securely

### 3.3 Resend 2FA Code

**Feature Name**: Resend 2FA Code

**Business Description**: User can request a new 2FA code if original code expired or was not received.

**Preconditions**:
- User must be in 2FA verification step
- Temporary token must be valid
- Resend cooldown must have passed (60 seconds)

**Step-by-Step Flow**:
1. User clicks "Resend Code" link
2. Frontend checks resend cooldown (60 seconds)
3. If cooldown active, show countdown timer
4. If cooldown passed, call `resend2FA()` from `AuthContext`
5. Backend endpoint `POST /api/v1/superadmin/resend-2fa` is called with temporary token
6. Backend validates temporary token
7. Generate new OTP and expiration
8. Send new OTP via email
9. Update temporary token with new OTP
10. Return success response
11. Frontend shows "New code sent to your email" toast
12. Reset resend cooldown to 60 seconds

**Validations**:
- Cooldown: 60 seconds between resends
- Temporary token: Must be valid
- Email service: Must be available

**Error States**:
- Cooldown active: Show countdown timer, disable button
- Email send failure: Show "Failed to resend code" error
- Invalid token: Redirect to login page

**Success States**:
- New code sent: Show success toast
- Cooldown timer starts

### 3.4 Session Management

**Feature Name**: Auto-Logout on Inactivity

**Business Description**: Automatically logs out user after period of inactivity to prevent unauthorized access.

**Preconditions**:
- User must be authenticated
- Session timeout configured (default: 15 minutes)

**Step-by-Step Flow**:
1. User successfully logs in
2. `AuthContext` tracks `lastActivity` timestamp
3. Event listeners track user activity:
   - `mousedown`, `mousemove`, `keypress`, `scroll`, `touchstart`
4. On any activity, update `lastActivity` timestamp
5. Background interval checks every minute:
   - Calculate time since `lastActivity`
   - If > `sessionTimeout`, call `handleAutoLogout()`
6. `handleAutoLogout()`:
   - Clear token from `localStorage`
   - Clear API headers
   - Show "Session expired due to inactivity" toast
   - Redirect to `/login`
7. User must log in again

**Validations**:
- Session timeout: Configurable in Settings (default: 15 minutes, range: 5-60 minutes)
- Activity detection: Any user interaction resets timer

**Error States**:
- N/A (passive feature)

**Success States**:
- Activity detected: Timer resets silently
- Inactivity detected: User logged out with notification

---

## 4. Data Model & API Design

### 4.1 Login Endpoint

**Endpoint**: `POST /api/v1/superadmin/login`

**Authentication**: Not required (public endpoint)

**Request Body**:
```javascript
{
  email: string,      // Required, valid email format
  password: string   // Required, min 8 characters
}
```

**Response** (Success):
```javascript
{
  message: "2FA code sent to your email",
  requires2FA: true,
  token: string,      // Temporary token for 2FA verification
  expiresAt: Date     // OTP expiration time
}
```

**Response** (Error):
```javascript
{
  error: {
    code: "AUTH_1001" | "AUTH_1008" | "SRV_6001",
    message: string
  }
}
```

### 4.2 Verify 2FA Endpoint

**Endpoint**: `POST /api/v1/superadmin/verify-2fa`

**Authentication**: Temporary token required

**Request Body**:
```javascript
{
  code: string,      // 6-digit OTP
  token: string      // Temporary token from login response
}
```

**Response** (Success):
```javascript
{
  message: "Login successful",
  token: string,     // Permanent JWT token
  user: {
    id: string,
    email: string,
    role: "founder" | "admin" | "moderator",
    permissions: {
      canManageUsers: boolean,
      canManageContent: boolean,
      canManageReports: boolean,
      canManageModerators: boolean,
      canViewLogs: boolean,
      canManageSettings: boolean
    },
    profile: {
      firstName: string,
      lastName: string,
      avatar: string
    }
  }
}
```

### 4.3 Resend 2FA Endpoint

**Endpoint**: `POST /api/v1/superadmin/resend-2fa`

**Authentication**: Temporary token required

**Request Body**:
```javascript
{
  token: string      // Temporary token from login response
}
```

**Response** (Success):
```javascript
{
  message: "New 2FA code sent to your email",
  expiresAt: Date
}
```

### 4.4 Verify Token Endpoint

**Endpoint**: `GET /api/superadmin/verify`

**Authentication**: JWT token required

**Response**:
```javascript
{
  message: "Token is valid",
  user: {
    id: string,
    email: string,
    role: string,
    permissions: object,
    profile: object,
    lastLogin: Date
  }
}
```

### 4.5 Data Models

**SuperAdmin Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  email: string,                    // Unique, lowercase, trimmed
  password: string,                 // Hashed with bcrypt
  role: "founder" | "admin" | "moderator",
  organization: string,
  isActive: boolean,
  isLocked: boolean,
  lastLogin: Date,
  loginAttempts: number,
  lockUntil: Date,
  securitySettings: {
    twoFactorEnabled: boolean,      // Always true, immutable
    sessionTimeout: number,         // Minutes
    maxLoginAttempts: number,       // Default: 5
    lockoutDuration: number         // Minutes, default: 15
  },
  twoFactorAuth: {
    secret: string,
    backupCodes: [string],
    isEnabled: boolean              // Always true, immutable
  },
  tempAuth: {
    token: string,                 // Temporary token for 2FA
    expiresAt: Date,
    attempts: number
  },
  permissions: {
    canManageUsers: boolean,
    canManageContent: boolean,
    canManageReports: boolean,
    canManageModerators: boolean,
    canViewLogs: boolean,
    canManageSettings: boolean
  },
  profile: {
    firstName: string,
    lastName: string,
    avatar: string
  },
  securityLogs: [{
    timestamp: Date,
    action: string,
    details: string,
    ipAddress: string,
    userAgent: string,
    success: boolean
  }]
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Auth Context

**File**: `superAdmin/src/context/AuthContext.jsx`

**State Variables**:
- `user`: Current authenticated user object (null if not logged in)
- `loading`: Initial authentication check in progress
- `isInitialized`: Whether auth state has been checked
- `requires2FA`: Whether 2FA verification is needed
- `tempToken`: Temporary token for 2FA verification
- `lastActivity`: Timestamp of last user activity
- `sessionTimeout`: Configured session timeout in milliseconds

**Key Functions**:
- `login(email, password)`: Initiates login, returns `{ success, requires2FA, token }`
- `verify2FA(code)`: Verifies 2FA code, returns `{ success, token, user }`
- `resend2FA()`: Requests new 2FA code
- `logout()`: Clears session, redirects to login
- `handleAutoLogout()`: Called when session expires

**Side Effects**:
- `useEffect` on mount: Checks for existing token, verifies with backend
- `useEffect` for activity tracking: Listens to user interaction events
- `useEffect` for session timeout: Checks inactivity every minute
- `useEffect` for session timeout config: Loads from Settings API

### 5.2 Login Component State

**Login Component** (`superAdmin/src/pages/Login.jsx`):
- `email`: Email input value
- `password`: Password input value
- `showPassword`: Toggle password visibility
- `loading`: API call in progress
- `error`: Error message to display
- `twoFACode`: 2FA code input value
- `resendCooldown`: Countdown timer for resend (seconds)

---

## 6. Backend Logic & Rules

### 6.1 Login Controller

**File**: `backend/src/controllers/superAdminController.js`

**Function**: `loginSuperAdmin(req, res)`

**Business Logic**:
1. Extract email and password from request body
2. Validate email and password are present
3. Find SuperAdmin by email using `SuperAdmin.findByEmail(email)`
4. If not found, log failed attempt and return error
5. Check if account is locked (`isLocked: true`)
6. If locked, return "Account temporarily locked" error
7. Verify password using `superAdmin.comparePassword(password)`
8. If invalid:
   - Increment `loginAttempts`
   - If `loginAttempts >= 5`, lock account for 15 minutes
   - Log security event
   - Return error
9. If valid:
   - Generate 6-digit OTP using `superAdmin.generateOTP()`
   - Save OTP and expiration to `tempAuth` field
   - Send OTP via email using `sendSuperAdmin2FAEmail()`
   - Generate temporary token using `superAdmin.generateTempToken()`
   - Log security event (2FA sent)
   - Return success with temporary token

**Security Features**:
- Password hashing: bcrypt with salt rounds
- Account lockout: 5 failed attempts = 15 minute lockout
- IP tracking: Log IP address and user agent
- Security logging: All login attempts logged

### 6.2 2FA Verification Controller

**Function**: `verify2FA(req, res)`

**Business Logic**:
1. Extract code and temporary token from request body
2. Decode temporary token to get SuperAdmin ID
3. Find SuperAdmin by ID
4. Validate temporary token is not expired
5. Check OTP attempts < 3
6. Compare provided code with stored OTP
7. Check OTP has not expired (10 minute window)
8. If invalid:
   - Increment `tempAuth.attempts`
   - If attempts >= 3, invalidate temporary token
   - Return error
9. If valid:
   - Generate permanent JWT token (24 hour expiration)
   - Update `lastLogin` timestamp
   - Reset `loginAttempts` to 0
   - Clear `tempAuth` object
   - Log successful login
   - Send login alert email (optional)
   - Return JWT token and user data

**JWT Token Payload**:
```javascript
{
  id: string,        // SuperAdmin _id
  email: string,
  role: string,
  iat: number,       // Issued at
  exp: number        // Expiration (24 hours)
}
```

### 6.3 Resend 2FA Controller

**Function**: `resend2FA(req, res)`

**Business Logic**:
1. Extract temporary token from request body
2. Decode token to get SuperAdmin ID
3. Find SuperAdmin by ID
4. Generate new OTP and expiration
5. Update `tempAuth` with new OTP
6. Send new OTP via email
7. Log security event
8. Return success

### 6.4 Token Verification Middleware

**File**: `backend/src/controllers/superAdminController.js`

**Function**: `verifySuperAdminToken(req, res, next)`

**Business Logic**:
1. Extract token from `Authorization` header (Bearer token)
2. If no token, return 401
3. Verify JWT token using `jwt.verify()`
4. Find SuperAdmin by ID from token payload
5. Check SuperAdmin exists and `isActive: true`
6. Attach SuperAdmin to `req.superAdmin`
7. Call `next()` to continue

**Error Handling**:
- `TokenExpiredError`: Return 401 with "Token expired"
- `JsonWebTokenError`: Return 401 with "Invalid token"
- Other errors: Return 500 with generic error

---

## 7. superAdmin Dependencies

### 7.1 Email Service

- **2FA Email**: Uses `sendSuperAdmin2FAEmail()` utility
- **Login Alert**: Uses `sendSuperAdminLoginAlertEmail()` utility (optional)
- **Email Provider**: Configurable (SMTP, SendGrid, etc.)

### 7.2 Settings Impact

- **Session Timeout**: Loaded from SystemSettings, affects auto-logout
- **Max Login Attempts**: Configurable in SuperAdmin model (default: 5)
- **Lockout Duration**: Configurable in SuperAdmin model (default: 15 minutes)

### 7.3 Feature Flags

- N/A (authentication is always enabled)

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication Security

- **Password Requirements**: Minimum 8 characters (enforced client and server)
- **Password Hashing**: bcrypt with salt rounds (10+)
- **2FA**: Always enabled, cannot be disabled
- **OTP Expiration**: 10 minutes
- **OTP Attempts**: Maximum 3 attempts before requiring resend

### 8.2 Session Security

- **JWT Expiration**: 24 hours (configurable)
- **Session Timeout**: 15 minutes inactivity (configurable)
- **Token Storage**: `localStorage` (consider httpOnly cookies for production)
- **Token Refresh**: Not implemented (user must re-login after expiration)

### 8.3 Account Security

- **Account Lockout**: 5 failed login attempts = 15 minute lockout
- **IP Tracking**: All login attempts logged with IP address
- **User Agent Tracking**: Browser/device info logged
- **Security Logs**: All authentication events logged in `securityLogs` array

### 8.4 CSRF Protection

- **CSRF Token**: Required for state-changing requests (POST, PUT, PATCH, DELETE)
- **Token Generation**: `GET /api/superadmin/csrf-token`
- **Token Validation**: Middleware checks `X-CSRF-Token` header

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Login Attempt**: `login_attempt` (success: true/false)
- **2FA Sent**: `2fa_sent` (success: true)
- **2FA Verified**: `2fa_verified` (success: true/false)
- **Account Locked**: `account_locked` (details: reason)
- **Session Expired**: `session_expired` (automatic logout)

### 9.2 Security Logs

All events logged in `SuperAdmin.securityLogs` array:
```javascript
{
  timestamp: Date,
  action: string,        // "login_attempt", "2fa_sent", etc.
  details: string,       // Human-readable description
  ipAddress: string,     // Client IP
  userAgent: string,     // Browser/device info
  success: boolean       // Whether action succeeded
}
```

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Password Length**: Minimum 8 characters
- **OTP Length**: 6 digits
- **OTP Expiration**: 10 minutes
- **OTP Attempts**: Maximum 3 per temporary token
- **Login Attempts**: Maximum 5 before lockout
- **Lockout Duration**: 15 minutes (configurable)
- **Session Timeout**: 15 minutes inactivity (configurable, range: 5-60 minutes)
- **Resend Cooldown**: 60 seconds

### 10.2 Error Handling

- **Network Failures**: Retry up to 3 times with exponential backoff
- **Email Service Down**: Show error, allow manual retry
- **Token Expiration**: Automatic redirect to login
- **Invalid Credentials**: Generic error message (don't reveal which field is wrong)

### 10.3 Known Constraints

- **Email Delivery**: Depends on email service availability
- **OTP Delivery**: May be delayed in some email providers
- **Browser Storage**: `localStorage` can be cleared by user
- **Session Persistence**: Lost on browser close (no "Remember Me")
- **Mobile Support**: 2FA email may be slow on mobile networks

### 10.4 Security Considerations

- **Password Visibility**: Toggle available (eye icon)
- **Token Storage**: `localStorage` vulnerable to XSS (consider httpOnly cookies)
- **OTP Security**: OTP sent via email (less secure than SMS/authenticator app)
- **Account Recovery**: Not implemented (must contact admin)

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Remember Me**: Option to extend session beyond 24 hours
- **Password Reset**: Self-service password reset flow
- **Account Recovery**: Email-based account recovery
- **Login History**: View recent login attempts in profile

### 11.2 Next (Medium Priority)

- **Authenticator App**: Support for TOTP apps (Google Authenticator, Authy)
- **Backup Codes**: Generate and display backup codes for 2FA
- **Device Trust**: Remember trusted devices, skip 2FA
- **SMS 2FA**: Alternative 2FA method via SMS

### 11.3 Later (Low Priority)

- **Biometric Auth**: Fingerprint/Face ID support (mobile)
- **SSO Integration**: Single Sign-On with external providers
- **Multi-factor Options**: Choose 2FA method (email/SMS/app)
- **Session Management**: View and revoke active sessions

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- React Router for navigation
- React Hot Toast for notifications
- Framer Motion for animations

**Key Dependencies**:
- `react-router-dom`: Navigation and route protection
- `react-hot-toast`: Toast notifications
- `framer-motion`: Page transitions
- `date-fns`: Date formatting (for cooldown timer)

### 12.2 Backend Architecture

**Technology Stack**:
- Node.js with Express
- MongoDB with Mongoose
- JWT for token generation
- bcrypt for password hashing
- Nodemailer (or similar) for email sending

**Key Dependencies**:
- `jsonwebtoken`: JWT token generation/verification
- `bcryptjs`: Password hashing
- `mongoose`: MongoDB ODM
- Email service (SMTP, SendGrid, etc.)

### 12.3 Data Flow

1. User enters email/password
2. Frontend validates format
3. API call to `/api/v1/superadmin/login`
4. Backend validates credentials
5. Backend generates OTP and sends email
6. Frontend receives temporary token
7. User enters OTP
8. API call to `/api/v1/superadmin/verify-2fa`
9. Backend validates OTP
10. Backend generates JWT token
11. Frontend stores token and redirects
12. All subsequent requests include token in header

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/superadmin/login` | Login with email/password | No |
| POST | `/api/v1/superadmin/verify-2fa` | Verify 2FA code | Temporary token |
| POST | `/api/v1/superadmin/resend-2fa` | Resend 2FA code | Temporary token |
| GET | `/api/superadmin/verify` | Verify JWT token | JWT token |
| POST | `/api/superadmin/logout` | Logout (clear session) | JWT token |
| GET | `/api/superadmin/csrf-token` | Get CSRF token | No (but recommended) |

---

## 14. Related Documentation

- **Dashboard**: See `dashboard-spec.md` for post-login experience
- **Settings**: See `settings-spec.md` for session timeout configuration
- **Moderators**: See `moderators-spec.md` for role and permission management
- **Logs**: See `logs-spec.md` for security log viewing

