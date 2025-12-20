# Health Check Endpoints Guide - TeamTaatom

## Overview

The application provides comprehensive health check endpoints for production monitoring, load balancing, and orchestration systems (Kubernetes, Docker Swarm, etc.).

## Endpoints

### 1. Basic Health Check
**Endpoint:** `GET /health`

Quick health check for load balancers and monitoring systems. Returns minimal information with fast response time.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "ok",
    "timestamp": "2024-12-20T13:44:15.043Z",
    "uptime": 3600.5,
    "environment": "production"
  }
}
```

**Use Cases:**
- Load balancer health checks
- Basic monitoring
- Quick status verification

---

### 2. Detailed Health Check
**Endpoint:** `GET /health/detailed`

Comprehensive health check including all services (database, Redis, external services) and system metrics.

**Response (200 OK - All Healthy):**
```json
{
  "success": true,
  "message": "All services are healthy",
  "data": {
    "status": "healthy",
    "timestamp": "2024-12-20T13:44:15.043Z",
    "uptime": 3600.5,
    "environment": "production",
    "version": "1.0.0",
    "services": {
      "database": {
        "status": "healthy",
        "state": "connected",
        "name": "Taatom",
        "host": "localhost",
        "port": 27017,
        "stats": {
          "collections": 15,
          "dataSize": 1024,
          "storageSize": 2048,
          "indexes": 45,
          "indexSize": 512,
          "unit": "MB"
        }
      },
      "redis": {
        "status": "healthy",
        "host": "localhost",
        "port": 6379
      },
      "cloudinary": {
        "status": "configured",
        "cloudName": "taatom"
      },
      "s3": {
        "status": "configured",
        "bucket": "taatom-media"
      }
    },
    "system": {
      "memory": {
        "used": 256,
        "total": 512,
        "external": 128,
        "rss": 1024,
        "unit": "MB"
      },
      "cpu": {
        "usage": {
          "user": 1234567,
          "system": 2345678
        }
      },
      "nodeVersion": "v18.17.0",
      "platform": "linux",
      "arch": "x64"
    }
  }
}
```

**Response (503 Service Unavailable - Degraded):**
```json
{
  "success": false,
  "message": "Some services are unhealthy",
  "data": {
    "status": "degraded",
    "timestamp": "2024-12-20T13:44:15.043Z",
    "services": {
      "database": {
        "status": "healthy",
        "state": "connected"
      },
      "redis": {
        "status": "unhealthy",
        "error": "Connection refused"
      }
    }
  }
}
```

**Use Cases:**
- Comprehensive monitoring dashboards
- Detailed system diagnostics
- Service dependency monitoring

---

### 3. Readiness Check
**Endpoint:** `GET /health/ready`

Kubernetes readiness probe - indicates if the service is ready to accept traffic. Checks critical dependencies (database, Redis).

**Response (200 OK - Ready):**
```json
{
  "success": true,
  "message": "Service is ready",
  "data": {
    "status": "ready",
    "timestamp": "2024-12-20T13:44:15.043Z",
    "database": "ready",
    "redis": "ready"
  }
}
```

**Response (503 Service Unavailable - Not Ready):**
```json
{
  "success": false,
  "message": "Service is not ready",
  "data": {
    "status": "not_ready",
    "timestamp": "2024-12-20T13:44:15.043Z",
    "database": "ready",
    "redis": "not_ready"
  }
}
```

**Use Cases:**
- Kubernetes readiness probes
- Service startup verification
- Traffic routing decisions

---

### 4. Liveness Check
**Endpoint:** `GET /health/live`

Kubernetes liveness probe - indicates if the service process is alive.

**Response (200 OK - Alive):**
```json
{
  "success": true,
  "message": "Service is alive",
  "data": {
    "status": "alive",
    "timestamp": "2024-12-20T13:44:15.043Z",
    "uptime": 3600.5
  }
}
```

**Use Cases:**
- Kubernetes liveness probes
- Process monitoring
- Container restart triggers

---

## Status Codes

| Status Code | Meaning |
|------------|---------|
| 200 | Service is healthy/ready/alive |
| 500 | Service is not alive (liveness check) |
| 503 | Service is unhealthy/not ready (readiness check) |

## Health Status Values

### Overall Status
- `healthy` - All services are operational
- `degraded` - Some non-critical services are down, but core functionality works
- `unhealthy` - Critical services are down

### Service Status
- `healthy` - Service is operational
- `unhealthy` - Service is not operational
- `configured` - Service configuration is present (for external services)

### Database State
- `connected` - Database is connected and ready
- `connecting` - Database connection in progress
- `disconnected` - Database is not connected
- `disconnecting` - Database disconnection in progress

## Integration Examples

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taatom-api
spec:
  template:
    spec:
      containers:
      - name: api
        image: taatom/api:latest
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
```

### Docker Compose Health Check

```yaml
services:
  api:
    image: taatom/api:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Load Balancer Configuration (Nginx)

```nginx
upstream taatom_api {
    server api1:3000;
    server api2:3000;
    
    # Health check
    check interval=3000 rise=2 fall=3 timeout=1000;
}

server {
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### Monitoring (Prometheus)

```yaml
scrape_configs:
  - job_name: 'taatom-api'
    metrics_path: '/health/detailed'
    static_configs:
      - targets: ['api:3000']
```

### AWS Application Load Balancer

```json
{
  "HealthCheckProtocol": "HTTP",
  "HealthCheckPath": "/health",
  "HealthCheckIntervalSeconds": 30,
  "HealthCheckTimeoutSeconds": 5,
  "HealthyThresholdCount": 2,
  "UnhealthyThresholdCount": 3
}
```

## Best Practices

1. **Use Basic Health Check for Load Balancers**
   - Fast response time
   - Minimal resource usage
   - High frequency checks (every 5-10 seconds)

2. **Use Detailed Health Check for Monitoring**
   - Comprehensive diagnostics
   - Lower frequency (every 30-60 seconds)
   - Alert on degraded/unhealthy status

3. **Use Readiness Check for Orchestration**
   - Kubernetes/Docker Swarm
   - Service startup verification
   - Traffic routing decisions

4. **Use Liveness Check for Process Monitoring**
   - Container restart triggers
   - Process health verification
   - High frequency checks

5. **Monitor Response Times**
   - Health checks should respond quickly (< 100ms for basic, < 500ms for detailed)
   - Alert if health check response time increases

6. **Security Considerations**
   - Health check endpoints are public (no authentication required)
   - Don't expose sensitive information in health check responses
   - Consider rate limiting for health check endpoints

## Troubleshooting

### Service Returns 503 (Unhealthy)
1. Check database connection: `GET /health/detailed`
2. Check Redis connection: `GET /health/detailed`
3. Review application logs for errors
4. Verify environment variables are set correctly

### Service Returns 500 (Not Alive)
1. Check if process is running
2. Check system resources (memory, CPU)
3. Review application logs for crashes
4. Verify container/pod is not being killed by OOM killer

### Health Check Timeout
1. Check network connectivity
2. Verify firewall rules allow health check traffic
3. Check if application is overloaded
4. Review response time metrics

## API Versioning

Health check endpoints are available at:
- `/health` (root level)
- `/api/v1/health` (versioned API)

Both endpoints provide the same functionality.

