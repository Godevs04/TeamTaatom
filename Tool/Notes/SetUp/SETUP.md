# Backend Setup Guide

## Prerequisites

1. **Node.js** (v14 or higher)
2. **MongoDB** (already configured)
3. **Redis** (for background jobs)

## Installation Steps

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Install Redis (Local Development)

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

**Using Docker (Recommended):**
```bash
docker run -d -p 6379:6379 --name redis redis
```

**Verify Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

### 3. Configure Environment

Copy `env.example` to `environment.env` and update with your values:
```bash
cp env.example environment.env
```

**Important:** Your `environment.env` already has:
- ✅ MongoDB connection (MONGO_URL) - Database: **Taatom**
- ✅ Redis configuration (REDIS_HOST, REDIS_PORT)
- ✅ ENABLE_BACKGROUND_JOBS=true

### 4. Run Database Migrations

```bash
# Check migration status
npm run migrate:status

# Run migrations
npm run migrate

# If needed, rollback
npm run migrate:down
```

### 5. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## Database Configuration

- **Database Name:** `Taatom` (configured in `migrate-mongo-config.js` and `db.js`)
- **MongoDB URI:** Uses `MONGO_URL` from `environment.env`
- **Migrations:** Stored in `backend/migrations/`

## Redis Configuration

- **Host:** `localhost` (default)
- **Port:** `6379` (default)
- **Password:** None (for local development)

Background jobs will automatically start when:
- `ENABLE_BACKGROUND_JOBS=true` is set, OR
- `NODE_ENV=production`

## Troubleshooting

### migrate-mongo command not found
The migration scripts now use the full path to migrate-mongo. If you still get errors:
```bash
npm install migrate-mongo --save
```

### Redis connection errors
1. Make sure Redis is running: `redis-cli ping`
2. Check Redis port: `lsof -i :6379`
3. Verify `REDIS_HOST` and `REDIS_PORT` in `environment.env`

### Database connection errors
1. Verify `MONGO_URL` in `environment.env`
2. Check MongoDB is accessible
3. Verify database name is `Taatom`

## Quick Commands

```bash
# Install dependencies
npm install

# Run migrations
npm run migrate

# Check migration status
npm run migrate:status

# Start Redis (macOS with Homebrew)
brew services start redis

# Start Redis (Docker)
docker start redis

# Start server
npm run dev
```

