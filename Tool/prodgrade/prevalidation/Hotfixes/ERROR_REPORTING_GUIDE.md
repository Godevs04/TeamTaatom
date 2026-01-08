# Error Reporting Guide

This guide explains how to use the centralized error reporting system across the application to ensure all errors are properly sent to Sentry with full context and stack traces.

## Overview

The error reporting system (`errorReporter.ts`) provides a centralized way to report errors to Sentry with:
- **Automatic stack trace generation** (even for non-Error objects)
- **Full context** (user, request, application state)
- **Sensitive data sanitization** (passwords, tokens, etc.)
- **Clear error codes and types** for easy identification

## Quick Start

### Import the Reporter

```typescript
import { reportError, reportApiError, reportComponentError, reportServiceError } from '../utils/errorReporter';
```

## Usage Patterns

### 1. API Errors

Use `reportApiError` for all API-related errors:

```typescript
import { reportApiError } from '../utils/errorReporter';

try {
  const response = await api.post('/api/v1/posts', postData);
} catch (error: any) {
  const parsedError = parseError(error);
  
  // Report to Sentry with full context
  reportApiError(error, {
    url: error.config?.url || '/api/v1/posts',
    method: error.config?.method || 'POST',
    statusCode: error.response?.status,
    requestData: error.config?.data,
    responseData: error.response?.data,
    errorCode: parsedError.code,
  });
  
  // Show user-friendly message
  showError(parsedError.userMessage);
}
```

### 2. Component Errors

Use `reportComponentError` for React component errors:

```typescript
import { reportComponentError } from '../utils/errorReporter';

const handleLikePost = async (postId: string) => {
  try {
    await likePost(postId);
  } catch (error) {
    reportComponentError(error, {
      screen: 'HomeScreen',
      component: 'PostCard',
      action: 'likePost',
      metadata: { postId },
    });
    showError('Failed to like post');
  }
};
```

### 3. Service Errors

Use `reportServiceError` for service layer errors:

```typescript
import { reportServiceError } from '../utils/errorReporter';

export const uploadImage = async (imageUri: string) => {
  try {
    // Upload logic
  } catch (error) {
    reportServiceError(error, {
      service: 'ImageService',
      functionName: 'uploadImage',
      action: 'image_upload',
      metadata: { imageUri: imageUri.substring(0, 50) }, // Don't log full URI
    });
    throw error;
  }
};
```

### 4. Generic Errors

Use `reportError` for any other errors:

```typescript
import { reportError } from '../utils/errorReporter';

try {
  // Any logic
} catch (error) {
  reportError(error, {
    userId: user?.id,
    username: user?.username,
    screen: 'ProfileScreen',
    action: 'updateProfile',
    errorCode: 'PROFILE_UPDATE_ERROR',
    metadata: {
      field: 'username',
      oldValue: oldUsername,
      newValue: newUsername,
    },
  });
}
```

## Best Practices

### 1. Always Include Context

Provide as much context as possible:

```typescript
// ✅ Good - Full context
reportApiError(error, {
  url: '/api/v1/posts',
  method: 'POST',
  statusCode: 500,
  errorCode: 'SRV_6001',
  metadata: { postType: 'image', hasLocation: true },
});

// ❌ Bad - Missing context
reportError(error);
```

### 2. Sanitize Sensitive Data

The reporter automatically sanitizes sensitive fields, but be careful with metadata:

```typescript
// ✅ Good - No sensitive data
reportError(error, {
  metadata: { userId: user.id, action: 'login' },
});

// ❌ Bad - Contains sensitive data
reportError(error, {
  metadata: { password: userPassword, token: authToken },
});
```

### 3. Use Appropriate Error Types

- `reportApiError` - For API/network errors
- `reportComponentError` - For React component errors
- `reportServiceError` - For service layer errors
- `reportError` - For generic errors

### 4. Don't Report Expected Errors

Expected errors (like validation errors, incorrect credentials) should be logged as debug, not reported:

```typescript
// ✅ Good - Expected error, log as debug
if (error.response?.status === 400) {
  logger.debug('Validation error:', error);
} else {
  // Unexpected error - report to Sentry
  reportApiError(error, { ... });
}
```

## Integration with Existing Code

### Logger Integration

The logger automatically uses the error reporter. Just use `logger.error()`:

```typescript
import logger from '../utils/logger';

try {
  // Logic
} catch (error) {
  // This automatically uses errorReporter internally
  logger.error('Operation failed:', error, {
    screen: 'HomeScreen',
    action: 'loadPosts',
  });
}
```

### API Interceptor

The API interceptor automatically reports errors. No additional code needed for API errors.

### Error Boundaries

Error boundaries automatically use the error reporter. Just wrap components:

```typescript
<ErrorBoundary level="component">
  <YourComponent />
</ErrorBoundary>
```

## What Gets Sent to Sentry

For each error, Sentry receives:

1. **Error Details**:
   - Error message
   - Stack trace (automatically generated if missing)
   - Error type and name

2. **User Context**:
   - User ID
   - Username
   - Email (if provided)

3. **Request Context** (for API errors):
   - URL
   - HTTP method
   - Status code
   - Request data (sanitized)
   - Response data (sanitized)

4. **Application Context**:
   - Screen/route name
   - Component name
   - Action being performed
   - Error code

5. **Metadata**:
   - Additional context (custom fields)
   - Platform info
   - App version

6. **Tags** (for filtering):
   - Platform (iOS/Android/Web)
   - Error code
   - Error type
   - Screen
   - Action
   - HTTP method/status

## Example: Complete Error Handling

```typescript
import { reportApiError } from '../utils/errorReporter';
import { parseError } from '../utils/errorCodes';
import logger from '../utils/logger';

const handleCreatePost = async (postData: PostData) => {
  try {
    const response = await api.post('/api/v1/posts', postData);
    return response.data;
  } catch (error: any) {
    const parsedError = parseError(error);
    
    // Check if it's an expected error (validation, etc.)
    const isExpectedError = error.response?.status === 400 || 
                           error.response?.status === 409 ||
                           parsedError.code?.startsWith('VAL_');
    
    if (isExpectedError) {
      // Expected error - log as debug, don't report to Sentry
      logger.debug('Expected error in createPost:', {
        code: parsedError.code,
        message: parsedError.message,
      });
    } else {
      // Unexpected error - report to Sentry with full context
      reportApiError(error, {
        url: '/api/v1/posts',
        method: 'POST',
        statusCode: error.response?.status,
        requestData: postData, // Will be sanitized automatically
        responseData: error.response?.data,
        errorCode: parsedError.code,
        metadata: {
          postType: postData.type,
          hasMedia: !!postData.media,
        },
      });
    }
    
    // Show user-friendly message
    throw new Error(parsedError.userMessage);
  }
};
```

## Migration Checklist

When updating existing error handling:

- [ ] Replace `logger.error()` calls with `reportApiError()` for API errors
- [ ] Replace `captureException()` calls with appropriate reporter function
- [ ] Add context (screen, component, action) to all error reports
- [ ] Ensure stack traces are preserved (reporter handles this automatically)
- [ ] Remove sensitive data from error context
- [ ] Use appropriate error types (API, component, service, generic)

