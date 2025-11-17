# Swagger API Documentation Usage Guide

## 📚 Accessing Swagger UI

**URL**: `http://localhost:3000/api-docs` (Development only)

Swagger UI is only available in development mode for security reasons.

## 🔐 Authentication Methods

### Method 1: Bearer Token (JWT) - For Mobile/API Clients

**Steps:**
1. **Get a token:**
   - Go to `POST /api/v1/auth/signin`
   - Click "Try it out"
   - Enter your email and password:
     ```json
     {
       "email": "your@email.com",
       "password": "yourpassword"
     }
     ```
   - Click "Execute"
   - Copy the `token` value from the response

2. **Authorize:**
   - Click the green "Authorize" button at the top right
   - In the "bearerAuth" section, enter your token:
     - Option 1: `Bearer YOUR_TOKEN_HERE` (with "Bearer " prefix)
     - Option 2: `YOUR_TOKEN_HERE` (without prefix - Swagger adds it automatically)
   - Click "Authorize"
   - Click "Close"

3. **Test endpoints:**
   - Now all protected endpoints will include your token automatically
   - Try any endpoint that requires authentication

**Example Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODlmMWNlYjhjYzc3NzkwODZjZGIwNzEiLCJpYXQiOjE3MDUwMDAwMDAsImV4cCI6MTcwNTA4NjQwMH0.example
```

### Method 2: Cookie Authentication - For Web Clients

**Steps:**
1. **Get a cookie:**
   - Sign in via your web application (with `withCredentials: true`)
   - Open browser DevTools (F12)
   - Go to Application → Cookies → `http://localhost:3000`
   - Find the `authToken` cookie
   - Copy its value

2. **Authorize:**
   - Click the green "Authorize" button
   - In the "cookieAuth" section, enter the cookie value
   - Click "Authorize"
   - Click "Close"

**Note:** Cookie authentication is more secure for web apps as it's HTTP-only and XSS-resistant.

### Method 3: CSRF Token (For Web POST/PUT/DELETE)

**Steps:**
1. **Get CSRF token:**
   - Make any GET request to the API
   - Check response headers for `x-csrf-token`
   - Or check cookies for `csrf-token`

2. **Use CSRF token:**
   - Swagger automatically includes CSRF token in headers for POST/PUT/DELETE requests
   - Or manually add to `X-CSRF-Token` header

## 🧪 Testing Endpoints

### Step-by-Step Guide

1. **Find an endpoint:**
   - Browse by tag (Authentication, Posts, Profile, etc.)
   - Or use the search/filter box

2. **Expand endpoint:**
   - Click on the endpoint to expand it
   - View request parameters, body schema, responses

3. **Try it out:**
   - Click "Try it out" button
   - Fill in required parameters
   - For POST/PUT requests, edit the request body JSON
   - Click "Execute"

4. **View response:**
   - Check the response code (200, 400, 401, etc.)
   - View response body
   - Check response headers

### Example: Creating a Post

1. Go to `POST /api/v1/posts`
2. Click "Try it out"
3. Authorize with your token (if not already done)
4. Edit the request body:
   ```json
   {
     "caption": "Beautiful sunset! #sunset #travel",
     "images": ["https://example.com/image.jpg"],
     "location": {
       "address": "Paris, France",
       "coordinates": [2.3522, 48.8566]
     }
   }
   ```
5. Click "Execute"
6. View the response

## 📋 Common Request Examples

### Sign In
```json
POST /api/v1/auth/signin
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Create Post
```json
POST /api/v1/posts
{
  "caption": "My first post! #travel",
  "images": ["https://res.cloudinary.com/taatom/image/upload/v123/post.jpg"],
  "location": {
    "address": "New York, USA",
    "coordinates": [-74.0060, 40.7128]
  }
}
```

### Update Profile
```json
PUT /api/v1/profile
{
  "fullName": "John Doe",
  "bio": "Travel enthusiast",
  "location": {
    "address": "San Francisco, CA",
    "coordinates": [-122.4194, 37.7749]
  }
}
```

### Follow User
```json
POST /api/v1/profile/507f1f77bcf86cd799439011/follow
```

## 🔍 Understanding Responses

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "AUTH_1004",
    "message": "Invalid email or password"
  }
}
```

### Error Codes Reference

- **AUTH_1001**: Authentication required
- **AUTH_1002**: Invalid token
- **AUTH_1003**: Token expired
- **AUTH_1004**: Invalid credentials
- **VAL_2001**: Validation failed
- **RES_3001**: Resource not found
- **RATE_5001**: Too many requests
- **SRV_6001**: Internal server error

## 💡 Tips & Tricks

1. **Persistent Authorization:**
   - Swagger saves your authorization tokens
   - You don't need to re-authorize on page refresh

2. **Filter Endpoints:**
   - Use the search box to filter endpoints
   - Filter by tag, method, or keyword

3. **Request Duration:**
   - Swagger shows how long each request took
   - Useful for performance testing

4. **Copy cURL:**
   - After executing a request, you can copy the cURL command
   - Useful for testing outside Swagger

5. **Schema Validation:**
   - Swagger validates your request body against the schema
   - Red highlights indicate validation errors

## 🚨 Troubleshooting

### "Unauthorized" Error
- Make sure you've authorized with a valid token
- Check if token has expired (tokens expire after 24 hours)
- Try refreshing your token via `POST /api/v1/auth/refresh`

### "CSRF token missing" Error
- Make sure you're including CSRF token for POST/PUT/DELETE requests
- Check browser cookies for `csrf-token`
- Swagger should auto-include it, but you can manually add to headers

### "Validation failed" Error
- Check the request body schema
- Ensure all required fields are present
- Check field types and formats (email, date, etc.)

### CORS Errors
- Make sure you're accessing Swagger from an allowed origin
- Check backend CORS configuration

## 📖 Additional Resources

- **API Base URL**: `http://localhost:3000/api/v1`
- **WebSocket**: `ws://localhost:3000/app` (for real-time features)
- **Error Codes**: See Swagger schema definitions
- **Rate Limits**: Check response headers for rate limit info

## 🔒 Security Notes

- Swagger is **only available in development mode**
- Never commit tokens or credentials
- Use environment variables for sensitive data
- Tokens expire after 24 hours
- Refresh tokens before expiration

---

**Happy Testing! 🚀**

