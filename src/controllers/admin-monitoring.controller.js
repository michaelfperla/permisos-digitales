// src/controllers/admin-monitoring.controller.js
const systemMonitoringService = require('../services/system-monitoring.service');
const { logger } = require('../utils/logger');
const { apiResponse } = require('../utils/api-response');

class AdminMonitoringController {
  /**
   * Get overall system health status
   */
  async getSystemHealth(req, res) {
    try {
      const health = await systemMonitoringService.getSystemHealth();
      
      return apiResponse.success(res, health, 'System health retrieved successfully');
    } catch (error) {
      logger.error('Error getting system health:', error);
      return apiResponse.error(res, 'Failed to retrieve system health', 500);
    }
  }

  /**
   * Get queue status and statistics
   */
  async getQueueStatus(req, res) {
    try {
      const queueStatus = await systemMonitoringService.getQueueStatus();
      
      return apiResponse.success(res, queueStatus, 'Queue status retrieved successfully');
    } catch (error) {
      logger.error('Error getting queue status:', error);
      return apiResponse.error(res, 'Failed to retrieve queue status', 500);
    }
  }

  /**
   * Get comprehensive system metrics
   */
  async getSystemMetrics(req, res) {
    try {
      const metrics = await systemMonitoringService.getSystemMetrics();
      
      return apiResponse.success(res, metrics, 'System metrics retrieved successfully');
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      return apiResponse.error(res, 'Failed to retrieve system metrics', 500);
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(req, res) {
    try {
      const errorStats = await systemMonitoringService.getErrorStats();
      
      return apiResponse.success(res, errorStats, 'Error statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting error stats:', error);
      return apiResponse.error(res, 'Failed to retrieve error statistics', 500);
    }
  }

  /**
   * Get email delivery statistics
   */
  async getEmailStats(req, res) {
    try {
      const emailStats = await systemMonitoringService.getEmailStats();
      
      return apiResponse.success(res, emailStats, 'Email statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting email stats:', error);
      return apiResponse.error(res, 'Failed to retrieve email statistics', 500);
    }
  }

  /**
   * Get PDF generation statistics
   */
  async getPdfStats(req, res) {
    try {
      const pdfStats = await systemMonitoringService.getPdfStats();
      
      return apiResponse.success(res, pdfStats, 'PDF statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting PDF stats:', error);
      return apiResponse.error(res, 'Failed to retrieve PDF statistics', 500);
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(req, res) {
    try {
      const dbStats = await systemMonitoringService.getDatabaseStats();
      
      return apiResponse.success(res, dbStats, 'Database statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting database stats:', error);
      return apiResponse.error(res, 'Failed to retrieve database statistics', 500);
    }
  }

  /**
   * Get payment system metrics
   */
  async getPaymentMetrics(req, res) {
    try {
      const paymentMonitoring = require('../services/payment-monitoring.service');
      const metrics = paymentMonitoring.getMetricsReport();
      
      return apiResponse.success(res, metrics, 'Payment metrics retrieved successfully');
    } catch (error) {
      logger.error('Error getting payment metrics:', error);
      return apiResponse.error(res, 'Failed to retrieve payment metrics', 500);
    }
  }

  /**
   * Get real-time system status
   */
  async getRealtimeStatus(req, res) {
    try {
      const os = require('os');
      const process = require('process');
      
      // Get active sessions count
      const sessionCount = await this.getActiveSessionCount();
      
      // Get current request rate (simplified - in production use a proper metrics library)
      const requestRate = await this.getCurrentRequestRate();
      
      const realtimeStatus = {
        timestamp: new Date().toISOString(),
        uptime: {
          process: process.uptime(),
          system: os.uptime()
        },
        memory: {
          process: process.memoryUsage(),
          system: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
          }
        },
        cpu: {
          cores: os.cpus().length,
          loadAverage: os.loadavg(),
          model: os.cpus()[0].model
        },
        connections: {
          activeSessions: sessionCount,
          requestsPerSecond: requestRate
        },
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform
      };
      
      return apiResponse.success(res, realtimeStatus, 'Real-time status retrieved successfully');
    } catch (error) {
      logger.error('Error getting real-time status:', error);
      return apiResponse.error(res, 'Failed to retrieve real-time status', 500);
    }
  }

  /**
   * Clear monitoring cache
   */
  async clearCache(req, res) {
    try {
      systemMonitoringService.clearCache();
      
      return apiResponse.success(res, null, 'Monitoring cache cleared successfully');
    } catch (error) {
      logger.error('Error clearing cache:', error);
      return apiResponse.error(res, 'Failed to clear monitoring cache', 500);
    }
  }

  /**
   * Get active session count
   */
  async getActiveSessionCount() {
    try {
      const redisClient = require('../utils/redis-client');
      
      return new Promise((resolve) => {
        redisClient.keys('sess:*', (err, keys) => {
          if (err) {
            logger.error('Error counting sessions:', err);
            resolve(0);
          } else {
            resolve(keys ? keys.length : 0);
          }
        });
      });
    } catch (error) {
      logger.error('Error getting session count:', error);
      return 0;
    }
  }

  /**
   * Get current request rate (simplified implementation)
   */
  async getCurrentRequestRate() {
    try {
      // In production, you would use a proper metrics library
      // This is a simplified implementation
      const db = require('../db');
      
      const query = `
        SELECT COUNT(*) as request_count
        FROM request_logs
        WHERE created_at > NOW() - INTERVAL '1 minute'
      `;
      
      const { rows } = await db.query(query);
      const requestCount = parseInt(rows[0]?.request_count || 0);
      
      return Math.round(requestCount / 60); // Requests per second
    } catch (error) {
      // Request logs might not exist
      return 0;
    }
  }

  /**
   * Test alert system
   */
  async testAlert(req, res) {
    try {
      const { type, message } = req.body;
      
      if (!type || !message) {
        return apiResponse.error(res, 'Alert type and message are required', 400);
      }
      
      await systemMonitoringService.sendAlert(type, {
        message,
        test: true,
        timestamp: new Date().toISOString()
      });
      
      return apiResponse.success(res, null, 'Test alert sent successfully');
    } catch (error) {
      logger.error('Error sending test alert:', error);
      return apiResponse.error(res, 'Failed to send test alert', 500);
    }
  }

  /**
   * Get monitoring dashboard data (all metrics in one call)
   */
  async getDashboardData(req, res) {
    try {
      const [
        systemHealth,
        queueStatus,
        paymentMetrics,
        realtimeStatus
      ] = await Promise.all([
        systemMonitoringService.getSystemHealth(),
        systemMonitoringService.getQueueStatus(),
        require('../services/payment-monitoring.service').getMetricsReport(),
        this.getRealtimeStatus(req, res)
      ]);

      const dashboardData = {
        timestamp: new Date().toISOString(),
        health: systemHealth,
        queue: queueStatus.current,
        payments: {
          successRate: paymentMetrics.summary.successRate,
          failureRate: paymentMetrics.summary.failureRate,
          totalRevenue: paymentMetrics.summary.totalRevenue,
          last24h: paymentMetrics.timeWindows['24h']
        },
        system: {
          uptime: realtimeStatus.uptime,
          memory: realtimeStatus.memory,
          cpu: realtimeStatus.cpu
        }
      };

      return apiResponse.success(res, dashboardData, 'Dashboard data retrieved successfully');
    } catch (error) {
      logger.error('Error getting dashboard data:', error);
      return apiResponse.error(res, 'Failed to retrieve dashboard data', 500);
    }
  }
}

module.exports = new AdminMonitoringController();