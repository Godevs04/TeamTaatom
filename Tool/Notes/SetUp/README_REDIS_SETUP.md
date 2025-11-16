# Redis Setup Guide for Local Development

## Quick Start

### Option 1: Using Homebrew (macOS)
```bash
brew install redis
brew services start redis
```

### Option 2: Using Docker (Recommended)
```bash
docker run -d -p 6379:6379 --name redis redis
```

### Option 3: Manual Installation
- **macOS**: `brew install redis`
- **Ubuntu/Debian**: `sudo apt-get install redis-server`
- **Windows**: Download from https://redis.io/download

## Verify Installation

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Test Redis
redis-cli set test "hello"
redis-cli get test
# Should return: "hello"
```

## Configuration

Add these to your `environment.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Leave empty for local development

# Enable Background Jobs (set to true to enable Bull queues)
ENABLE_BACKGROUND_JOBS=true
```

## Using the Setup Script

Run the setup script:
```bash
cd backend
./scripts/setup-redis.sh
```

## Background Jobs

Once Redis is running, background jobs will automatically start when:
- `ENABLE_BACKGROUND_JOBS=true` is set, OR
- `NODE_ENV=production`

## Troubleshooting

### Redis not starting
```bash
# Check if port 6379 is already in use
lsof -i :6379

# Kill existing Redis process if needed
killall redis-server

# Start Redis again
redis-server
```

### Connection refused
- Make sure Redis is running: `redis-cli ping`
- Check Redis is listening on port 6379: `lsof -i :6379`
- Verify `REDIS_HOST` and `REDIS_PORT` in `environment.env`

### Docker Redis
```bash
# Start Redis container
docker start redis

# Stop Redis container
docker stop redis

# View Redis logs
docker logs redis
```

