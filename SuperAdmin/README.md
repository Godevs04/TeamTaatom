# TeamTaatom SuperAdmin Dashboard

A comprehensive admin dashboard for managing the TeamTaatom travel platform.

## 🚀 Features

- **Dashboard Overview**: Real-time metrics and platform health monitoring
- **User Management**: Manage travelers, moderators, and user permissions
- **Travel Content**: Review and moderate travel posts, photos, and videos
- **Reports System**: Handle flagged content and abuse reports
- **Analytics**: Comprehensive charts and insights for platform growth
- **Moderator Management**: Assign and manage admin roles
- **System Logs**: Monitor system events and security logs
- **Settings**: Founder-level control over platform features and security

## 🛠️ Tech Stack

- **React 18** - Modern React with hooks
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **ShadCN UI** - Beautiful, accessible components
- **React Router DOM** - Client-side routing
- **React Query** - Data fetching and caching
- **Recharts** - Data visualization
- **Axios** - HTTP client
- **Lucide React** - Beautiful icons

## 📦 Installation

1. **Navigate to the SuperAdmin directory:**
   ```bash
   cd SuperAdmin
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:5001`

## 🔧 Configuration

### Environment Variables

The `.env` file is already created with the correct configuration:

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=TeamTaatom SuperAdmin
VITE_APP_VERSION=1.0.0
VITE_DEV_MODE=true
VITE_DEBUG_MODE=false
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_REAL_TIME_LOGS=true
VITE_ENABLE_EXPORT_FEATURES=true
```

You can modify these values as needed for your environment.

### Backend Integration

The dashboard connects to the existing TeamTaatom backend via REST APIs:

- **Base URL**: `http://localhost:3000` (configurable)
- **Authentication**: JWT tokens with founder role
- **API Endpoints**: `/api/founder/*` namespace

## 🔐 Authentication

### First-Time Setup
1. Access the login page
2. Set up your founder PIN (twice for confirmation)
3. PIN is encrypted and stored securely

### Regular Login
1. Enter your founder PIN
2. JWT token is generated and stored
3. Automatic token refresh and validation

### Security Features
- PIN-based authentication
- JWT token management
- Session timeout
- Failed attempt tracking
- Secure token storage

## 📱 Pages Overview

### Dashboard
- Platform overview metrics
- User growth charts
- Recent activity feed
- Quick action buttons
- System health indicators

### Users
- User management table
- Search and filtering
- User actions (view, edit, ban/unban)
- Bulk operations
- User statistics

### Travel Content
- Content grid view
- Content moderation tools
- Flagged content review
- Content analytics
- Bulk content actions

### Reports
- Flagged content reports
- Abuse and spam reports
- Report resolution workflow
- Moderator assignment
- Report statistics

### Analytics
- User growth charts
- Engagement metrics
- Content performance
- Geographic distribution
- Device analytics
- Retention analysis

### Moderators
- Moderator management
- Role assignment
- Permission management
- Activity tracking
- Performance metrics

### Logs
- System event logs
- Security logs
- User action logs
- Real-time log streaming
- Log filtering and search

### Settings
- Security settings
- Feature toggles
- System configuration
- API settings
- Email configuration
- Danger zone operations

## 🎨 UI Components

### Reusable Components
- **Cards**: StatCard, Card with header/content/footer
- **Tables**: Sortable, filterable data tables
- **Charts**: Line, Area, Bar, Pie charts with Recharts
- **Modals**: Confirmation dialogs and forms
- **Forms**: Input fields, toggles, selects

### Design System
- **Colors**: Consistent color palette with accent colors
- **Typography**: Inter font family
- **Spacing**: Consistent spacing scale
- **Responsive**: Mobile-first responsive design

## 🔌 API Integration

### Data Fetching
- React Query for caching and synchronization
- Automatic retry on failure
- Optimistic updates
- Background refetching

### Error Handling
- Global error boundaries
- API error handling
- User-friendly error messages
- Retry mechanisms

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Environment Setup
- Configure production API URL
- Set up proper CORS settings
- Configure authentication endpoints
- Set up monitoring and logging

## 🔧 Development

### Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── Cards/          # Card components
│   ├── Charts/         # Chart components
│   ├── Tables/         # Table components
│   └── Modals/         # Modal components
├── pages/              # Page components
├── context/            # React context providers
├── hooks/              # Custom React hooks
├── services/           # API services
├── utils/              # Utility functions
└── App.jsx             # Main app component
```

### Adding New Features
1. Create new page component
2. Add route to App.jsx
3. Create necessary API hooks
4. Add navigation to Sidebar
5. Implement required components

### Styling Guidelines
- Use Tailwind CSS classes
- Follow component composition patterns
- Maintain consistent spacing and colors
- Use semantic HTML elements

## 📊 Monitoring

### Performance
- Bundle size optimization
- Lazy loading for routes
- Image optimization
- Caching strategies

### Analytics
- User interaction tracking
- Performance metrics
- Error monitoring
- Usage analytics

## 🤝 Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Write meaningful commit messages
4. Test all new features
5. Update documentation

## 📄 License

This project is part of the TeamTaatom platform and follows the same licensing terms.

---

**Built with ❤️ for TeamTaatom**
