// src/services/system-monitoring.service.js
const { logger } = require('../utils/logger');
const os = require('os');
const { monitoringRepository } = require('../repositories');
const { metrics } = require('../utils/metrics');

class SystemMonitoringService {
  constructor() {
    this.healthStatus = {
      overall: 'healthy',
      components: {},
      lastCheck: null
    };
    
    this.performanceMetrics = {
      apiResponseTimes: [],
      dbQueryTimes: [],
      queueProcessingTimes: []
    };
    
    this.errorStats = {
      byType: {},
      recent: [],
      critical: []
    };
    
    this.alertThresholds = {
      memoryUsagePercent: 85,
      cpuUsagePercent: 90,
      errorRatePerMinute: 10,
      responseTimeMs: 3000,
      dbConnectionPoolUsage: 90,
      queueBacklog: 100
    };
    
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds cache
    
    // Start periodic health checks
    this.startHealthChecks();
  }

  /**
   * Get overall system health status
   */
  async getSystemHealth() {
    const cacheKey = 'system-health';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        components: {}
      };

      // Check each component
      const componentChecks = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.checkQueueHealth(),
        this.checkMemoryUsage(),
        this.checkCPUUsage(),
        this.checkDiskSpace()
      ]);

      const components = [
        'database',
        'redis',
        'queue',
        'memory',
        'cpu',
        'disk'
      ];

      componentChecks.forEach((result, index) => {
        const componentName = components[index];
        if (result.status === 'fulfilled') {
          health.components[componentName] = result.value;
          if (result.value.status !== 'healthy') {
            health.status = 'degraded';
          }
        } else {
          health.components[componentName] = {
            status: 'error',
            message: result.reason.message
          };
          health.status = 'critical';
        }
      });

      // Add payment system health
      const paymentHealth = await this.getPaymentSystemHealth();
      health.components.payments = paymentHealth;
      if (paymentHealth.status !== 'healthy') {
        health.status = health.status === 'critical' ? 'critical' : 'degraded';
      }

      this.setCached(cacheKey, health);
      this.healthStatus = health;
      
      return health;
    } catch (error) {
      logger.error('Error getting system health:', error);
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth() {
    try {
      const db = require('../db');
      const pool = db.getPool();
      
      const startTime = Date.now();
      const result = await pool.query('SELECT 1');
      const queryTime = Date.now() - startTime;
      
      const poolStats = {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      };
      
      const usagePercent = ((poolStats.total - poolStats.idle) / poolStats.total) * 100;
      
      return {
        status: queryTime < 100 && usagePercent < this.alertThresholds.dbConnectionPoolUsage ? 'healthy' : 'degraded',
        responseTime: queryTime,
        pool: poolStats,
        usagePercent: Math.round(usagePercent)
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Check Redis health
   */
  async checkRedisHealth() {
    try {
      const redisClient = require('../utils/redis-client');
      const startTime = Date.now();
      
      // Test Redis connection
      await new Promise((resolve, reject) => {
        redisClient.ping((err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
      
      const responseTime = Date.now() - startTime;
      
      // Get Redis info
      const info = await new Promise((resolve, reject) => {
        redisClient.info((err, info) => {
          if (err) reject(err);
          else resolve(info);
        });
      });
      
      // Parse memory usage from Redis info
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const connectedClients = info.match(/connected_clients:(\d+)/);
      
      return {
        status: responseTime < 50 ? 'healthy' : 'degraded',
        responseTime,
        memoryUsage: memoryMatch ? memoryMatch[1].trim() : 'unknown',
        connectedClients: connectedClients ? parseInt(connectedClients[1]) : 0
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Check queue system health
   */
  async checkQueueHealth() {
    try {
      const queueMonitorService = require('./queue-monitor.service');
      const health = await queueMonitorService.getHealthStatus();
      
      // Get additional queue metrics
      const queueMetrics = await monitoringRepository.getQueueHealth();
      
      return {
        status: health.status,
        queueLength: health.queueLength || 0,
        activeJobs: health.activeJobs || 0,
        failureRate: queueMetrics.failure_rate_percent || 0,
        avgProcessingTime: Math.round(queueMetrics.avg_processing_time_ms || 0),
        checks: health.checks || []
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Check memory usage
   */
  async checkMemoryUsage() {
    try {
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const usagePercent = (usedMemory / totalMemory) * 100;
      
      const processMemory = process.memoryUsage();
      
      return {
        status: usagePercent < this.alertThresholds.memoryUsagePercent ? 'healthy' : 'degraded',
        system: {
          total: Math.round(totalMemory / 1024 / 1024),
          free: Math.round(freeMemory / 1024 / 1024),
          used: Math.round(usedMemory / 1024 / 1024),
          usagePercent: Math.round(usagePercent)
        },
        process: {
          rss: Math.round(processMemory.rss / 1024 / 1024),
          heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024),
          heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024),
          external: Math.round(processMemory.external / 1024 / 1024)
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Check CPU usage
   */
  async checkCPUUsage() {
    try {
      const cpus = os.cpus();
      const loadAverage = os.loadavg();
      
      // Calculate CPU usage percentage (rough estimate)
      const cpuCount = cpus.length;
      const load1min = loadAverage[0];
      const usagePercent = (load1min / cpuCount) * 100;
      
      return {
        status: usagePercent < this.alertThresholds.cpuUsagePercent ? 'healthy' : 'degraded',
        cores: cpuCount,
        loadAverage: {
          '1min': loadAverage[0].toFixed(2),
          '5min': loadAverage[1].toFixed(2),
          '15min': loadAverage[2].toFixed(2)
        },
        usagePercent: Math.round(usagePercent)
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Check disk space
   */
  async checkDiskSpace() {
    try {
      // This is a simplified check - in production, you might use a library like 'diskusage'
      // For now, we'll return a placeholder
      return {
        status: 'healthy',
        message: 'Disk space monitoring not implemented'
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Get payment system health
   */
  async getPaymentSystemHealth() {
    try {
      const paymentMonitoring = require('./payment-monitoring.service');
      const report = paymentMonitoring.getMetricsReport();
      
      const failureRate = report.summary.failureRate;
      const avgProcessingTime = report.summary.averageProcessingTime;
      const consecutiveFailures = report.consecutiveFailures;
      
      let status = 'healthy';
      const issues = [];
      
      if (failureRate > 0.15) {
        status = 'critical';
        issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
      } else if (failureRate > 0.10) {
        status = 'degraded';
        issues.push(`Elevated failure rate: ${(failureRate * 100).toFixed(1)}%`);
      }
      
      if (avgProcessingTime > 10000) {
        status = status === 'healthy' ? 'degraded' : status;
        issues.push(`Slow processing: ${(avgProcessingTime / 1000).toFixed(1)}s avg`);
      }
      
      if (consecutiveFailures >= 5) {
        status = 'critical';
        issues.push(`${consecutiveFailures} consecutive failures`);
      }
      
      return {
        status,
        metrics: {
          successRate: ((1 - failureRate) * 100).toFixed(1),
          failureRate: (failureRate * 100).toFixed(1),
          avgProcessingTime: Math.round(avgProcessingTime),
          totalPayments: report.summary.totalPayments,
          revenue: report.summary.totalRevenue
        },
        issues
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Get queue status and statistics
   */
  async getQueueStatus() {
    const cacheKey = 'queue-status';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Get queue metrics from monitoring repository
      const [currentHealth, recentMetrics, summary] = await Promise.all([
        monitoringRepository.getQueueHealth(),
        monitoringRepository.getQueueMetrics('1 hour'),
        monitoringRepository.getMetricsSummary('24 hours')
      ]);

      // Get stuck applications
      const stuckApplications = await monitoringRepository.getStuckApplications(1);

      const status = {
        current: {
          queued: currentHealth.currently_queued || 0,
          processing: currentHealth.currently_processing || 0,
          completed: currentHealth.completed_count || 0,
          failed: currentHealth.failed_count || 0,
          failureRate: parseFloat(currentHealth.failure_rate_percent || 0),
          avgWaitTime: Math.round(currentHealth.avg_wait_time_ms || 0),
          avgProcessingTime: Math.round(currentHealth.avg_processing_time_ms || 0)
        },
        hourly: recentMetrics.map(m => ({
          timestamp: m.created_at,
          queueLength: m.queue_length,
          activeJobs: m.active_jobs,
          completed: m.total_completed,
          failed: m.total_failed
        })),
        daily: {
          avgQueueLength: Math.round(summary.avg_queue_length || 0),
          maxQueueLength: summary.max_queue_length || 0,
          totalCompleted: summary.total_completed || 0,
          totalFailed: summary.total_failed || 0,
          avgWaitTime: Math.round(summary.avg_wait_time_ms || 0),
          avgProcessingTime: Math.round(summary.avg_processing_time_ms || 0)
        },
        stuck: stuckApplications.map(app => ({
          id: app.id,
          status: app.status,
          hoursSinceUpdate: parseFloat(app.hours_since_update).toFixed(1),
          createdAt: app.created_at
        }))
      };

      this.setCached(cacheKey, status);
      return status;
    } catch (error) {
      logger.error('Error getting queue status:', error);
      throw error;
    }
  }

  /**
   * Get email delivery statistics
   */
  async getEmailStats() {
    const cacheKey = 'email-stats';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const db = require('../db');
      
      // Get email statistics from the database
      const query = `
        SELECT 
          COUNT(*) as total_sent,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as sent_24h,
          COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as sent_1h
        FROM email_logs
        WHERE created_at > NOW() - INTERVAL '7 days'
      `;
      
      const { rows } = await db.query(query);
      const stats = rows[0] || {};
      
      // Get email types breakdown
      const typeQuery = `
        SELECT 
          email_type,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful
        FROM email_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY email_type
      `;
      
      const { rows: typeRows } = await db.query(typeQuery);
      
      const result = {
        summary: {
          totalSent: parseInt(stats.total_sent || 0),
          successful: parseInt(stats.successful || 0),
          failed: parseInt(stats.failed || 0),
          bounced: parseInt(stats.bounced || 0),
          deliveryRate: stats.total_sent > 0 
            ? ((stats.successful / stats.total_sent) * 100).toFixed(1) 
            : 100
        },
        recent: {
          last24h: parseInt(stats.sent_24h || 0),
          lastHour: parseInt(stats.sent_1h || 0)
        },
        byType: typeRows.reduce((acc, row) => {
          acc[row.email_type] = {
            count: parseInt(row.count),
            successful: parseInt(row.successful),
            successRate: row.count > 0 
              ? ((row.successful / row.count) * 100).toFixed(1) 
              : 100
          };
          return acc;
        }, {})
      };

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Error getting email stats:', error);
      return {
        summary: {
          totalSent: 0,
          successful: 0,
          failed: 0,
          bounced: 0,
          deliveryRate: 100
        },
        recent: {
          last24h: 0,
          lastHour: 0
        },
        byType: {}
      };
    }
  }

  /**
   * Get PDF generation statistics
   */
  async getPdfStats() {
    const cacheKey = 'pdf-stats';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const db = require('../db');
      
      // Get PDF generation statistics
      const query = `
        SELECT 
          COUNT(*) as total_generated,
          COUNT(CASE WHEN queue_status = 'completed' THEN 1 END) as successful,
          COUNT(CASE WHEN queue_status = 'failed' THEN 1 END) as failed,
          AVG(CASE WHEN queue_duration_ms IS NOT NULL THEN queue_duration_ms END) as avg_generation_time,
          MAX(queue_duration_ms) as max_generation_time,
          MIN(CASE WHEN queue_duration_ms > 0 THEN queue_duration_ms END) as min_generation_time,
          COUNT(CASE WHEN queue_completed_at > NOW() - INTERVAL '24 hours' THEN 1 END) as generated_24h,
          COUNT(CASE WHEN queue_completed_at > NOW() - INTERVAL '1 hour' THEN 1 END) as generated_1h
        FROM permit_applications
        WHERE queue_status IN ('completed', 'failed')
          AND queue_completed_at > NOW() - INTERVAL '7 days'
      `;
      
      const { rows } = await db.query(query);
      const stats = rows[0] || {};
      
      // Get failure reasons
      const failureQuery = `
        SELECT 
          queue_error_message,
          COUNT(*) as count
        FROM permit_applications
        WHERE queue_status = 'failed'
          AND queue_completed_at > NOW() - INTERVAL '24 hours'
          AND queue_error_message IS NOT NULL
        GROUP BY queue_error_message
        ORDER BY count DESC
        LIMIT 10
      `;
      
      const { rows: failureRows } = await db.query(failureQuery);
      
      const result = {
        summary: {
          totalGenerated: parseInt(stats.total_generated || 0),
          successful: parseInt(stats.successful || 0),
          failed: parseInt(stats.failed || 0),
          successRate: stats.total_generated > 0 
            ? ((stats.successful / stats.total_generated) * 100).toFixed(1) 
            : 100,
          avgGenerationTime: Math.round(stats.avg_generation_time || 0),
          maxGenerationTime: Math.round(stats.max_generation_time || 0),
          minGenerationTime: Math.round(stats.min_generation_time || 0)
        },
        recent: {
          last24h: parseInt(stats.generated_24h || 0),
          lastHour: parseInt(stats.generated_1h || 0)
        },
        failureReasons: failureRows.map(row => ({
          reason: row.queue_error_message,
          count: parseInt(row.count)
        }))
      };

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Error getting PDF stats:', error);
      return {
        summary: {
          totalGenerated: 0,
          successful: 0,
          failed: 0,
          successRate: 100,
          avgGenerationTime: 0,
          maxGenerationTime: 0,
          minGenerationTime: 0
        },
        recent: {
          last24h: 0,
          lastHour: 0
        },
        failureReasons: []
      };
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    const cacheKey = 'database-stats';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const db = require('../db');
      const pool = db.getPool();
      
      // Get connection pool stats
      const poolStats = {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        maxConnections: pool.options.max
      };
      
      // Get database size and table stats
      const sizeQuery = `
        SELECT 
          pg_database_size(current_database()) as db_size,
          (SELECT COUNT(*) FROM permit_applications) as total_applications,
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM payments) as total_payments
      `;
      
      const { rows } = await db.query(sizeQuery);
      const dbStats = rows[0] || {};
      
      // Get slow query stats (if available)
      const performanceQuery = `
        SELECT 
          COUNT(*) as query_count,
          AVG(duration) as avg_duration,
          MAX(duration) as max_duration
        FROM query_logs
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `;
      
      let queryPerformance = {
        queryCount: 0,
        avgDuration: 0,
        maxDuration: 0
      };
      
      try {
        const { rows: perfRows } = await db.query(performanceQuery);
        if (perfRows[0]) {
          queryPerformance = {
            queryCount: parseInt(perfRows[0].query_count || 0),
            avgDuration: parseFloat(perfRows[0].avg_duration || 0),
            maxDuration: parseFloat(perfRows[0].max_duration || 0)
          };
        }
      } catch (e) {
        // Query logs table might not exist
      }
      
      const result = {
        connectionPool: {
          ...poolStats,
          usagePercent: Math.round((poolStats.total - poolStats.idle) / poolStats.total * 100)
        },
        size: {
          totalSize: Math.round(parseInt(dbStats.db_size || 0) / 1024 / 1024), // MB
          tables: {
            applications: parseInt(dbStats.total_applications || 0),
            users: parseInt(dbStats.total_users || 0),
            payments: parseInt(dbStats.total_payments || 0)
          }
        },
        performance: queryPerformance
      };

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Error getting database stats:', error);
      return {
        connectionPool: {
          total: 0,
          idle: 0,
          waiting: 0,
          maxConnections: 0,
          usagePercent: 0
        },
        size: {
          totalSize: 0,
          tables: {
            applications: 0,
            users: 0,
            payments: 0
          }
        },
        performance: {
          queryCount: 0,
          avgDuration: 0,
          maxDuration: 0
        }
      };
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats() {
    const cacheKey = 'error-stats';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Get error stats from logs or error tracking table
      const db = require('../db');
      
      const query = `
        SELECT 
          error_type,
          error_code,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM error_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY error_type, error_code
        ORDER BY count DESC
        LIMIT 20
      `;
      
      let errorsByType = {};
      let recentErrors = [];
      
      try {
        const { rows } = await db.query(query);
        errorsByType = rows.reduce((acc, row) => {
          const key = row.error_type || 'unknown';
          if (!acc[key]) acc[key] = 0;
          acc[key] += parseInt(row.count);
          return acc;
        }, {});
        
        recentErrors = rows.map(row => ({
          type: row.error_type,
          code: row.error_code,
          count: parseInt(row.count),
          lastOccurrence: row.last_occurrence
        }));
      } catch (e) {
        // Error logs table might not exist
        logger.debug('Error logs table not available');
      }
      
      // Add in-memory error stats
      const memoryErrors = this.errorStats;
      
      const result = {
        summary: {
          total24h: Object.values(errorsByType).reduce((sum, count) => sum + count, 0),
          criticalErrors: memoryErrors.critical.length,
          uniqueErrorTypes: Object.keys(errorsByType).length
        },
        byType: errorsByType,
        recent: recentErrors,
        critical: memoryErrors.critical.slice(-10) // Last 10 critical errors
      };

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Error getting error stats:', error);
      return {
        summary: {
          total24h: 0,
          criticalErrors: 0,
          uniqueErrorTypes: 0
        },
        byType: {},
        recent: [],
        critical: []
      };
    }
  }

  /**
   * Get comprehensive system metrics
   */
  async getSystemMetrics() {
    try {
      const [
        health,
        queueStatus,
        emailStats,
        pdfStats,
        dbStats,
        errorStats
      ] = await Promise.allSettled([
        this.getSystemHealth(),
        this.getQueueStatus(),
        this.getEmailStats(),
        this.getPdfStats(),
        this.getDatabaseStats(),
        this.getErrorStats()
      ]);

      return {
        timestamp: new Date().toISOString(),
        health: health.status === 'fulfilled' ? health.value : { status: 'error' },
        queue: queueStatus.status === 'fulfilled' ? queueStatus.value : {},
        email: emailStats.status === 'fulfilled' ? emailStats.value : {},
        pdf: pdfStats.status === 'fulfilled' ? pdfStats.value : {},
        database: dbStats.status === 'fulfilled' ? dbStats.value : {},
        errors: errorStats.status === 'fulfilled' ? errorStats.value : {}
      };
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      throw error;
    }
  }

  /**
   * Record an API response time
   */
  recordApiResponseTime(endpoint, method, responseTime) {
    this.performanceMetrics.apiResponseTimes.push({
      endpoint,
      method,
      responseTime,
      timestamp: Date.now()
    });

    // Keep only last 1000 entries
    if (this.performanceMetrics.apiResponseTimes.length > 1000) {
      this.performanceMetrics.apiResponseTimes.shift();
    }

    // Check if response time exceeds threshold
    if (responseTime > this.alertThresholds.responseTimeMs) {
      this.recordError('performance', 'SLOW_API_RESPONSE', {
        endpoint,
        method,
        responseTime
      });
    }
  }

  /**
   * Record a database query time
   */
  recordDbQueryTime(query, duration) {
    this.performanceMetrics.dbQueryTimes.push({
      query: query.substring(0, 100), // First 100 chars
      duration,
      timestamp: Date.now()
    });

    // Keep only last 1000 entries
    if (this.performanceMetrics.dbQueryTimes.length > 1000) {
      this.performanceMetrics.dbQueryTimes.shift();
    }
  }

  /**
   * Record an error
   */
  recordError(type, code, details, severity = 'error') {
    const error = {
      type,
      code,
      details,
      severity,
      timestamp: Date.now()
    };

    // Update error stats
    const key = `${type}:${code}`;
    if (!this.errorStats.byType[key]) {
      this.errorStats.byType[key] = 0;
    }
    this.errorStats.byType[key]++;

    // Add to recent errors
    this.errorStats.recent.push(error);
    if (this.errorStats.recent.length > 100) {
      this.errorStats.recent.shift();
    }

    // Add to critical errors if severity is critical
    if (severity === 'critical') {
      this.errorStats.critical.push(error);
      if (this.errorStats.critical.length > 50) {
        this.errorStats.critical.shift();
      }
    }

    // Check if we need to send alerts
    this.checkErrorRateAlerts();
  }

  /**
   * Check if error rate exceeds threshold
   */
  checkErrorRateAlerts() {
    const oneMinuteAgo = Date.now() - 60000;
    const recentErrors = this.errorStats.recent.filter(e => e.timestamp > oneMinuteAgo);
    
    if (recentErrors.length > this.alertThresholds.errorRatePerMinute) {
      this.sendAlert('HIGH_ERROR_RATE', {
        errorCount: recentErrors.length,
        timeWindow: '1 minute',
        threshold: this.alertThresholds.errorRatePerMinute
      });
    }
  }

  /**
   * Send system alert
   */
  async sendAlert(alertType, details) {
    try {
      const alertService = require('./alert.service');
      
      const severity = alertType === 'CRITICAL_ERROR' || alertType === 'SYSTEM_DOWN' 
        ? 'CRITICAL' 
        : 'HIGH';
      
      await alertService.sendSystemAlert(
        `System Alert: ${alertType}`,
        `System monitoring detected: ${alertType}`,
        details,
        severity
      );
      
      logger.error(`SYSTEM ALERT: ${alertType}`, details);
    } catch (error) {
      logger.error('Failed to send system alert:', error);
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    // Check system health every minute
    setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        
        // Log if system is degraded or critical
        if (health.status !== 'healthy') {
          logger.warn('System health check:', health);
          
          // Send alert for critical status
          if (health.status === 'critical') {
            await this.sendAlert('SYSTEM_CRITICAL', health);
          }
        }
      } catch (error) {
        logger.error('Error in periodic health check:', error);
      }
    }, 60000); // 1 minute
  }

  /**
   * Get cached value
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cached value
   */
  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
module.exports = new SystemMonitoringService();