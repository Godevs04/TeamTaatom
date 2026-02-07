# Taatom Backend API

Express.js backend for the Taatom mobile app - a photo sharing platform with location features.

## 🚀 Features

- **User Authentication**: JWT-based auth with OTP email verification
- **Photo Sharing**: Upload photos with captions and location data
- **Real-time Feed**: Get posts with pagination and real-time updates
- **Social Features**: Like posts, comment, follow/unfollow users
- **Profile Management**: User profiles with stats and location mapping
- **Image Storage**: Cloudinary integration for image uploads
- **Email Service**: Nodemailer for OTP and welcome emails
- **Security**: Helmet, CORS, rate limiting, input validation

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB Atlas account
- Cloudinary account
- Gmail account with App Password

## 🛠️ Installation

1. **Clone and navigate to backend:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment setup:**
   ```bash
   cp env.example .env
   # Edit .env with your actual values
   ```

4. **Environment variables:**
   ```env
   PORT=5000
   MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   FRONTEND_URL=http://localhost:8081
   SUPERADMIN_URL=http://localhost:5001
   ```
   **Production:** Set `FRONTEND_URL` and `SUPERADMIN_URL` to your deployed origins; otherwise CORS will block web clients. For multiple instances, consider `REDIS_URL` (or `RATE_LIMIT_REDIS_URL`) for shared rate limiting.

5. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📡 API Endpoints

### Authentication
```
POST   /auth/signup       - Register new user
POST   /auth/verify-otp   - Verify OTP after signup
POST   /auth/resend-otp   - Resend OTP
POST   /auth/signin       - User login
GET    /auth/me           - Get current user (Protected)
```

### Posts
```
GET    /posts             - Get all posts (paginated)
POST   /posts             - Create new post (Protected)
GET    /posts/user/:id    - Get user's posts
POST   /posts/:id/like    - Like/unlike post (Protected)
POST   /posts/:id/comments    - Add comment (Protected)
DELETE /posts/:id/comments/:commentId - Delete comment (Protected)
DELETE /posts/:id          - Delete post (Protected)
```

### Profile
```
GET    /profile/search    - Search users
GET    /profile/:id       - Get user profile
PUT    /profile/:id       - Update profile (Protected)
POST   /profile/:id/follow - Follow/unfollow user (Protected)
```

### Health Check
```
GET    /health            - API health status
```

## 🔒 Dependency and security

- Run `npm audit` regularly and fix critical/high issues; pin major versions where appropriate.
- **npm audit:** If `npm audit fix` fails with EACCES, fix cache ownership (see [AUDIT.md](./AUDIT.md)). That doc also lists overrides for transitive vulns and unfixable (e.g. Brevo/request) accepted risks.
- See `src/jobs/README.md` for background job queue names and failure handling when Redis is enabled.

## 📊 Database Schema

### Users Collection
```javascript
{
  fullName: String,
  email: String (unique),
  password: String (hashed),
  profilePic: String,
  followers: [ObjectId],
  following: [ObjectId],
  totalLikes: Number,
  isVerified: Boolean,
  otp: String,
  otpExpires: Date,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Posts Collection
```javascript
{
  user: ObjectId (ref: User),
  caption: String,
  imageUrl: String,
  cloudinaryPublicId: String,
  location: {
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  likes: [ObjectId (ref: User)],
  comments: [{
    user: ObjectId (ref: User),
    text: String,
    createdAt: Date
  }],
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 🔐 Authentication Flow

1. **Signup**: User registers with email/password
2. **OTP Verification**: 6-digit OTP sent to email
3. **Account Activation**: OTP verification activates account
4. **Login**: Returns JWT token for authenticated requests
5. **Protected Routes**: Include `Authorization: Bearer <token>` header

## 📤 File Upload

### Post Images
- **Endpoint**: `POST /posts`
- **Field**: `image` (multipart/form-data)
- **Limits**: 10MB max size
- **Formats**: jpg, jpeg, png, gif, webp
- **Storage**: Cloudinary with auto-optimization

### Profile Pictures
- **Endpoint**: `PUT /profile/:id`
- **Field**: `profilePic` (multipart/form-data)  
- **Limits**: 5MB max size
- **Processing**: Auto-cropped to 400x400px

## 🛡️ Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin protection
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: express-validator for all inputs
- **Password Hashing**: bcryptjs with salt rounds
- **JWT Tokens**: 30-day expiration
- **Image Validation**: File type and size checks

## 📧 Email Templates

- **OTP Verification**: Professional HTML template with security warnings
- **Welcome Email**: Feature overview and getting started guide
- **Responsive Design**: Looks great on all email clients

## 🚨 Error Handling

- **Centralized Error Handler**: Consistent error responses
- **Validation Errors**: Detailed field-level error messages
- **Database Errors**: User-friendly error translations
- **File Upload Errors**: Clear upload failure messages
- **Development Mode**: Stack traces included

## 📈 Performance

- **Database Indexes**: Optimized queries for users, posts, and search
- **Image Optimization**: Cloudinary auto-optimization
- **Pagination**: Efficient data loading
- **Lean Queries**: Reduced memory usage
- **Connection Pooling**: MongoDB connection optimization

## 🔧 Development

```bash
# Install nodemon for development
npm install -g nodemon

# Run in development mode
npm run dev

# The server will restart automatically on file changes
```

## 🌐 Production Deployment

1. **Environment**: Set `NODE_ENV=production`
2. **Database**: Use MongoDB Atlas production cluster
3. **Secrets**: Use secure JWT secrets and API keys
4. **Process Manager**: Use PM2 or similar for process management
5. **Reverse Proxy**: Use Nginx for SSL and load balancing
6. **Monitoring**: Implement logging and error tracking

## 📝 API Testing

Use the included Postman collection or test with curl:

```bash
# Health check
curl http://localhost:5000/health

# Register user
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"fullName":"John Doe","email":"john@example.com","password":"password123"}'

# Upload post
curl -X POST http://localhost:5000/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@photo.jpg" \
  -F "caption=Beautiful sunset!"
```

## 🆘 Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MONGO_URL format
   - Verify network access in MongoDB Atlas
   - Ensure IP whitelist includes your server

2. **Email Not Sending**
   - Verify Gmail App Password (not regular password)
   - Check EMAIL_USER and EMAIL_PASS values
   - Ensure 2FA is enabled for Gmail account

3. **Cloudinary Upload Failed**
   - Verify API credentials
   - Check file size limits (10MB for posts, 5MB for profiles)
   - Ensure proper file format

4. **JWT Token Invalid**
   - Check JWT_SECRET consistency
   - Verify token format: `Bearer <token>`
   - Check token expiration (30 days)

### Debug Mode

Set environment variable for detailed logging:
```bash
DEBUG=taatom:* npm run dev
```

## 📞 Support

For issues and questions:
- Email: contact@taatom.com
- GitHub Issues: [Create an issue](https://github.com/your-org/taatom-backend/issues)

## 📄 License

MIT License - see LICENSE file for details.
