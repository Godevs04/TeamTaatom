# Background Jobs Guide

This project uses Bull (Redis-based queue) for background job processing.

## Setup

1. Install Redis:
```bash
# macOS
brew install redis

# Ubuntu/Debian
sudo apt-get install redis-server

# Or use Docker
docker run -d -p 6379:6379 redis
```

2. Set environment variables in `environment.env`:
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional
ENABLE_BACKGROUND_JOBS=true
```

3. Install dependencies:
```bash
npm install
```

## Available Queues

### Email Queue
- **Purpose**: Send emails asynchronously
- **Concurrency**: 5 jobs
- **Use Case**: OTP emails, password resets, notifications

### Image Processing Queue
- **Purpose**: Process and optimize images
- **Concurrency**: 3 jobs
- **Use Case**: Image uploads, thumbnail generation

### Analytics Queue
- **Purpose**: Aggregate analytics data
- **Concurrency**: 2 jobs
- **Use Case**: Daily/hourly analytics reports

### Cleanup Queue
- **Purpose**: Clean up old data
- **Concurrency**: 1 job
- **Use Case**: Remove old analytics events, resolved error logs

## Usage Examples

### Adding Email Job
```javascript
const { emailQueue } = require('./jobs/queue');

emailQueue.add('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome to Taatom</h1>',
  text: 'Welcome to Taatom',
});
```

### Adding Image Processing Job
```javascript
const { imageProcessingQueue } = require('./jobs/queue');

imageProcessingQueue.add('process-image', {
  imageUrl: 'https://example.com/image.jpg',
  transformations: [{ width: 1080, height: 1080, crop: 'limit' }],
});
```

### Adding Analytics Job
```javascript
const { analyticsQueue } = require('./jobs/queue');

analyticsQueue.add('aggregate-analytics', {
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  aggregationType: 'daily',
});
```

### Adding Cleanup Job
```javascript
const { cleanupQueue } = require('./jobs/queue');

cleanupQueue.add('cleanup', {
  cleanupType: 'analytics',
  olderThanDays: 90,
});
```

## Monitoring

Use Bull Board or similar tools to monitor queues:
```bash
npm install bull-board
```

## Workers

Workers are automatically started when:
- `ENABLE_BACKGROUND_JOBS=true` is set, OR
- `NODE_ENV=production`

Workers process jobs concurrently based on the concurrency setting for each queue.

---

## 📝 **Logging in Background Jobs**

All background job processors use the centralized logger utility for consistent logging.

### **Logger Usage**

```javascript
const logger = require('../utils/logger');

// In job processor
emailQueue.process('send-email', async (job) => {
  logger.info('Processing email job:', job.id);
  
  try {
    // Process job
    logger.debug('Email sent successfully');
  } catch (error) {
    logger.error('Email job failed:', error);
    throw error;
  }
});
```

### **Error Handling**

Background jobs use the standardized error code system:

```javascript
const { sendError, ERROR_CODES } = require('../utils/errorCodes');

// In job processor
if (!emailData.to) {
  logger.error('Missing recipient email');
  throw new Error('FILE_4001'); // File/Data validation error
}
```

### **Log Levels**

- **`logger.debug()`**: Detailed debugging information (development only)
- **`logger.info()`**: General information about job processing
- **`logger.warn()`**: Warning messages (e.g., retry attempts)
- **`logger.error()`**: Error messages (always logged, formatted in production)

### **Best Practices**

1. **Log Job Start/End**: Always log when a job starts and completes
2. **Log Errors**: Always log errors with context
3. **Use Appropriate Levels**: Use `debug` for detailed info, `info` for general events
4. **Include Job ID**: Include job ID in log messages for traceability
5. **Error Codes**: Use error codes for consistent error handling

### **Example: Email Processor**

```javascript
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/sendOtp');

emailQueue.process('send-email', async (job) => {
  const { to, subject, html, text } = job.data;
  
  logger.info(`Processing email job ${job.id} to ${to}`);
  
  try {
    await sendEmail({ to, subject, html, text });
    logger.info(`Email job ${job.id} completed successfully`);
    return { success: true };
  } catch (error) {
    logger.error(`Email job ${job.id} failed:`, error.message);
    throw error; // Will trigger retry mechanism
  }
});
```

### **Monitoring Logs**

In production, logs are formatted to prevent information leakage:
- Errors are logged with sanitized data
- Sensitive information (passwords, tokens) is never logged
- Log levels respect `NODE_ENV` environment variable

---

## 🔧 **Error Codes in Background Jobs**

Background jobs use the same error code system as the main application for consistency.

### **Common Error Codes**

- **`SRV_6001`**: Internal server error
- **`SRV_6002`**: Database connection error
- **`SRV_6003`**: Service temporarily unavailable
- **`FILE_4004`**: File upload/processing failed
- **`VAL_2001`**: Validation failed

### **Error Handling Pattern**

```javascript
const logger = require('../utils/logger');

imageProcessingQueue.process('process-image', async (job) => {
  try {
    // Process image
    if (!imageUrl) {
      logger.error('Missing image URL');
      throw new Error('VAL_2001'); // Validation error
    }
    
    // Process image
    return { success: true, processedUrl };
  } catch (error) {
    logger.error('Image processing failed:', error.message);
    throw error; // Will be caught by Bull's error handler
  }
});
```

### **Retry Logic**

Jobs automatically retry on failure based on queue configuration:

```javascript
// Queue configuration with retry
const imageProcessingQueue = new Queue('image-processing', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});
```

Logs will show retry attempts:
```
[WARN] Retrying image processing job (attempt 1/3)
[WARN] Retrying image processing job (attempt 2/3)
[ERROR] Image processing job failed after 3 attempts
```

---
