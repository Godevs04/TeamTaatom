# Logging Guide - TeamTaatom

## Overview

The application uses structured logging with standardized log levels across frontend and backend. This guide explains how to use the logging system effectively.

## Log Levels

The logging system supports four standard levels (in order of severity):

1. **DEBUG** - Detailed information for debugging (development only)
2. **INFO** - General informational messages
3. **WARN** - Warning messages for potentially harmful situations
4. **ERROR** - Error events that might still allow the application to continue

### Log Level Configuration

**Backend:**
- Environment variable: `LOG_LEVEL` (default: `debug` in development, `info` in production)
- Valid values: `debug`, `info`, `warn`, `error`

**Frontend:**
- Environment variable: `EXPO_PUBLIC_LOG_LEVEL` (default: `debug` in development, `info` in production)
- Valid values: `debug`, `info`, `warn`, `error`

## Usage

### Backend Logging

```javascript
const logger = require('./utils/logger');

// Structured logging (recommended)
logger.info('User logged in', { userId: '123', method: 'email' });
logger.warn('Rate limit approaching', { userId: '123', requests: 95 });
logger.error('Failed to process payment', new Error('Payment gateway timeout'), { orderId: '456' });
logger.debug('Cache hit', { key: 'user:123', ttl: 3600 });

// Legacy pattern (still supported for backward compatibility)
logger.info('User logged in', 'userId', '123');
logger.warn('Rate limit approaching', { userId: '123' });
logger.error('Failed to process payment', error);
```

### Frontend Logging

```typescript
import logger from '../utils/logger';

// Structured logging (recommended)
logger.info('Screen viewed', { screen: 'home', userId: '123' });
logger.warn('Network request failed', { url: '/api/posts', status: 500 });
logger.error('Failed to load profile', error, { userId: '123' });
logger.debug('Component rendered', { component: 'PostCard', postId: '456' });

// Context-specific logger
import { createLogger } from '../utils/logger';
const postLogger = createLogger('PostService');
postLogger.info('Post created', { postId: '789' });
postLogger.error('Failed to create post', error, { userId: '123' });
```

## Structured Logging Format

When `STRUCTURED_LOGGING=true` is set in production, logs are output as JSON:

```json
{
  "timestamp": "2024-12-20T13:44:15.043Z",
  "level": "INFO",
  "message": "User logged in",
  "userId": "123",
  "method": "email"
}
```

This format is ideal for log aggregation systems like:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- AWS CloudWatch
- Google Cloud Logging
- Datadog
- Splunk

## Data Sanitization

The logger automatically sanitizes sensitive data before logging:

- `password`
- `token`
- `secret`
- `apiKey`
- `authorization`
- `cookie`
- `authToken`

Sensitive fields are replaced with `[REDACTED]` in logs.

## Production Behavior

**Development Mode:**
- All log levels are output to console
- Stack traces included in errors
- Human-readable format

**Production Mode:**
- Only `info`, `warn`, and `error` levels are output (unless `LOG_LEVEL=debug`)
- Stack traces excluded from errors
- Structured JSON format when `STRUCTURED_LOGGING=true`
- Errors automatically sent to Sentry (frontend) or error tracking (backend)

## Best Practices

1. **Use appropriate log levels:**
   - `debug`: Detailed debugging information (development only)
   - `info`: General application flow
   - `warn`: Potentially problematic situations
   - `error`: Error events that need attention

2. **Include context:**
   ```javascript
   // ✅ Good
   logger.error('Failed to create post', error, { userId: '123', postId: '456' });
   
   // ❌ Bad
   logger.error('Failed to create post', error);
   ```

3. **Don't log sensitive data:**
   ```javascript
   // ❌ Bad - password will be redacted but still not recommended
   logger.info('User signed up', { email: 'user@example.com', password: 'secret123' });
   
   // ✅ Good
   logger.info('User signed up', { email: 'user@example.com', userId: '123' });
   ```

4. **Use structured data:**
   ```javascript
   // ✅ Good - structured
   logger.info('Post liked', { postId: '123', userId: '456', timestamp: Date.now() });
   
   // ❌ Bad - unstructured
   logger.info('Post 123 liked by user 456');
   ```

5. **Create context-specific loggers:**
   ```typescript
   // ✅ Good - context-specific logger
   const postLogger = createLogger('PostService');
   postLogger.info('Post created', { postId: '123' });
   
   // ❌ Bad - generic logger
   logger.info('[PostService] Post created', { postId: '123' });
   ```

## Migration Guide

If you're updating existing code to use structured logging:

**Before:**
```javascript
logger.warn('Failed to generate image URLs for post:', { postId: post._id, error: error.message });
```

**After:**
```javascript
logger.warn('Failed to generate image URLs for post', { postId: post._id, error: error.message });
```

The logger automatically handles both patterns for backward compatibility.

## Environment Variables

**Backend:**
- `LOG_LEVEL` - Set log level (debug, info, warn, error)
- `STRUCTURED_LOGGING` - Set to `true` for JSON output in production
- `NODE_ENV` - Set to `development` or `production`

**Frontend:**
- `EXPO_PUBLIC_LOG_LEVEL` - Set log level (debug, info, warn, error)
- `NODE_ENV` - Set to `development` or `production`

## Integration with Monitoring

- **Frontend errors** are automatically sent to Sentry
- **Backend errors** can be integrated with Sentry or other error tracking services
- **Structured logs** can be aggregated using log aggregation systems
- **Log levels** can be filtered in monitoring dashboards

