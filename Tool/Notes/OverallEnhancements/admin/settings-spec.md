# Settings Management - Product Specification

## 1. Overview

The Settings menu provides comprehensive system configuration capabilities for SuperAdmin users. It enables administrators to manage security settings, feature toggles, system preferences, email/SMTP configuration, storage settings, and privacy policies.

### User Personas & Goals

- **Founders**: Full system configuration, critical security settings
- **Admins**: Manage operational settings, feature toggles
- **Moderators**: Limited settings access (if permission granted)

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/Settings.jsx`): Settings UI with tabs, form inputs, validation
- **Backend** (`backend/src/routes/enhancedSuperAdminRoutes.js`): Serves and updates settings
- **SystemSettings Model** (`backend/src/models/SystemSettings.js`): Stores settings in database

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/Settings.jsx`

**Purpose**: Configure system-wide settings across multiple categories

**Entry Points**:
- Navigation from sidebar (Settings menu item)
- Direct URL: `/settings`
- Navigation from other pages (settings links)

**Exit Points**:
- Click sidebar menu → Navigate to other pages
- Save settings → Stay on page, show success message

**Components Used**:
- `Card`: Settings section containers
- `Modal`: Confirmation modals for critical changes
- `SafeComponent`: Error boundary wrapper

**Tabs/Sections**:
- **Security Settings**: Session timeout, login attempts, password requirements
- **Feature Toggles**: Enable/disable platform features
- **System Settings**: Maintenance mode, debug mode, logging
- **API Settings**: Rate limiting configuration
- **Email Settings**: SMTP configuration
- **Storage Settings**: File size limits, allowed types
- **Privacy Settings**: Data retention, GDPR compliance

---

## 3. Detailed Features & User Flows

### 3.1 Security Settings

**Feature Name**: Security Configuration

**Business Description**: Configure authentication and security-related settings.

**Preconditions**:
- User must be authenticated
- User must have `canManageSettings` permission (or be founder)

**Step-by-Step Flow**:
1. User navigates to Settings page
2. User clicks "Security" tab/section
3. Display security settings:
   - **PIN Required**: Toggle for requiring PIN on sensitive actions
   - **Two-Factor Auth**: Always enabled (immutable for SuperAdmin)
   - **Session Timeout**: Number input (minutes, default: 30, range: 5-60)
   - **Max Login Attempts**: Number input (default: 5, range: 3-10)
   - **Password Min Length**: Number input (default: 8, range: 6-20)
   - **Require Email Verification**: Toggle
4. User modifies settings
5. User clicks "Save Security Settings"
6. Frontend validates inputs
7. Backend endpoint `PATCH /api/superadmin/settings` is called with security category
8. Backend validates and updates `SystemSettings` document
9. Backend logs setting change in security logs
10. Response returns updated settings
11. Frontend updates UI
12. Show success toast
13. For session timeout: Update `AuthContext` with new value

**Validations**:
- Session Timeout: 5-60 minutes
- Max Login Attempts: 3-10
- Password Min Length: 6-20 characters
- All numeric inputs: Must be valid numbers

**Error States**:
- Validation errors: Show field-specific errors
- Save failure: Show error message, allow retry
- Invalid range: Show "Value must be between X and Y"

**Success States**:
- Save successful: Show success toast
- Settings updated: UI reflects new values
- Session timeout: Applied immediately to current session

### 3.2 Feature Toggles

**Feature Name**: Feature Management

**Business Description**: Enable or disable platform features without code deployment.

**Preconditions**:
- Same as Security Settings

**Step-by-Step Flow**:
1. User clicks "Features" tab/section
2. Display feature toggles:
   - **User Registration**: Enable/disable new user signups
   - **Content Moderation**: Enable/disable content moderation
   - **Location Tracking**: Enable/disable location features
   - **Push Notifications**: Enable/disable push notifications
   - **Analytics Tracking**: Enable/disable analytics
   - **AI Recommendations**: Enable/disable AI features
   - **Live Comments**: Enable/disable real-time comments
3. User toggles features on/off
4. User clicks "Save Features"
5. Frontend calls update endpoint with features category
6. Backend updates settings
7. Backend may trigger feature flag updates
8. Response returns updated settings
9. Frontend updates UI
10. Show success toast
11. Feature changes take effect immediately (or after cache clear)

**Validations**:
- All toggles: Boolean values
- Critical features: May require confirmation before disabling

**Error States**:
- Save failure: Show error message
- Critical feature disable: Show warning, require confirmation

**Success States**:
- Save successful: Show success toast
- Features updated: UI reflects new states
- Immediate effect: Changes apply to platform

### 3.3 System Settings

**Feature Name**: System Configuration

**Business Description**: Configure system-level settings like maintenance mode, debug mode, and logging.

**Preconditions**:
- Same as Security Settings

**Step-by-Step Flow**:
1. User clicks "System" tab/section
2. Display system settings:
   - **Maintenance Mode**: Toggle (shows maintenance banner to users)
   - **Debug Mode**: Toggle (enables debug logging)
   - **Log Level**: Dropdown ('error', 'warn', 'info', 'debug')
   - **Backup Frequency**: Dropdown ('daily', 'weekly', 'monthly')
   - **Auto Backup**: Toggle
   - **Max File Size**: Number input (MB, default: 10)
3. User modifies settings
4. User clicks "Save System Settings"
5. Frontend validates inputs
6. Backend updates settings
7. Backend may trigger system actions:
   - Maintenance mode: Update global flag
   - Debug mode: Update logging configuration
   - Log level: Update logger settings
8. Response returns updated settings
9. Frontend updates UI
10. Show success toast

**Validations**:
- Log Level: Must be valid enum
- Backup Frequency: Must be valid enum
- Max File Size: Must be positive number

**Error States**:
- Validation errors: Show field-specific errors
- Save failure: Show error message

**Success States**:
- Save successful: Show success toast
- Settings updated: UI reflects new values
- System updated: Changes take effect

### 3.4 Email/SMTP Settings

**Feature Name**: Email Configuration

**Business Description**: Configure email service settings for sending notifications and 2FA codes.

**Preconditions**:
- Same as Security Settings

**Step-by-Step Flow**:
1. User clicks "Email" tab/section
2. Display email settings:
   - **Email Notifications**: Toggle
   - **Email Provider**: Dropdown ('smtp', 'sendgrid', 'ses', etc.)
   - **SMTP Host**: Text input
   - **SMTP Port**: Number input (default: 587)
   - **SMTP User**: Text input (username)
   - **SMTP Password**: Password input (masked)
   - **From Email**: Email input
   - **From Name**: Text input
3. User enters SMTP credentials
4. User clicks "Test Connection" (optional)
5. Backend tests SMTP connection
6. If test successful, show success message
7. User clicks "Save Email Settings"
8. Backend validates email format and SMTP settings
9. Backend updates settings (password encrypted)
10. Response returns updated settings
11. Frontend updates UI
12. Show success toast

**Validations**:
- SMTP Host: Required, valid hostname
- SMTP Port: 1-65535
- From Email: Valid email format
- SMTP Password: Required if provider is SMTP

**Error States**:
- Invalid email: Show "Invalid email format"
- SMTP test failure: Show "SMTP connection failed"
- Save failure: Show error message

**Success States**:
- Save successful: Show success toast
- Settings updated: UI reflects new values
- Email service: Ready to send emails

### 3.5 Storage Settings

**Feature Name**: File Storage Configuration

**Business Description**: Configure file upload limits and allowed file types.

**Preconditions**:
- Same as Security Settings

**Step-by-Step Flow**:
1. User clicks "Storage" tab/section
2. Display storage settings:
   - **Max File Size**: Number input (MB, default: 10)
   - **Allowed File Types**: Multi-select or comma-separated input
     - Images: jpg, jpeg, png, gif, webp
     - Videos: mp4, mov, avi
     - Audio: mp3, wav, m4a
3. User modifies settings
4. User clicks "Save Storage Settings"
5. Frontend validates inputs
6. Backend updates settings
7. Response returns updated settings
8. Frontend updates UI
9. Show success toast

**Validations**:
- Max File Size: Must be positive number
- Allowed File Types: Must be valid file extensions

**Error States**:
- Invalid file type: Show "Invalid file extension"
- Save failure: Show error message

**Success States**:
- Save successful: Show success toast
- Settings updated: UI reflects new values

### 3.6 Privacy Settings

**Feature Name**: Privacy & Compliance Configuration

**Business Description**: Configure data retention, GDPR compliance, and privacy policies.

**Preconditions**:
- Same as Security Settings

**Step-by-Step Flow**:
1. User clicks "Privacy" tab/section
2. Display privacy settings:
   - **Data Retention Days**: Number input (default: 90, range: 30-365)
   - **GDPR Compliance**: Toggle
   - **Share Analytics**: Toggle (share with third parties)
   - **User Data Export**: Toggle (allow users to export data)
   - **User Data Deletion**: Toggle (allow users to delete account)
3. User modifies settings
4. User clicks "Save Privacy Settings"
5. Frontend validates inputs
6. Backend updates settings
7. Response returns updated settings
8. Frontend updates UI
9. Show success toast

**Validations**:
- Data Retention Days: 30-365 days
- All toggles: Boolean values

**Error States**:
- Validation errors: Show field-specific errors
- Save failure: Show error message

**Success States**:
- Save successful: Show success toast
- Settings updated: UI reflects new values

---

## 4. Data Model & API Design

### 4.1 Get Settings Endpoint

**Endpoint**: `GET /api/superadmin/settings`

**Authentication**: Required (JWT token)

**Permissions**: `canManageSettings` or founder

**Response**:
```javascript
{
  success: true,
  settings: {
    security: {
      pinRequired: boolean,
      twoFactorAuth: boolean,      // Always true, immutable
      sessionTimeout: number,      // Minutes
      maxLoginAttempts: number,
      passwordMinLength: number,
      requireEmailVerification: boolean
    },
    features: {
      userRegistration: boolean,
      contentModeration: boolean,
      locationTracking: boolean,
      pushNotifications: boolean,
      analyticsTracking: boolean,
      aiRecommendations: boolean,
      liveComments: boolean
    },
    system: {
      maintenanceMode: boolean,
      debugMode: boolean,
      logLevel: 'error' | 'warn' | 'info' | 'debug',
      backupFrequency: 'daily' | 'weekly' | 'monthly',
      autoBackup: boolean,
      maxFileSize: number           // MB
    },
    api: {
      rateLimitEnabled: boolean,
      rateLimitRequests: number,
      rateLimitWindow: number      // Seconds
    },
    email: {
      emailNotifications: boolean,
      emailProvider: string,
      smtpHost: string,
      smtpPort: number,
      smtpUser: string,
      smtpPassword: string,        // Encrypted
      fromEmail: string,
      fromName: string
    },
    storage: {
      maxFileSize: number,          // MB
      allowedFileTypes: [string]
    },
    privacy: {
      dataRetentionDays: number,
      gdprCompliance: boolean,
      shareAnalytics: boolean
    }
  }
}
```

### 4.2 Update Settings Endpoint

**Endpoint**: `PATCH /api/superadmin/settings`

**Authentication**: Required

**Permissions**: `canManageSettings` or founder

**Request Body**:
```javascript
{
  category: 'security' | 'features' | 'system' | 'api' | 'email' | 'storage' | 'privacy',
  settings: {
    // Category-specific settings object
  }
}
```

**Response**:
```javascript
{
  success: true,
  message: "Settings updated successfully",
  settings: {
    // Updated settings object
  }
}
```

### 4.3 Data Models

**SystemSettings Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  security: {
    pinRequired: boolean,
    twoFactorAuth: boolean,        // Always true
    sessionTimeout: number,
    maxLoginAttempts: number,
    passwordMinLength: number,
    requireEmailVerification: boolean
  },
  features: {
    userRegistration: boolean,
    contentModeration: boolean,
    locationTracking: boolean,
    pushNotifications: boolean,
    analyticsTracking: boolean,
    aiRecommendations: boolean,
    liveComments: boolean
  },
  system: {
    maintenanceMode: boolean,
    debugMode: boolean,
    logLevel: string,
    backupFrequency: string,
    autoBackup: boolean,
    maxFileSize: number
  },
  api: {
    rateLimitEnabled: boolean,
    rateLimitRequests: number,
    rateLimitWindow: number
  },
  email: {
    emailNotifications: boolean,
    emailProvider: string,
    smtpHost: string,
    smtpPort: number,
    smtpUser: string,
    smtpPassword: string,          // Encrypted
    fromEmail: string,
    fromName: string
  },
  storage: {
    maxFileSize: number,
    allowedFileTypes: [string]
  },
  privacy: {
    dataRetentionDays: number,
    gdprCompliance: boolean,
    shareAnalytics: boolean
  },
  updatedAt: Date,
  updatedBy: ObjectId              // Ref: SuperAdmin
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Component State

**Settings Component** (`superAdmin/src/pages/Settings.jsx`):
- `settings`: Complete settings object
- `loading`: Loading state
- `isLoading`: Initial load state
- `hasChanges`: Whether settings have been modified
- `activeSection`: Current tab/section ('security', 'features', etc.)
- `showModal`: Modal visibility
- `modalType`: Type of modal ('confirm', 'test', etc.)

**Side Effects**:
- `useEffect` on mount: Fetch settings from API
- `useEffect` on settings change: Mark as changed
- `useEffect` on section change: Save current section state
- Form validation on input change

### 5.2 Settings Loading

**Initial Load**:
1. Component mounts
2. Call `GET /api/superadmin/settings`
3. Store settings in state
4. Render form with current values

**Settings Update**:
1. User modifies setting
2. Update local state
3. Mark as changed
4. On save, call update endpoint
5. Update state with response
6. Clear changed flag

---

## 6. Backend Logic & Rules

### 6.1 Get Settings Controller

**File**: `backend/src/routes/enhancedSuperAdminRoutes.js`

**Route**: `GET /api/superadmin/settings`

**Business Logic**:
1. Verify authentication and permission (`canManageSettings`)
2. Find or create `SystemSettings` document (singleton)
3. If document doesn't exist, create with defaults
4. Return settings object
5. Mask sensitive fields (passwords) if needed

**Default Values**:
- Security: Session timeout 30 min, max attempts 5, password min 8
- Features: All enabled by default
- System: Maintenance mode off, debug mode off, log level 'info'
- API: Rate limit enabled, 1000 requests per hour
- Email: Provider 'smtp', port 587
- Storage: Max 10MB, common file types
- Privacy: 90 days retention, GDPR enabled

### 6.2 Update Settings Controller

**Route**: `PATCH /api/superadmin/settings`

**Business Logic**:
1. Verify authentication and permission
2. Validate request body (category and settings)
3. Find or create `SystemSettings` document
4. Validate category-specific settings:
   - Security: Validate ranges, immutability of 2FA
   - Features: Validate boolean values
   - System: Validate enums, ranges
   - Email: Validate email format, SMTP settings
   - Storage: Validate file types, size limits
   - Privacy: Validate ranges
5. Update settings category
6. Encrypt sensitive fields (passwords)
7. Set `updatedAt` and `updatedBy`
8. Save document
9. Log setting change in security logs
10. Trigger side effects if needed:
    - Session timeout: Update active sessions
    - Maintenance mode: Update global flag
    - Debug mode: Update logger configuration
11. Return updated settings

**Validation Rules**:
- Session Timeout: 5-60 minutes
- Max Login Attempts: 3-10
- Password Min Length: 6-20
- Log Level: Must be valid enum
- Backup Frequency: Must be valid enum
- SMTP Port: 1-65535
- Data Retention: 30-365 days

### 6.3 Settings Immutability

**Immutable Settings**:
- `security.twoFactorAuth`: Always true, cannot be changed
- Certain critical settings may require founder role

**Protected Settings**:
- Some settings may only be changed by founders
- Changes to critical settings logged with extra detail

---

## 7. superAdmin Dependencies

### 7.1 Permissions

- **View Settings**: `canManageSettings` permission required
- **Update Settings**: `canManageSettings` permission required
- **Critical Settings**: May require founder role

### 7.2 Feature Toggles

- Settings page itself can be toggled (rare)
- Individual feature toggles managed within Settings

### 7.3 Settings Impact

**Immediate Effects**:
- Session timeout: Applied to current session
- Maintenance mode: Shows banner immediately
- Debug mode: Updates logging immediately

**Delayed Effects**:
- Feature toggles: May require cache clear
- Email settings: Applied to next email send
- Storage settings: Applied to next upload

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All endpoints require valid JWT token
- **Permission Check**: `canManageSettings` permission required
- **Founder Override**: Founders have all permissions

### 8.2 Authorization

- **Role-based Access**: Admins and moderators need explicit permission
- **Critical Settings**: Some settings may be founder-only
- **Immutable Settings**: Certain settings cannot be changed

### 8.3 Security Features

- **Audit Logging**: All setting changes logged with admin ID, timestamp, old/new values
- **IP Tracking**: Setting changes tracked by IP address
- **Password Encryption**: SMTP passwords encrypted in database
- **Input Validation**: All inputs sanitized and validated

### 8.4 Privacy Considerations

- **Sensitive Data**: Passwords and API keys encrypted
- **Settings History**: May be logged for audit trail
- **GDPR Compliance**: Settings respect privacy regulations

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Settings View**: `settings_view` event
- **Settings Update**: `settings_update` event with category and changes
- **Settings Test**: `settings_test` event (e.g., SMTP test)

### 9.2 Metrics & KPIs

**Tracked Metrics**:
- Settings change frequency
- Most changed categories
- Settings validation errors
- Critical setting changes

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Session Timeout**: 5-60 minutes
- **Max Login Attempts**: 3-10
- **Password Min Length**: 6-20 characters
- **Data Retention**: 30-365 days
- **Max File Size**: Configurable, typically 1-100 MB

### 10.2 Error Handling

- **Validation Errors**: Show field-specific errors
- **Save Failures**: Show error message, allow retry
- **SMTP Test Failures**: Show connection error details
- **Concurrent Updates**: Last write wins (no conflict resolution)

### 10.3 Known Constraints

- **Settings Singleton**: Only one settings document exists
- **Immutable Settings**: 2FA cannot be disabled
- **Password Visibility**: SMTP passwords shown as masked
- **Cache Invalidation**: Some settings may require cache clear

### 10.4 Performance Considerations

- **Settings Caching**: Settings may be cached for performance
- **Lazy Loading**: Settings loaded on demand
- **Validation**: Client and server-side validation

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Settings History**: View history of setting changes
- **Settings Export/Import**: Export and import settings as JSON
- **Settings Presets**: Save and load setting presets
- **Advanced Validation**: More comprehensive input validation

### 11.2 Next (Medium Priority)

- **Settings Search**: Search within settings
- **Settings Categories**: Organize settings into more categories
- **Settings Templates**: Pre-defined setting templates
- **Settings Rollback**: Rollback to previous setting version

### 11.3 Later (Low Priority)

- **Settings API**: External API for settings management
- **Settings Webhooks**: Webhooks for setting changes
- **Settings Analytics**: Analytics on setting usage
- **Settings Recommendations**: AI-powered setting recommendations

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- Form validation library
- React Hot Toast for notifications

**Key Dependencies**:
- `react-router-dom`: Navigation
- `react-hot-toast`: Toast notifications
- Form validation library

### 12.2 Backend Architecture

**Technology Stack**:
- Node.js with Express
- MongoDB with Mongoose
- Encryption library for passwords

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM
- `bcrypt` or `crypto`: Password encryption

### 12.3 Data Flow

1. User navigates to Settings page
2. Frontend fetches current settings
3. Settings displayed in form
4. User modifies settings
5. User saves settings
6. Frontend validates inputs
7. Backend validates and updates
8. Backend triggers side effects
9. Response returns updated settings
10. Frontend updates UI

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/settings` | Get all settings | Yes |
| PATCH | `/api/superadmin/settings` | Update settings category | Yes |

---

## 14. Related Documentation

- **Authentication**: See `auth-spec.md` for session timeout usage
- **Feature Flags**: See `feature-flags-spec.md` for feature toggle management
- **Dashboard**: See `dashboard-spec.md` for settings impact on dashboard
- **Logs**: See `logs-spec.md` for settings change logs

