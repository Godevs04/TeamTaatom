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
 *     description: Comprehensive health check including all services (database, Redis, etc.)
 *     responses:
 *       200:
 *         description: All services are healthy
 *       503:
 *         description: Some services are unhealthy
 */
router.get('/detailed', detailedHealthCheck);

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness check
 *     tags: [Health]
 *     description: Kubernetes readiness probe - indicates if service is ready to accept traffic
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', readinessCheck);

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness check
 *     tags: [Health]
 *     description: Kubernetes liveness probe - indicates if service is alive
 *     responses:
 *       200:
 *         description: Service is alive
 *       500:
 *         description: Service is not alive
 */
router.get('/live', livenessCheck);

module.exports = router;

