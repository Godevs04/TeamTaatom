# TeamTaatom SuperAdmin Security Setup

This document explains how to set up and use the secure SuperAdmin authentication system for the TeamTaatom Founder Dashboard.

## 🔐 Security Features

- **Email/Password Authentication**: Secure login with email and strong password requirements
- **Separate Database Collection**: SuperAdmin credentials stored in dedicated MongoDB collection
- **JWT Token Authentication**: Secure token-based session management
- **Account Lockout Protection**: Automatic lockout after failed login attempts
- **Security Logging**: Comprehensive audit trail of all security events
- **Encrypted Credentials**: Passwords hashed with bcrypt (12 rounds)
- **Role-Based Permissions**: Granular permission system for different access levels

## 🚀 Quick Setup

### 1. Run the Security Setup Script

```bash
cd SuperAdmin
./setup_superadmin.sh
```

This script will:
- Prompt for SuperAdmin email and password
- Validate password strength (8+ chars, uppercase, lowercase, number, special char)
- Encrypt and store credentials securely
- Generate API keys for backend integration
- Create backup files for security

### 2. Backend Setup

The script creates a `backend.env` file with the necessary configuration. Copy this to your backend directory:

```bash
cp .security/backend.env ../backend/.env.superadmin
```

### 3. Install Required Dependencies

Make sure your backend has the required packages:

```bash
cd ../backend
npm install bcryptjs jsonwebtoken
```

### 4. Environment Variables

Add these to your backend `.env` file:

```env
# SuperAdmin Configuration
JWT_SECRET=your_super_secret_jwt_key_here
SUPERADMIN_URL=http://localhost:5001
```

## 📁 File Structure

```
SuperAdmin/
├── setup_superadmin.sh          # Security setup script
├── .security/                   # Secure credentials storage
│   ├── superadmin_credentials.env
│   ├── backend.env
│   └── backup_*.env
└── src/
    ├── pages/Login.jsx          # Updated login page
    └── context/AuthContext.jsx  # Updated auth context

backend/
├── src/
│   ├── models/SuperAdmin.js     # SuperAdmin database model
│   ├── controllers/superAdminController.js
│   └── routes/superAdminRoutes.js
└── .env.superadmin             # Backend configuration
```

## 🔑 API Endpoints

### Public Endpoints
- `POST /api/founder/login` - SuperAdmin login
- `POST /api/founder/create` - Create SuperAdmin (setup only)

### Protected Endpoints (require authentication)
- `GET /api/founder/verify` - Verify token
- `GET /api/founder/overview` - Dashboard overview data
- `GET /api/founder/users` - User management
- `GET /api/founder/travel-content` - Content management
- `GET /api/founder/reports` - Reports management
- `GET /api/founder/analytics` - Analytics data
- `GET /api/founder/security-logs` - Security audit logs
- `PATCH /api/founder/change-password` - Change password
- `PATCH /api/founder/profile` - Update profile
- `POST /api/founder/logout` - Logout

## 🛡️ Security Features Explained

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Account Lockout
- Maximum 5 failed login attempts
- 15-minute lockout period
- Automatic unlock after timeout
- All attempts logged with IP and timestamp

### Security Logging
All security events are logged including:
- Login attempts (successful and failed)
- Password changes
- Profile updates
- Account lockouts
- Logout events

### Token Security
- JWT tokens with 24-hour expiration
- Secure signing with secret key
- Token verification on each request
- Automatic token refresh capability

## 🔧 Usage

### Frontend Login
1. Navigate to `http://localhost:5001`
2. Enter your SuperAdmin email and password
3. Click "Sign In"
4. You'll be redirected to the dashboard

### Backend Integration
The SuperAdmin system integrates with your existing backend:
- Uses the same MongoDB database
- Separate collection for SuperAdmin data
- Shared models for users, posts, etc.
- Dedicated API endpoints under `/api/founder/`

### Security Monitoring
- Check security logs regularly
- Monitor failed login attempts
- Review account access patterns
- Set up alerts for suspicious activity

## 🚨 Security Best Practices

1. **Regular Password Updates**: Change passwords every 90 days
2. **Monitor Logs**: Review security logs weekly
3. **Backup Credentials**: Keep backup files in secure location
4. **Network Security**: Use HTTPS in production
5. **Access Control**: Limit SuperAdmin account creation
6. **Audit Trail**: Maintain comprehensive audit logs

## 🔄 Password Reset

If you need to reset your SuperAdmin password:

1. Run the setup script again: `./setup_superadmin.sh`
2. Choose to update existing credentials
3. Enter new password (must meet strength requirements)
4. Update backend configuration if needed

## 📞 Support

For security-related issues:
1. Check security logs first
2. Verify credentials are correct
3. Ensure backend is running and accessible
4. Check network connectivity
5. Review error messages in browser console

## 🔒 Production Deployment

For production deployment:

1. **Use Strong JWT Secret**: Generate a secure random JWT secret
2. **Enable HTTPS**: Always use HTTPS in production
3. **Database Security**: Use MongoDB authentication
4. **Network Security**: Restrict access to SuperAdmin endpoints
5. **Monitoring**: Set up comprehensive monitoring and alerting
6. **Backup Strategy**: Implement regular database backups
7. **Access Logs**: Monitor and analyze access patterns

---

**⚠️ Important**: Keep your SuperAdmin credentials secure and never share them. The security of your entire platform depends on these credentials.
