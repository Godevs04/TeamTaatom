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

1. Complete remaining menu specifications
2. Add cross-references between related menus
3. Create architecture diagrams
4. Add API endpoint documentation
5. Create user flow diagrams

