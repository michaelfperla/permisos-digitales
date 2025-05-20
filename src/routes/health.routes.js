/**
 * Health Check Routes
 * Provides endpoints for monitoring system health
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const storageService = require('../services/storage.service');
const { logger } = require('../utils/enhanced-logger');
const os = require('os');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Returns a simple status indicating the API is running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: UP
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/', async (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /health/details:
 *   get:
 *     summary: Detailed health check
 *     description: Returns detailed health information about system components
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health status
 *       503:
 *         description: Service unavailable
 */
router.get('/details', async (req, res) => {
  try {
    // Check database connection
    const dbStartTime = Date.now();
    let dbStatus = 'UP';
    let dbResponseTime = null;
    let dbError = null;

    try {
      const dbResult = await db.query('SELECT 1 as health_check');
      dbResponseTime = Date.now() - dbStartTime;
      dbStatus = dbResult.rows[0]?.health_check === 1 ? 'UP' : 'DOWN';
    } catch (error) {
      dbStatus = 'DOWN';
      dbError = error.message;
      logger.error('Database health check failed:', error);
    }

    // Check storage service
    let storageStatus = 'UP';
    let storageError = null;
    
    try {
      await storageService.ensureDirectoryExists(storageService.baseDir);
    } catch (error) {
      storageStatus = 'DOWN';
      storageError = error.message;
      logger.error('Storage health check failed:', error);
    }

    // Get system information
    const systemInfo = {
      uptime: Math.floor(process.uptime()),
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024),
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)
      },
      cpu: os.cpus().length
    };

    // Determine overall status
    const overallStatus = dbStatus === 'UP' && storageStatus === 'UP' ? 'UP' : 'DOWN';
    const statusCode = overallStatus === 'UP' ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      components: {
        database: {
          status: dbStatus,
          responseTime: dbResponseTime ? `${dbResponseTime}ms` : null,
          error: dbError
        },
        storage: {
          status: storageStatus,
          path: storageService.baseDir,
          error: storageError
        }
      },
      system: systemInfo
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /health/readiness:
 *   get:
 *     summary: Readiness probe
 *     description: Checks if the application is ready to serve traffic
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is ready
 *       503:
 *         description: Application is not ready
 */
router.get('/readiness', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    res.status(200).json({
      status: 'READY',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'NOT_READY',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /health/liveness:
 *   get:
 *     summary: Liveness probe
 *     description: Checks if the application is alive and running
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is alive
 */
router.get('/liveness', (req, res) => {
  res.status(200).json({
    status: 'ALIVE',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

module.exports = router;
