/**
 * Health Check Routes
 * Provides endpoints for monitoring system health
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const storageService = require('../services/storage/storage-service');
const { logger } = require('../utils/logger');
const os = require('os');
const redisClient = require('../utils/redis-client');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const paymentMonitoring = require('../services/payment-monitoring.service');
const alertService = require('../services/alert.service');
const healthChecker = require('../monitoring/health-checks');
const metricsCollector = require('../monitoring/metrics-collector');

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

    // Check Redis connection
    let redisStatus = 'UP';
    let redisError = null;
    let redisResponseTime = null;
    let redisDetails = {};

    try {
      const redisStartTime = Date.now();
      
      // Check if Redis has the new getStatus method
      if (redisClient.getStatus) {
        redisDetails = redisClient.getStatus();
        redisStatus = redisDetails.healthy ? 'UP' : 'DOWN';
        if (!redisDetails.healthy) {
          redisError = redisDetails.lastError || 'Redis unhealthy';
        }
      } else {
        // Fallback to ping
        await redisClient.ping();
      }
      
      redisResponseTime = Date.now() - redisStartTime;
    } catch (error) {
      redisStatus = 'DOWN';
      redisError = error.message;
      logger.error('Redis health check failed:', error);
    }

    // Check Stripe API connection
    let stripeStatus = 'UP';
    let stripeError = null;
    let stripeResponseTime = null;

    try {
      const stripeStartTime = Date.now();
      // Use a simple API call to check Stripe connectivity
      await stripe.paymentMethods.list({ limit: 1 });
      stripeResponseTime = Date.now() - stripeStartTime;
    } catch (error) {
      stripeStatus = 'DOWN';
      stripeError = error.message;
      logger.error('Stripe health check failed:', error);
    }

    // Get payment monitoring metrics
    let paymentMetrics = {};
    try {
      paymentMetrics = paymentMonitoring.getMetricsReport();
    } catch (error) {
      logger.error('Failed to get payment metrics:', error);
      paymentMetrics = { error: 'Failed to retrieve metrics' };
    }

    // Get alert service status
    let alertStatus = 'UP';
    let recentAlerts = [];
    try {
      recentAlerts = alertService.getAlertHistory(5);
      alertStatus = alertService.alertChannels.length > 0 ? 'UP' : 'NOT_CONFIGURED';
    } catch (error) {
      alertStatus = 'ERROR';
      logger.error('Failed to get alert status:', error);
    }

    // Get system information
    const systemInfo = {
      uptime: Math.floor(process.uptime()),
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024),
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
        percentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
      },
      cpu: {
        count: os.cpus().length,
        loadAverage: os.loadavg()
      },
      process: {
        pid: process.pid,
        version: process.version,
        memoryUsage: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        }
      }
    };

    // Determine overall status
    const overallStatus = dbStatus === 'UP' && storageStatus === 'UP' && redisStatus === 'UP' && stripeStatus === 'UP' ? 'UP' : 'DEGRADED';
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
        },
        redis: {
          status: redisStatus,
          responseTime: redisResponseTime ? `${redisResponseTime}ms` : null,
          error: redisError,
          ...(redisDetails.status && { details: redisDetails })
        },
        stripe: {
          status: stripeStatus,
          responseTime: stripeResponseTime ? `${stripeResponseTime}ms` : null,
          error: stripeError
        },
        alerting: {
          status: alertStatus,
          channelCount: alertService.alertChannels.length,
          recentAlerts: recentAlerts.length
        }
      },
      paymentMonitoring: paymentMetrics.summary || paymentMetrics,
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
router.get('/readiness', healthChecker.readinessCheck());

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
router.get('/liveness', healthChecker.livenessCheck());

/**
 * @swagger
 * /health/comprehensive:
 *   get:
 *     summary: Comprehensive health check
 *     description: Runs all system health checks and returns detailed status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All systems healthy or degraded
 *       503:
 *         description: One or more systems unhealthy
 */
router.get('/comprehensive', async (req, res) => {
  try {
    const results = await healthChecker.runAllHealthChecks();
    const status = results.status === healthChecker.HEALTH_STATUS.HEALTHY || 
                   results.status === healthChecker.HEALTH_STATUS.DEGRADED ? 200 : 503;
    res.status(status).json(results);
  } catch (error) {
    logger.error('Comprehensive health check failed:', error);
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

/**
 * Internal monitoring endpoint (protected)
 * Provides detailed metrics for internal monitoring systems
 */
router.get('/internal', async (req, res) => {
  try {
    // Check internal API key
    const providedKey = req.headers['x-internal-api-key'] || req.query.key;
    const expectedKey = process.env.INTERNAL_API_KEY;
    
    if (!expectedKey || providedKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get all detailed metrics
    const [dbPool, paymentReport, alertHistory] = await Promise.allSettled([
      db.dbPool.query('SELECT count(*) as connection_count FROM pg_stat_activity WHERE datname = current_database()'),
      Promise.resolve(paymentMonitoring.getMetricsReport()),
      Promise.resolve(alertService.getAlertHistory(20))
    ]);
    
    // Build detailed response
    const internalMetrics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      application: {
        version: process.env.npm_package_version || 'unknown',
        uptime: Math.floor(process.uptime()),
        pid: process.pid,
        nodeVersion: process.version
      },
      database: {
        activeConnections: dbPool.status === 'fulfilled' ? parseInt(dbPool.value.rows[0].connection_count) : null,
        poolSize: db.dbPool.totalCount,
        idleCount: db.dbPool.idleCount,
        waitingCount: db.dbPool.waitingCount
      },
      redis: redisClient.getStatus ? redisClient.getStatus() : { status: 'unknown' },
      payments: paymentReport.status === 'fulfilled' ? paymentReport.value : { error: 'Failed to get metrics' },
      alerts: {
        totalAlerts: alertHistory.status === 'fulfilled' ? alertHistory.value.length : 0,
        recentAlerts: alertHistory.status === 'fulfilled' ? alertHistory.value.slice(0, 5) : []
      },
      memory: {
        system: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        },
        process: process.memoryUsage()
      },
      cpu: {
        cores: os.cpus(),
        loadAverage: os.loadavg(),
        usage: process.cpuUsage()
      }
    };
    
    res.json(internalMetrics);
  } catch (error) {
    logger.error('Internal health check failed:', error);
    res.status(500).json({
      error: 'Internal health check failed',
      message: error.message
    });
  }
});

module.exports = router;
