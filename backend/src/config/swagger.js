/**
 * Swagger/OpenAPI Configuration
 * API Documentation for Taatom Backend
 */

const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

// Ensure environment variables are loaded even when this file is required directly
if (!process.env.API_BASE_URL) {
  require('dotenv').config({
    path: path.resolve(__dirname, '../../.env'),
  });
}

// PRODUCTION-GRADE: Use environment variables, no hardcoded localhost for production
const DEFAULT_PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Development server URL
const DEV_SERVER_URL = process.env.API_BASE_URL || `http://localhost:${DEFAULT_PORT}`;

// Production server URL - must be explicitly set
const PROD_SERVER_URL = process.env.API_BASE_URL || process.env.API_BASE_URL_PROD || (isProduction ? '' : DEV_SERVER_URL);

// Validate production configuration
if (isProduction && !process.env.API_BASE_URL && !process.env.API_BASE_URL_PROD) {
  console.warn('⚠️  WARNING: API_BASE_URL or API_BASE_URL_PROD should be set for production Swagger docs');
}

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Taatom API',
      version: '1.0.0',
      description: `
# Taatom API Documentation

Welcome to the Taatom API documentation. This comprehensive RESTful API provides all the functionality needed to integrate with the Taatom social media platform.

## Quick Start

### Authentication

**For API/Mobile Clients:**
1. Authenticate via \`POST /api/v1/auth/signin\`
2. Copy the \`token\` from the response
3. Click "Authorize" button and enter: \`Bearer YOUR_TOKEN\`
4. All subsequent requests will include authentication

**For Web Clients:**
1. Sign in with \`withCredentials: true\`
2. Browser stores \`authToken\` cookie automatically
3. For Swagger: Copy cookie value from DevTools → Application → Cookies

### Making Requests

- Base URL: \`/api/v1\`
- Authentication: Bearer token or cookie (set via Authorize button)
- Content-Type: \`application/json\` (or \`multipart/form-data\` for file uploads)

### Testing Endpoints

1. Browse endpoints by category using the tags below
2. Click any endpoint to view details
3. Click "Try it out" to enable editing
4. Fill required parameters
5. Click "Execute" to send request
6. Review response with status, headers, and body

## API Overview

**Base Path:** \`/api/v1\`

**Response Format:**
\`\`\`json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
\`\`\`

**Error Format:**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "AUTH_1004",
    "message": "Invalid credentials",
    "details": { ... }
  }
}
\`\`\`

## Security

- Rate limiting on all endpoints
- CSRF protection for web clients
- Input validation and sanitization
- JWT token authentication (24h expiry)
- HTTP-only cookie support

## Error Codes

| Code | Category | Description |
|------|----------|-------------|
| AUTH_1001-1006 | Authentication | Auth and authorization errors |
| VAL_2001-2005 | Validation | Input validation failures |
| RES_3001-3005 | Resources | Resource not found/access denied |
| FILE_4001-4004 | File Upload | File upload errors |
| RATE_5001 | Rate Limiting | Too many requests |
| SRV_6001-6003 | Server | Internal server errors |
| BIZ_7001-7003 | Business Logic | Business rule violations |

## Features

- **Authentication**: Sign up, sign in, OTP verification, password management
- **Posts**: Create, read, update posts with images, location, and background music
- **Profile**: User profiles, follow/unfollow, search, interests
- **Chat**: Real-time messaging and conversations
- **Shorts**: Short-form video content management
- **Songs**: Music library for posts and shorts
- **Hashtags**: Search, trending, and hashtag-based content discovery
- **Notifications**: User notification management
- **Collections**: Organize saved posts
- **Search**: Advanced search for posts, users, and locations
- **Settings**: User preferences and account settings
- **Analytics**: User behavior and engagement metrics

## Code Generation

Generate request code snippets in:
- cURL (bash, PowerShell, CMD)
- Node.js
- Python
- JavaScript

## Support

- **Email**: contact@taatom.com
- **Documentation**: https://docs.taatom.com

---

**Version**: 1.0.0 | **Last Updated**: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      `,
      contact: {
        name: 'API Support',
        email: 'contact@taatom.com',
        url: 'https://docs.taatom.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      },
      termsOfService: 'https://taatom.com/terms'
    },
    servers: [
      {
        url: DEV_SERVER_URL,
        description: 'Primary server (current env)'
      },
      ...(PROD_SERVER_URL && PROD_SERVER_URL !== DEV_SERVER_URL ? [{
        url: PROD_SERVER_URL,
        description: 'Secondary/Production server'
      }] : [])
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: `
**JWT Token Authentication (Mobile/API)**

**How to get a token:**
1. Sign in via \`POST /api/v1/auth/signin\` with email and password
2. Or sign up via \`POST /api/v1/auth/signup\`
3. Copy the \`token\` from the response
4. Click "Authorize" button above
5. Enter: \`Bearer YOUR_TOKEN_HERE\` (include "Bearer " prefix)
   OR just enter: \`YOUR_TOKEN_HERE\` (without Bearer)

**Example:**
\`\`\`
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODlmMWNlYjhjYzc3NzkwODZjZGIwNzEiLCJpYXQiOjE3MDUwMDAwMDAsImV4cCI6MTcwNTA4NjQwMH0.example
\`\`\`

**Usage:**
- Use this for mobile apps and API clients
- Token expires after 24 hours
- Refresh token via \`POST /api/v1/auth/refresh\`
          `
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'authToken',
          description: `
**HTTP-Only Cookie Authentication (Web)**

**How to get a cookie:**
1. Sign in via \`POST /api/v1/auth/signin\` with \`withCredentials: true\`
2. Browser automatically stores the \`authToken\` cookie
3. For Swagger testing, copy the cookie value from browser DevTools:
   - Open DevTools → Application → Cookies
   - Find \`authToken\` cookie
   - Copy its value

**Example cookie value:**
\`\`\`
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODlmMWNlYjhjYzc3NzkwODZjZGIwNzEiLCJpYXQiOjE3MDUwMDAwMDAsImV4cCI6MTcwNTA4NjQwMH0.example
\`\`\`

**Usage:**
- Use this for web applications
- More secure (XSS-resistant)
- Automatically sent with requests
- No need to manually add to headers
          `
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description: `
**CSRF Token Protection (Web Only)**

**How to get CSRF token:**
1. Make any GET request to the API
2. Check response headers for \`x-csrf-token\`
3. Or check cookies for \`csrf-token\`
4. Include in \`X-CSRF-Token\` header for POST/PUT/DELETE requests

**Required for:** POST, PUT, DELETE, PATCH requests on web
**Not required for:** GET requests, mobile apps
          `
        }
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: {
              type: 'boolean',
              example: false,
              description: 'Always false for error responses'
            },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  example: 'AUTH_1004',
                  description: 'Standardized error code (AUTH_*, VAL_*, RES_*, FILE_*, RATE_*, SRV_*, BIZ_*)',
                  enum: [
                    'AUTH_1001', 'AUTH_1002', 'AUTH_1003', 'AUTH_1004', 'AUTH_1005', 'AUTH_1006',
                    'VAL_2001', 'VAL_2002', 'VAL_2003', 'VAL_2004', 'VAL_2005',
                    'RES_3001', 'RES_3002', 'RES_3003', 'RES_3004', 'RES_3005',
                    'FILE_4001', 'FILE_4002', 'FILE_4003', 'FILE_4004',
                    'RATE_5001',
                    'SRV_6001', 'SRV_6002', 'SRV_6003',
                    'BIZ_7001', 'BIZ_7002', 'BIZ_7003'
                  ]
                },
                message: {
                  type: 'string',
                  example: 'Invalid email or password',
                  description: 'Human-readable error message'
                },
                details: {
                  type: 'object',
                  description: 'Additional error details (validation errors, etc.)',
                  additionalProperties: true
                }
              }
            },
            stack: {
              type: 'string',
              description: 'Error stack trace (only in development mode)',
              example: 'Error: Invalid email or password\n    at authController.signin...'
            }
          }
        },
        Success: {
          type: 'object',
          required: ['success'],
          properties: {
            success: {
              type: 'boolean',
              example: true,
              description: 'Always true for successful responses'
            },
            message: {
              type: 'string',
              example: 'Operation successful',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data (varies by endpoint)',
              additionalProperties: true
            },
            token: {
              type: 'string',
              description: 'JWT token (for auth endpoints)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            user: {
              $ref: '#/components/schemas/User',
              description: 'User object (for auth endpoints)'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            currentPage: {
              type: 'integer',
              example: 1,
              minimum: 1
            },
            totalPages: {
              type: 'integer',
              example: 10,
              minimum: 0
            },
            total: {
              type: 'integer',
              example: 100,
              minimum: 0,
              description: 'Total number of items'
            },
            totalCount: {
              type: 'integer',
              example: 100,
              minimum: 0,
              description: 'Alias for total (backward compatibility)'
            },
            hasMore: {
              type: 'boolean',
              example: true,
              description: 'Whether there are more pages available'
            },
            limit: {
              type: 'integer',
              example: 20,
              description: 'Items per page'
            }
          }
        },
        Song: {
          type: 'object',
          required: ['_id', 'title', 'artist', 'duration'],
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
              description: 'MongoDB ObjectId of the song'
            },
            title: {
              type: 'string',
              example: 'Summer Vibes',
              description: 'Song title',
              minLength: 1,
              maxLength: 200
            },
            artist: {
              type: 'string',
              example: 'John Doe',
              description: 'Artist name',
              minLength: 1,
              maxLength: 200
            },
            duration: {
              type: 'integer',
              example: 240,
              description: 'Duration in seconds',
              minimum: 0
            },
            genre: {
              type: 'string',
              example: 'Pop',
              description: 'Song genre',
              maxLength: 50,
              default: 'General'
            },
            s3Url: {
              type: 'string',
              format: 'uri',
              example: 'https://storage.example.com/songs/abc123.mp3?signature=...',
              description: 'Signed URL for audio file (dynamically generated, expires)'
            },
            cloudinaryUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://storage.example.com/songs/abc123.mp3?signature=...',
              description: 'Alias for s3Url (backward compatibility)'
            },
            imageUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://storage.example.com/song-images/xyz789.jpg?signature=...',
              description: 'Signed URL for cover image (dynamically generated, expires)'
            },
            thumbnailUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://storage.example.com/song-images/xyz789.jpg?signature=...',
              description: 'Alias for imageUrl (backward compatibility)'
            },
            isActive: {
              type: 'boolean',
              example: true,
              description: 'Whether the song is active and visible to users',
              default: true
            },
            usageCount: {
              type: 'integer',
              example: 15,
              description: 'Number of posts/shorts using this song',
              minimum: 0,
              default: 0
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00.000Z',
              description: 'Song creation timestamp'
            },
            uploadDate: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00.000Z',
              description: 'Song upload timestamp'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: {
              type: 'boolean',
              example: false,
              description: 'Always false for error responses'
            },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  example: 'VAL_2001',
                  description: 'Standardized error code'
                },
                message: {
                  type: 'string',
                  example: 'Validation failed',
                  description: 'Human-readable error message'
                },
                details: {
                  type: 'object',
                  description: 'Additional error details',
                  additionalProperties: true
                }
              }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            fullName: {
              type: 'string',
              example: 'John Doe'
            },
            username: {
              type: 'string',
              example: 'johndoe'
            },
            email: {
              type: 'string',
              example: 'kavin@taatom.com'
            },
            profilePic: {
              type: 'string',
              example: 'https://example.com/profile.jpg'
            },
            bio: {
              type: 'string',
              example: 'Travel enthusiast'
            },
            followers: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            following: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Post: {
          type: 'object',
          required: ['_id', 'user', 'images'],
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
              description: 'Post ID'
            },
            user: {
              $ref: '#/components/schemas/User',
              description: 'Post author'
            },
            images: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri'
              },
              minItems: 1,
              example: ['https://res.cloudinary.com/taatom/image/upload/v1234567890/post1.jpg'],
              description: 'Array of image URLs'
            },
            caption: {
              type: 'string',
              example: 'Beautiful sunset! #sunset #travel #photography',
              description: 'Post caption with optional hashtags',
              maxLength: 2200
            },
            location: {
              type: 'object',
              properties: {
                address: {
                  type: 'string',
                  example: 'Paris, France'
                },
                coordinates: {
                  type: 'array',
                  items: {
                    type: 'number'
                  },
                  minItems: 2,
                  maxItems: 2,
                  example: [2.3522, 48.8566],
                  description: '[longitude, latitude]'
                }
              }
            },
            likes: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
              description: 'Array of user IDs who liked the post'
            },
            likesCount: {
              type: 'integer',
              example: 42,
              description: 'Number of likes'
            },
            comments: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Comment'
              },
              description: 'Post comments'
            },
            commentsCount: {
              type: 'integer',
              example: 5,
              description: 'Number of comments'
            },
            isLiked: {
              type: 'boolean',
              example: false,
              description: 'Whether current user liked this post'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['travel', 'photography', 'sunset'],
              description: 'Post tags/hashtags'
            },
            type: {
              type: 'string',
              enum: ['photo', 'video', 'short'],
              example: 'photo',
              description: 'Post type'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00.000Z'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-15T10:30:00.000Z'
            }
          }
        },
        Comment: {
          type: 'object',
          required: ['_id', 'user', 'text'],
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            user: {
              $ref: '#/components/schemas/User',
              description: 'Comment author'
            },
            text: {
              type: 'string',
              example: 'Amazing photo!',
              maxLength: 1000
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '507f1f77bcf86cd799439011'
            },
            type: {
              type: 'string',
              enum: ['like', 'comment', 'follow', 'follow_request', 'follow_approved', 'post_mention'],
              example: 'like'
            },
            fromUser: {
              $ref: '#/components/schemas/User'
            },
            message: {
              type: 'string',
              example: 'John Doe liked your post'
            },
            read: {
              type: 'boolean',
              example: false
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Hashtag: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'travel',
              description: 'Hashtag name without #'
            },
            postCount: {
              type: 'integer',
              example: 150,
              description: 'Number of posts with this hashtag'
            },
            lastUsed: {
              type: 'string',
              format: 'date-time',
              description: 'Last time this hashtag was used'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required or token invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'AUTH_1001',
                  message: 'Authentication required'
                }
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'VAL_2001',
                  message: 'Validation failed',
                  details: {
                    validationErrors: []
                  }
                }
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'RES_3001',
                  message: 'Resource not found'
                }
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: {
                  code: 'SRV_6001',
                  message: 'Internal server error'
                }
              }
            }
          }
        },
        BadRequest: {
          description: 'Bad request - validation error or invalid input',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                error: {
                  code: 'VAL_2001',
                  message: 'Validation failed',
                  details: {
                    validationErrors: [
                      {
                        field: 'title',
                        message: 'Title must be between 1 and 200 characters'
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        Unauthorized: {
          description: 'Authentication required or token invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                error: {
                  code: 'AUTH_1001',
                  message: 'Authentication required'
                }
              }
            }
          }
        },
        Forbidden: {
          description: 'Access forbidden - insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                error: {
                  code: 'AUTH_1003',
                  message: 'Access forbidden. SuperAdmin privileges required.'
                }
              }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                error: {
                  code: 'RES_3001',
                  message: 'Song not found'
                }
              }
            }
          }
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                error: {
                  code: 'SRV_6001',
                  message: 'Error updating song'
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints',
        externalDocs: {
          description: 'Learn more about authentication',
          url: 'https://docs.taatom.com/auth'
        }
      },
      {
        name: 'Posts',
        description: 'Post management endpoints - Create, read, update, delete posts',
        externalDocs: {
          description: 'Post API Guide',
          url: 'https://docs.taatom.com/posts'
        }
      },
      {
        name: 'Profile',
        description: 'User profile management endpoints - Get, update profiles, follow/unfollow users',
        externalDocs: {
          description: 'Profile API Guide',
          url: 'https://docs.taatom.com/profile'
        }
      },
      {
        name: 'Chat',
        description: 'Real-time chat and messaging endpoints',
        externalDocs: {
          description: 'Chat API Guide',
          url: 'https://docs.taatom.com/chat'
        }
      },
      {
        name: 'Shorts',
        description: 'Short video content endpoints'
      },
      {
        name: 'Settings',
        description: 'User settings management - Privacy, notifications, account settings'
      },
      {
        name: 'Notifications',
        description: 'Notification management endpoints'
      },
      {
        name: 'Analytics',
        description: 'Analytics and tracking endpoints - User behavior, engagement metrics'
      },
      {
        name: 'Hashtags',
        description: 'Hashtag search, trending hashtags, and hashtag-related posts'
      },
      {
        name: 'SuperAdmin',
        description: 'SuperAdmin endpoints - User management, moderation, system settings'
      },
      {
        name: 'Feature Flags',
        description: 'Feature flag management for A/B testing and feature rollouts'
      },
      {
        name: 'Health',
        description: 'Health check endpoints for monitoring and load balancers - Basic health, detailed health, readiness, and liveness probes'
      },
      {
        name: 'Policies',
        description: 'Public policy documents - Privacy Policy, Terms of Service, and Copyright Consent'
      },
      {
        name: 'Collections',
        description: 'User collections management - Create, manage, and organize post collections'
      },
      {
        name: 'Search',
        description: 'Search functionality - Search posts, users, and locations'
      },
      {
        name: 'Activity',
        description: 'Activity feed endpoints - Get user activity and activity feed'
      },
      {
        name: 'User Management',
        description: 'User account management - Activity logs, account settings, and user operations'
      },
      {
        name: 'Songs',
        description: 'Music library endpoints - Get available songs for posts and shorts'
      },
      {
        name: 'Locales',
        description: 'Location/locale management - Get and manage travel locations and destinations'
      },
      {
        name: 'Mentions',
        description: 'User mention functionality - Search users for @mentions in posts and comments'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/routes/v1/*.js',
    './src/controllers/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

