# Build Optimization Guide - TeamTaatom

## Overview

This guide covers production build optimizations for both frontend and backend, including console stripping, source maps, bundle size monitoring, and process management.

## Frontend Optimizations

### 1. Console Stripping

**Configuration:** `frontend/babel.config.js`

Console statements (`console.log`, `console.debug`, `console.info`) are automatically removed in production builds using `babel-plugin-transform-remove-console`. `console.error` and `console.warn` are preserved for production debugging.

**How it works:**
- Development: All console statements are preserved
- Production: Only `console.error` and `console.warn` are kept

**Manual override:**
```javascript
// This will be removed in production
console.log('Debug info');

// These will be kept in production
console.error('Error occurred');
console.warn('Warning message');
```

### 2. Metro Bundler Optimizations

**Configuration:** `frontend/metro.config.js`

Production builds include:
- **Code minification** with aggressive compression
- **Dead code elimination**
- **Tree shaking** (automatic with Expo)
- **Source maps** as separate files (not inline)

**Minification settings:**
- 3 compression passes for maximum optimization
- Class and function name mangling
- Dead code removal
- Inline optimization

### 3. Bundle Size Monitoring

**Script:** `frontend/scripts/analyze-bundle.js`

Automatically analyzes bundle sizes after production builds and warns if limits are exceeded.

**Usage:**
```bash
# Run after production build
npm run build:analyze

# Or as part of build process
npm run build:web  # Automatically runs analyze after build
```

**Bundle Size Limits:**
- Main bundle: 2MB
- Vendor bundle: 1MB
- Total: 5MB

**Customizing limits:**
Edit `frontend/scripts/analyze-bundle.js`:
```javascript
const BUNDLE_SIZE_LIMITS = {
  main: 2 * 1024 * 1024, // Adjust as needed
  vendor: 1 * 1024 * 1024,
  total: 5 * 1024 * 1024,
};
```

### 4. Source Maps

**Configuration:** `frontend/metro.config.js`

Source maps are generated as separate files (not inline) for production builds. This:
- Reduces bundle size
- Improves security (source code not exposed in bundle)
- Enables debugging in production when needed

**Accessing source maps:**
- Source maps are generated alongside bundles
- Upload to error tracking service (Sentry) for production debugging
- Do not serve source maps publicly in production

### 5. Production Build Commands

```bash
# Web build
npm run build:web

# iOS build (via EAS)
eas build --platform ios --profile production

# Android build (via EAS)
eas build --platform android --profile production
```

## Backend Optimizations

### 1. Process Manager (PM2)

**Configuration:** `backend/ecosystem.config.js`

PM2 provides:
- Process monitoring and auto-restart
- Cluster mode for multi-core utilization
- Log management
- Memory limit monitoring
- Graceful shutdown handling

**Installation:**
```bash
npm install -g pm2
```

**Usage:**
```bash
# Start application
pm2 start ecosystem.config.js --env production

# Stop application
pm2 stop ecosystem.config.js

# Restart application
pm2 restart ecosystem.config.js

# View logs
pm2 logs

# Monitor resources
pm2 monit

# View status
pm2 status
```

**Configuration Options:**
- `instances`: Number of instances (use `max` for cluster mode)
- `exec_mode`: `fork` (single process) or `cluster` (multi-process)
- `max_memory_restart`: Auto-restart if memory exceeds limit
- `kill_timeout`: Graceful shutdown timeout (10 seconds)
- `max_restarts`: Maximum restarts in 1 minute

### 2. Graceful Shutdown

**Implementation:** `backend/src/server.js`

The server handles graceful shutdown for:
- HTTP server (stops accepting new connections)
- Socket.IO server (closes WebSocket connections)
- MongoDB connection (closes database connection)
- Redis connection (closes cache connection)
- Background job workers (stops processing jobs)

**Shutdown signals:**
- `SIGTERM`: Standard termination signal (used by PM2, Docker, Kubernetes)
- `SIGINT`: Interrupt signal (Ctrl+C)

**Timeout:**
- 10 seconds for graceful shutdown
- Force close if timeout exceeded

### 3. Error Handling

**Uncaught exceptions and unhandled rejections:**
- Logged to Sentry (if configured)
- Graceful shutdown initiated
- Prevents zombie processes

### 4. Production Environment Variables

**Required:**
```env
NODE_ENV=production
MONGO_URL=mongodb://...
JWT_SECRET=...
```

**Recommended:**
```env
FRONTEND_URL=https://your-frontend.com
SENTRY_DSN=https://...
LOG_LEVEL=info
STRUCTURED_LOGGING=true
```

## Build Verification

### Frontend

1. **Check console statements:**
   ```bash
   # Build and check bundle
   npm run build:web
   # Search for console statements (should only find error/warn)
   grep -r "console\." dist/
   ```

2. **Verify source maps:**
   ```bash
   # Check for .map files
   find dist/ -name "*.map"
   ```

3. **Bundle size analysis:**
   ```bash
   npm run build:analyze
   ```

### Backend

1. **Test graceful shutdown:**
   ```bash
   # Start server
   pm2 start ecosystem.config.js
   
   # Send SIGTERM
   pm2 stop ecosystem.config.js
   
   # Check logs for graceful shutdown messages
   pm2 logs
   ```

2. **Verify PM2 configuration:**
   ```bash
   # Validate config
   pm2 ecosystem ecosystem.config.js
   
   # Start with validation
   pm2 start ecosystem.config.js --env production
   ```

## Performance Monitoring

### Frontend

- **Bundle size:** Monitor with `npm run build:analyze`
- **Load time:** Use browser DevTools Network tab
- **Runtime performance:** Use React DevTools Profiler

### Backend

- **Memory usage:** `pm2 monit` or `pm2 describe taatom-api`
- **CPU usage:** `pm2 monit`
- **Request latency:** Monitor with APM tools (New Relic, Datadog, etc.)
- **Error rate:** Monitor with Sentry or error tracking service

## Troubleshooting

### Frontend Build Issues

**Issue: Console statements still present**
- Verify `NODE_ENV=production` is set
- Check Babel config is being used
- Clear Metro cache: `expo start -c`

**Issue: Bundle size too large**
- Run bundle analyzer: `npm run build:analyze`
- Check for large dependencies
- Consider code splitting
- Remove unused dependencies

**Issue: Source maps not generated**
- Check Metro config
- Verify `sourceMap` option is enabled
- Check build output directory

### Backend Issues

**Issue: PM2 not starting**
- Check Node.js version compatibility
- Verify ecosystem.config.js syntax
- Check file paths in config

**Issue: Graceful shutdown not working**
- Verify shutdown handlers are registered
- Check timeout settings
- Review logs for shutdown errors

**Issue: Memory leaks**
- Monitor with `pm2 monit`
- Check for unclosed connections
- Review database connection pooling
- Check Redis connection management

## Best Practices

1. **Always test production builds locally before deployment**
2. **Monitor bundle sizes in CI/CD pipeline**
3. **Use source maps only for debugging, not in production**
4. **Set up PM2 monitoring and alerts**
5. **Test graceful shutdown in staging environment**
6. **Monitor memory and CPU usage regularly**
7. **Set appropriate memory limits for PM2**
8. **Use cluster mode for multi-core servers**
9. **Keep logs for debugging but rotate regularly**
10. **Set up alerts for high memory/CPU usage**

## CI/CD Integration

### Frontend

```yaml
# Example GitHub Actions
- name: Build and analyze
  run: |
    npm run build:web
    npm run build:analyze
```

### Backend

```yaml
# Example deployment script
- name: Deploy with PM2
  run: |
    pm2 start ecosystem.config.js --env production
    pm2 save
    pm2 startup
```

## Additional Resources

- [Expo Production Builds](https://docs.expo.dev/build/introduction/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Metro Bundler Configuration](https://facebook.github.io/metro/docs/configuration)
- [Babel Configuration](https://babeljs.io/docs/en/configuration)

