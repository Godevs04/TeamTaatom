# Dashboard Menu - Product Specification

## 1. Overview

The Dashboard menu serves as the central command center for SuperAdmin users, providing a real-time overview of platform health, key metrics, recent activity, and AI-powered insights. It functions as the landing page after login and provides quick access to critical information and actions.

### User Personas & Goals

- **Founders**: Get high-level overview of platform performance, user growth, and critical alerts
- **Admins**: Monitor daily operations, track KPIs, identify issues requiring attention
- **Moderators**: View recent activity, understand content trends, see flagged items

### Frontend-Backend Collaboration

- **Frontend** (`superAdmin/src/pages/Dashboard.jsx`): Renders dashboard UI with tabs (Overview, Analytics, AI Insights), displays real-time metrics, handles auto-refresh
- **Backend** (`backend/src/routes/enhancedSuperAdminRoutes.js`): Serves dashboard overview data via `GET /api/superadmin/dashboard/overview`
- **Real-time Context** (`superAdmin/src/context/RealTimeContext.jsx`): Manages auto-refresh every 30 seconds, WebSocket connections for live updates

---

## 2. Screen & Navigation Map (Frontend)

### Main Screen

**File**: `superAdmin/src/pages/Dashboard.jsx`

**Purpose**: Central dashboard displaying platform metrics, recent activity, and AI insights

**Entry Points**:
- After successful login (redirect from `/login`)
- Navigation from sidebar (Dashboard menu item)
- Direct URL: `/dashboard`
- Root path `/` redirects to `/dashboard`

**Exit Points**:
- Click any sidebar menu item → Navigate to respective page
- Click "View All" on recent activity → Navigate to detailed pages (Users, Posts, etc.)
- Click user avatar → Navigate to Profile page

**Components Used**:
- `AIInsights` (`superAdmin/src/components/AIInsights.jsx`): AI-powered recommendations and alerts
- `RealTimeAnalytics` (`superAdmin/src/components/RealTimeAnalytics.jsx`): Real-time charts and metrics
- `StatCard` (`superAdmin/src/components/Cards/StatCard.jsx`): Metric display cards
- `Layout` (`superAdmin/src/components/Layout.jsx`): Main layout wrapper with sidebar and topbar

**Tabs**:
- **Overview Tab**: Key metrics cards, recent users, recent posts, activity summary
- **Analytics Tab**: Real-time charts (user registrations, post creations, engagement trends)
- **AI Insights Tab**: AI-powered recommendations, VIP user detection, inactive user alerts

---

## 3. Detailed Features & User Flows

### 3.1 Dashboard Overview Tab

**Feature Name**: Overview Dashboard

**Business Description**: Displays key platform metrics in card format, recent user registrations, recent post creations, and activity summary.

**Preconditions**:
- User must be authenticated (SuperAdmin token required)
- User must have appropriate permissions (all roles can view dashboard)

**Step-by-Step Flow**:
1. User logs in and is redirected to `/dashboard`
2. Frontend calls `fetchDashboardData()` from `RealTimeContext`
3. Backend endpoint `GET /api/superadmin/dashboard/overview` is called
4. Backend aggregates data from multiple collections:
   - Total users count from `User` model
   - Active users (logged in last 30 days)
   - Total posts count from `Post` model
   - Total shorts count (posts with `type: 'short'`)
   - Recent users (last 10, sorted by `createdAt`)
   - Recent posts (last 10, sorted by `createdAt`)
   - User growth (weekly percentage change)
   - Content growth (weekly percentage change)
5. Response is cached in `RealTimeContext` state
6. UI renders metric cards with icons, values, and trend indicators
7. Recent activity lists are displayed below cards
8. Auto-refresh triggers every 30 seconds to update data

**Validations**:
- Authentication token must be valid
- User must have active account (`isActive: true`)
- All data aggregations use MongoDB aggregation pipelines

**Error States**:
- Network error: Show error toast, keep previous data visible
- 401 Unauthorized: Redirect to login page
- 500 Server Error: Show error message, allow manual refresh

**Success States**:
- Data loads successfully: Display all metrics and activity
- Auto-refresh: Silently update data without page reload
- Last update timestamp shown in header

**Empty States**:
- No users: Show "0" in Total Users card
- No posts: Show "0" in Total Posts card
- No recent activity: Show "No recent activity" message

### 3.2 Analytics Tab

**Feature Name**: Real-Time Analytics

**Business Description**: Displays interactive charts showing user registrations, post creations, and engagement metrics over time.

**Preconditions**:
- Same as Overview tab

**Step-by-Step Flow**:
1. User clicks "Analytics" tab
2. `RealTimeAnalytics` component mounts
3. Calls `fetchAnalyticsData(period)` from `RealTimeContext`
4. Backend endpoint `GET /api/superadmin/analytics/realtime?period=24h` is called
5. Backend queries analytics events from database
6. Data is aggregated by time intervals (hourly for 24h, daily for 7d/30d)
7. Charts render using charting library (Recharts or similar)
8. User can switch period: 24h, 7d, 30d
9. Charts auto-update every 30 seconds

**Validations**:
- Period must be one of: `24h`, `7d`, `30d`
- Data must be valid time series format

**Error States**:
- Chart load failure: Show error message, allow retry
- No data for period: Show "No data available" message

**Success States**:
- Charts render with smooth animations
- Period selector updates chart data
- Real-time updates visible in chart

### 3.3 AI Insights Tab

**Feature Name**: AI-Powered Insights

**Business Description**: Provides intelligent recommendations, identifies top-performing regions, detects VIP users, and alerts about inactive users.

**Preconditions**:
- Same as Overview tab

**Step-by-Step Flow**:
1. User clicks "AI Insights" tab
2. `AIInsights` component mounts
3. Backend processes insights (may be pre-computed or real-time)
4. Insights include:
   - **Top Performing Regions**: Locations with highest engagement
   - **VIP User Detection**: Users with high activity and engagement scores
   - **Inactive User Alerts**: Users who haven't logged in for extended period
   - **Smart Recommendations**: Suggestions for improving engagement
5. Insights are displayed in card format with actionable items
6. User can click insights to navigate to detailed views

**Validations**:
- Insights data must be valid JSON structure
- Each insight must have title, description, and optional action

**Error States**:
- Insights load failure: Show error message
- No insights available: Show "No insights at this time" message

**Success States**:
- Insights display with icons and descriptions
- Clickable insights navigate to relevant pages
- Insights refresh with dashboard data

---

## 4. Data Model & API Design

### 4.1 Dashboard Overview Endpoint

**Endpoint**: `GET /api/superadmin/dashboard/overview`

**Authentication**: Required (Bearer token in Authorization header)

**Permissions**: All authenticated SuperAdmin users

**Request**:
```javascript
// No request body or query params
Headers: {
  Authorization: "Bearer <token>"
}
```

**Response**:
```javascript
{
  success: true,
  metrics: {
    totalUsers: number,
    activeUsers: number,
    totalPosts: number,
    totalShorts: number,
    userGrowth: {
      weeklyGrowth: number,  // Percentage
      monthlyGrowth: number
    },
    contentGrowth: {
      weeklyGrowth: number,
      monthlyGrowth: number
    }
  },
  recentActivity: {
    users: Array<{
      _id: string,
      fullName: string,
      email: string,
      createdAt: Date,
      avatar?: string
    }>,
    posts: Array<{
      _id: string,
      caption: string,
      imageUrl?: string,
      videoUrl?: string,
      type: 'photo' | 'short',
      createdAt: Date,
      user: {
        _id: string,
        fullName: string
      }
    }>
  },
  aiInsights: {
    topRegions: Array<{
      location: string,
      engagement: number,
      userCount: number
    }>,
    vipUsers: Array<{
      userId: string,
      fullName: string,
      activityScore: number
    }>,
    inactiveUsers: {
      count: number,
      threshold: number  // Days since last login
    },
    recommendations: Array<{
      type: string,
      title: string,
      description: string,
      priority: 'high' | 'medium' | 'low'
    }>
  }
}
```

### 4.2 Real-Time Analytics Endpoint

**Endpoint**: `GET /api/superadmin/analytics/realtime`

**Authentication**: Required

**Query Parameters**:
- `period` (optional): `24h` | `7d` | `30d` (default: `24h`)

**Response**:
```javascript
{
  success: true,
  timeSeries: Array<{
    timestamp: Date,
    userRegistrations: number,
    postCreations: number,
    engagement: number
  }>,
  summary: {
    totalEvents: number,
    averagePerHour: number,
    peakHour: Date
  }
}
```

### 4.3 Data Models

**User Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  fullName: string,
  email: string,
  createdAt: Date,
  lastLogin: Date,
  isVerified: boolean,
  avatar?: string
}
```

**Post Model** (MongoDB):
```javascript
{
  _id: ObjectId,
  caption: string,
  imageUrl?: string,
  videoUrl?: string,
  type: 'photo' | 'short',
  createdAt: Date,
  user: ObjectId (ref: User),
  isActive: boolean
}
```

---

## 5. State Management & Side Effects (Frontend)

### 5.1 Real-Time Context

**File**: `superAdmin/src/context/RealTimeContext.jsx`

**Purpose**: Centralized state management for real-time dashboard data

**State Variables**:
- `dashboardData`: Cached dashboard overview data
- `lastUpdate`: Timestamp of last successful data fetch
- `isConnected`: WebSocket connection status

**Key Functions**:
- `fetchDashboardData(signal)`: Fetches dashboard overview, handles AbortController for cancellation
- Auto-refresh interval: 30 seconds (`REFRESH_INTERVAL = 30000`)
- WebSocket integration: Listens for real-time updates from backend

**Side Effects**:
- `useEffect` in `Dashboard.jsx` calls `fetchDashboardData()` on mount
- Auto-refresh timer updates data every 30 seconds
- WebSocket events trigger immediate data refresh
- AbortController cancels in-flight requests on unmount

### 5.2 Component State

**Dashboard Component** (`superAdmin/src/pages/Dashboard.jsx`):
- `activeTab`: Current tab ('overview', 'analytics', 'insights')
- Local state for tab switching
- Uses `useRealTime()` hook to access shared context

**Caching Strategy**:
- Dashboard data cached in `RealTimeContext` for 30 seconds
- Components read from cache, refresh in background
- Prevents unnecessary API calls during rapid navigation

---

## 6. Backend Logic & Rules

### 6.1 Dashboard Overview Controller

**File**: `backend/src/routes/enhancedSuperAdminRoutes.js`

**Route Handler**: `GET /api/superadmin/dashboard/overview`

**Business Logic**:
1. Verify authentication token
2. Aggregate total users count: `User.countDocuments({})`
3. Calculate active users: `User.countDocuments({ lastLogin: { $gte: 30 days ago } })`
4. Count total posts: `Post.countDocuments({ type: 'photo', isActive: true })`
5. Count total shorts: `Post.countDocuments({ type: 'short', isActive: true })`
6. Calculate growth percentages:
   - Weekly: Compare current week to previous week
   - Monthly: Compare current month to previous month
7. Fetch recent users: `User.find().sort({ createdAt: -1 }).limit(10)`
8. Fetch recent posts: `Post.find().populate('user').sort({ createdAt: -1 }).limit(10)`
9. Generate AI insights (may be cached or computed on-demand)
10. Return aggregated response

**Performance Optimizations**:
- Use MongoDB aggregation pipelines for efficient counting
- Cache AI insights for 5 minutes
- Parallel queries using `Promise.all()` where possible

### 6.2 Real-Time Analytics Controller

**Route Handler**: `GET /api/superadmin/analytics/realtime`

**Business Logic**:
1. Parse period parameter (24h, 7d, 30d)
2. Calculate date range based on period
3. Query analytics events from database (or analytics service)
4. Group events by time intervals:
   - 24h: Group by hour
   - 7d: Group by day
   - 30d: Group by day
5. Aggregate metrics per interval:
   - User registrations count
   - Post creations count
   - Engagement score (likes + comments)
6. Return time series data

**Data Source**:
- May query from analytics events collection
- Or aggregate from User/Post models with date filters

---

## 7. superAdmin Dependencies

### 7.1 Feature Toggles

- **Real-time Updates**: Can be toggled via Feature Flags
- **AI Insights**: Can be enabled/disabled in Settings
- **Auto-refresh Interval**: Configurable in Settings (default: 30 seconds)

### 7.2 Permissions

- **View Dashboard**: All authenticated SuperAdmin users (no specific permission required)
- **View Analytics**: All authenticated users
- **View AI Insights**: All authenticated users

### 7.3 Settings Impact

- **Session Timeout**: Affects auto-logout from dashboard
- **Maintenance Mode**: May show maintenance banner on dashboard
- **Debug Mode**: Enables additional debug information in dashboard

---

## 8. Permissions, Privacy & Security

### 8.1 Authentication

- **Required**: All dashboard endpoints require valid JWT token
- **Token Verification**: Backend verifies token on every request
- **Auto-logout**: Session expires after configured timeout (default: 15 minutes inactivity)

### 8.2 Authorization

- **Role-based Access**: All SuperAdmin roles (founder, admin, moderator) can access dashboard
- **No Permission Checks**: Dashboard is accessible to all authenticated SuperAdmin users
- **Data Filtering**: All users see same aggregated data (no user-specific filtering)

### 8.3 Security Features

- **CSRF Protection**: State-changing requests require CSRF token
- **Rate Limiting**: API requests are rate-limited (1000 requests per hour per user)
- **Audit Logging**: All dashboard access is logged in security logs
- **IP Tracking**: Login attempts and access tracked by IP address

---

## 9. Analytics & Events

### 9.1 Tracked Events

- **Dashboard View**: `dashboard_view` event fired on page load
- **Tab Switch**: `dashboard_tab_switch` event with tab name
- **Metric Click**: `dashboard_metric_click` event with metric name
- **Insight Action**: `dashboard_insight_action` event when user clicks insight

### 9.2 Metrics & KPIs

**Displayed Metrics**:
- Total Users (with growth %)
- Active Users (last 30 days)
- Total Posts (with growth %)
- Total Shorts (with growth %)

**Calculated KPIs**:
- User Growth Rate (weekly, monthly)
- Content Growth Rate (weekly, monthly)
- Engagement Rate (if available)
- Platform Health Score (if implemented)

---

## 10. Edge Cases, Limits & Known Constraints

### 10.1 Explicit Limits

- **Recent Activity**: Limited to 10 users and 10 posts
- **Auto-refresh Interval**: Minimum 10 seconds, maximum 5 minutes
- **Chart Data Points**: Maximum 1000 points per chart (prevents performance issues)
- **AI Insights**: Maximum 10 insights displayed at once

### 10.2 Error Handling

- **Network Failures**: Retry up to 3 times with exponential backoff
- **Partial Data**: Display available data, show warning for missing metrics
- **Slow Queries**: Timeout after 10 seconds, show cached data if available
- **WebSocket Disconnection**: Fall back to polling, show connection status

### 10.3 Known Constraints

- **Real-time Updates**: WebSocket may not work behind certain firewalls
- **Large Datasets**: Aggregations may be slow with millions of users/posts
- **AI Insights**: Computed on-demand, may take 2-5 seconds to generate
- **Browser Compatibility**: Requires modern browser with WebSocket support
- **Mobile View**: Dashboard optimized for desktop, mobile view is limited

### 10.4 Performance Considerations

- **Caching**: Dashboard data cached for 30 seconds to reduce load
- **Lazy Loading**: Charts and insights load only when tab is active
- **Debouncing**: Tab switches debounced to prevent rapid API calls
- **Pagination**: Recent activity limited to prevent large payloads

---

## 11. Future Enhancements

### 11.1 Now (High Priority)

- **Customizable Widgets**: Allow users to rearrange metric cards
- **Date Range Picker**: Custom date ranges for analytics
- **Export Dashboard**: Export dashboard data as PDF/CSV
- **Dashboard Presets**: Save and load dashboard configurations

### 11.2 Next (Medium Priority)

- **Real-time Notifications**: Push notifications for critical alerts
- **Comparison Mode**: Compare metrics across different time periods
- **Drill-down**: Click metrics to see detailed breakdowns
- **Custom Alerts**: Set up alerts for metric thresholds

### 11.3 Later (Low Priority)

- **Multi-dashboard Support**: Create multiple dashboard views
- **Widget Marketplace**: Third-party widgets/plugins
- **AI Predictions**: Forecast future metrics using ML
- **Collaborative Dashboards**: Share dashboards with team members

---

## 12. Technical Implementation Details

### 12.1 Frontend Architecture

**Technology Stack**:
- React 18+ with hooks
- React Router for navigation
- Framer Motion for animations
- Recharts (or similar) for charts
- React Hot Toast for notifications

**Key Dependencies**:
- `react-router-dom`: Navigation
- `framer-motion`: Animations
- `recharts`: Chart rendering
- `react-hot-toast`: Toast notifications
- `date-fns`: Date formatting

### 12.2 Backend Architecture

**Technology Stack**:
- Node.js with Express
- MongoDB with Mongoose
- JWT for authentication
- WebSocket (Socket.io) for real-time updates

**Key Dependencies**:
- `express`: Web framework
- `mongoose`: MongoDB ODM
- `jsonwebtoken`: JWT handling
- `socket.io`: WebSocket server

### 12.3 Data Flow

1. User opens dashboard
2. Frontend checks for cached data in `RealTimeContext`
3. If cache expired or missing, fetch from API
4. Backend aggregates data from MongoDB
5. Response cached in context for 30 seconds
6. UI renders with data
7. Auto-refresh timer triggers every 30 seconds
8. WebSocket events trigger immediate refresh if connected

---

## 13. API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/superadmin/dashboard/overview` | Get dashboard overview data | Yes |
| GET | `/api/superadmin/analytics/realtime` | Get real-time analytics | Yes |
| GET | `/api/superadmin/verify` | Verify authentication token | Yes |

---

## 14. Related Documentation

- **Authentication**: See `auth-spec.md` for login flow
- **Analytics**: See `analytics-spec.md` for detailed analytics features
- **Users**: See `users-spec.md` for user management
- **Settings**: See `settings-spec.md` for configuration options

