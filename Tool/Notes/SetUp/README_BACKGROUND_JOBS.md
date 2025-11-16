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

