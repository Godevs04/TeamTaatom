/**
 * Health Check Routes
 * Provides health monitoring endpoints for production use
 */

const express = require('express');
const router = express.Router();
const {
  basicHealthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
} = require('../controllers/healthController');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     description: Quick health check for load balancers and monitoring systems
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     environment:
 *                       type: string
 */
router.get('/', basicHealthCheck);

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check
 *     tags: [Health]
 *     description: |
 *       Comprehensive health check including all services (database, Redis, storage, etc.).
 *       Useful for monitoring and debugging service dependencies.
 *     responses:
 *       200:
 *         description: All services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "connected"
 *                         responseTime:
 *                           type: number
 *                           example: 5
 *                     redis:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "connected"
 *                     storage:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "accessible"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 3600
 *       503:
 *         description: Some services are unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 status:
 *                   type: string
 *                   example: "degraded"
 *                 services:
 *                   type: object
 */
router.get('/detailed', detailedHealthCheck);

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness check
 *     tags: [Health]
 *     description: |
 *       Kubernetes readiness probe - indicates if service is ready to accept traffic.
 *       Returns 200 if service can handle requests, 503 if not ready.
 *       
 *       **Use Cases:**
 *       - Kubernetes deployment readiness
 *       - Load balancer health checks
 *       - Service startup verification
 *     responses:
 *       200:
 *         description: Service is ready to accept traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ready:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Service is not ready (e.g., database connection failed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ready:
 *                   type: boolean
 *                   example: false
 *                 reason:
 *                   type: string
 *                   example: "Database connection failed"
 */
router.get('/ready', readinessCheck);

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness check
 *     tags: [Health]
 *     description: |
 *       Kubernetes liveness probe - indicates if service is alive and should not be restarted.
 *       Returns 200 if service is running, 500 if service should be restarted.
 *       
 *       **Use Cases:**
 *       - Kubernetes liveness probes
 *       - Service monitoring
 *       - Automatic restart detection
 *     responses:
 *       200:
 *         description: Service is alive and running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alive:
 *                   type: boolean
 *                   example: true
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Service is not alive (should be restarted)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alive:
 *                   type: boolean
 *                   example: false
 *                 reason:
 *                   type: string
 *                   example: "Service unresponsive"
 */
router.get('/live', livenessCheck);

module.exports = router;

