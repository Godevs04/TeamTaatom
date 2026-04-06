# SuperAdmin Panel - Product Specifications

This directory contains comprehensive product specification documents for each menu in the SuperAdmin panel. Each document follows a consistent structure covering both business and technical aspects.

## Menu Structure

The SuperAdmin panel consists of the following menus:

### Core Menus

1. **Dashboard** (`dashboard-spec.md`) ✅
   - Overview of platform metrics
   - Real-time analytics
   - AI-powered insights
   - Recent activity

2. **Authentication** (`auth-spec.md`) ✅
   - Login flow with email/password
   - Two-factor authentication (2FA)
   - Session management
   - Auto-logout on inactivity

### Management Menus

3. **Users** (`users-spec.md`) ✅
   - User listing and search
   - User details and editing
   - Bulk actions (activate/deactivate/delete)
   - User filtering and sorting

4. **Travel Content** (`travel-content-spec.md`) ✅
   - Posts and Shorts management
   - Content moderation (activate/deactivate/flag/delete)
   - Content search and filtering
   - Bulk content actions

5. **Songs** (`songs-spec.md`) ✅
   - Music library management
   - Song upload and metadata
   - Song status management
   - Genre filtering

6. **Locales** (`locales-spec.md`) ✅
   - Location/place management
   - Locale CRUD operations
   - Country/state filtering
   - Display order management

### Analytics & Monitoring

7. **Analytics** (`analytics-spec.md`) ✅
   - Time series analytics
   - Event breakdown
   - Top features analysis
   - User retention metrics

8. **TripScore Analytics** (`tripscore-analytics-spec.md`) ✅
   - TripScore statistics
   - Trust level breakdown
   - Geographic analysis (continents, countries, locations)
   - Suspicious visit detection
   - Top users by TripScore

9. **Query Monitor** (`query-monitor-spec.md`) ✅
   - Database query performance monitoring
   - Slow query detection
   - Query statistics and charts
   - Performance optimization insights

### Moderation & Reports

10. **Reports** (`reports-spec.md`) ✅
    - User-reported content management
    - Report status tracking
    - Report resolution workflow
    - Report analytics

11. **Moderators** (`moderators-spec.md`) ✅
    - Moderator account management
    - Permission assignment
    - Moderator activity tracking
    - Role-based access control

12. **Logs** (`logs-spec.md`) ✅
    - Security audit logs
    - Action history
    - Log filtering and search
    - Log export functionality

### Configuration

13. **Feature Flags** (`feature-flags-spec.md`) ✅
    - Feature toggle management
    - Gradual rollouts
    - Target user groups
    - Feature performance tracking

14. **Settings** (`settings-spec.md`) ✅
    - System configuration
    - Security settings
    - Feature toggles
    - Email/SMTP configuration
    - Storage settings

## Documentation Structure

Each specification document follows this structure:

1. **Overview** - High-level description, user personas, collaboration
2. **Screen & Navigation Map** - Frontend routes, entry/exit points, components
3. **Detailed Features & User Flows** - Step-by-step flows, validations, error states
4. **Data Model & API Design** - Endpoints, request/response formats, data models
5. **State Management & Side Effects** - Frontend state, hooks, caching
6. **Backend Logic & Rules** - Controllers, business logic, validations
7. **superAdmin Dependencies** - Feature toggles, permissions, settings impact
8. **Permissions, Privacy & Security** - Auth requirements, role-based access
9. **Analytics & Events** - Tracked events, metrics, KPIs
10. **Edge Cases, Limits & Known Constraints** - Explicit limits, error handling
11. **Future Enhancements** - Roadmap items (Now/Next/Later)
12. **Technical Implementation Details** - Architecture, dependencies, data flow
13. **API Endpoints Summary** - Quick reference table
14. **Related Documentation** - Links to related specs

## File Locations

### Frontend
- Main app: `superAdmin/src/App.jsx`
- Pages: `superAdmin/src/pages/`
- Components: `superAdmin/src/components/`
- Context: `superAdmin/src/context/`
- Services: `superAdmin/src/services/`

### Backend
- Routes: `backend/src/routes/enhancedSuperAdminRoutes.js`
- Controllers: `backend/src/controllers/superAdminController.js`
- Models: `backend/src/models/SuperAdmin.js`

## Common Patterns

### Authentication
All protected routes require:
- Valid JWT token in `Authorization: Bearer <token>` header
- Token verification via `verifySuperAdminToken` middleware
- Permission checks via `checkPermission(permissionName)` middleware

### Real-Time Updates
- WebSocket connection via `socketService`
- Auto-refresh every 30 seconds via `RealTimeContext`
- Manual refresh available on all pages

### Error Handling
- Consistent error codes (e.g., `AUTH_1001`, `SRV_6001`)
- Toast notifications via `react-hot-toast`
- Error boundaries for React component errors

### Permissions
- **Founder**: Full access to all menus
- **Admin**: Access based on `permissions` object
- **Moderator**: Limited access based on assigned permissions

## SuperAdmin routes & permissions (codebase, April 2026)

The React app registers routes in `superAdmin/src/App.jsx`. Sidebar links and permission gates are defined in `superAdmin/src/components/Sidebar.jsx` (**founder** sees all items; others need `user.permissions[permission]` when set).

| Path | Page component | Typical permission (`Sidebar.jsx`) |
|------|----------------|----------------------------------|
| `/login` | `Login.jsx` | Public |
| `/dashboard` | `Dashboard.jsx` | All authenticated |
| `/analytics` | `Analytics.jsx` | All authenticated |
| `/tripscore-analytics` | `TripScoreAnalytics.jsx` | `canViewAnalytics` |
| `/query-monitor` | `QueryMonitor.jsx` | All authenticated |
| `/users` | `Users.jsx` | `canManageUsers` |
| `/travel-content` | `TravelContent.jsx` | `canManageContent` |
| `/songs` | `Songs.jsx` | `canManageContent` |
| `/locales` | `Locales.jsx` | `canManageContent` |
| `/reports` | `Reports.jsx` | `canManageReports` |
| `/support-inbox` | `SupportInbox.jsx` | `canViewAnalytics` |
| `/moderators` | `Moderators.jsx` | `canManageModerators` |
| `/logs` | `Logs.jsx` | `canViewLogs` |
| `/feature-flags` | `FeatureFlags.jsx` | `canManageSettings` |
| `/settings` | `Settings.jsx` | `canManageSettings` |
| `/system` | `System.jsx` | `canManageSettings` |
| `/profile` | `Profile.jsx` | Authenticated (admin profile; not listed as a sidebar primary nav item) |
| `/test` | `TestPage.jsx` | **Development only** (`import.meta.env.DEV`); production navigations to `/test` redirect to `/dashboard` |

**Scheduled downtime UI**: A full-page `ScheduledDowntime.jsx` exists under `superAdmin/src/pages/`, but it is **not** currently given its own route in `App.jsx`. The live scheduling experience is embedded in `superAdmin/src/components/FeatureFlags.jsx` and uses the SuperAdmin API (e.g. `/api/v1/superadmin/scheduled-downtimes`). Prefer documenting maintenance windows against that path unless you add an explicit route.

**Shared mobile/web API (Express v1)** — reference for cross-team testing: `backend/src/routes/v1/index.js` mounts (non-exhaustive) `auth`, `posts`, `profile`, `chat`, `shorts`, `settings`, `notifications`, `analytics`, `feature-flags`, `hashtags`, `collections`, `mentions`, `search`, `activity`, `reports`, `users`, `user`, `locales`, etc., under `/api/v1/…`.

---

## Status

- ✅ Completed: All 14 menu specifications
  - Dashboard
  - Authentication
  - Users
  - Travel Content
  - Songs
  - Locales
  - Analytics
  - TripScore Analytics
  - Query Monitor
  - Reports
  - Moderators
  - Logs
  - Feature Flags
  - Settings

## Next Steps

1. Add standalone specs or routes for **System** and **Support Inbox** if you want the same depth as other menus (behavior is already in code).
2. Resolve **ScheduledDowntime** page vs **Feature Flags** embed: either register `/scheduled-downtime` or delete the orphan page file to avoid drift.
3. Add architecture diagrams and user-flow diagrams where helpful.
4. Keep this README’s route table in sync when adding `App.jsx` routes or changing sidebar permissions.

