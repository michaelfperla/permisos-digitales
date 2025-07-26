const logger = require('../../utils/enhanced-logger');

/**
 * Health monitoring system for WhatsApp service
 * Tracks memory usage, performance metrics, and system health
 */
class HealthMonitor {
  constructor(whatsAppService) {
    this.whatsAppService = whatsAppService;
    this.healthHistory = [];
    this.performanceMetrics = {
      messageProcessingTimes: [],
      errorCounts: new Map(),
      configurationReloads: 0,
      lastHealthCheck: null
    };
    
    this.HEALTH_HISTORY_LIMIT = 100;
    this.MEMORY_WARNING_THRESHOLD = 0.8; // 80% of max
    this.ERROR_RATE_WARNING_THRESHOLD = 0.05; // 5% error rate
    
    // Start periodic health monitoring
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const healthStatus = {
      timestamp: Date.now(),
      status: 'healthy',
      checks: {},
      metrics: {},
      warnings: [],
      errors: []
    };

    try {
      // Check memory usage
      healthStatus.checks.memory = await this.checkMemoryHealth();
      
      // Check configuration status
      healthStatus.checks.configuration = await this.checkConfigurationHealth();
      
      // Check error rates
      healthStatus.checks.errorRate = this.checkErrorRates();
      
      // Check performance metrics
      healthStatus.checks.performance = this.checkPerformanceMetrics();
      
      // Check external dependencies
      healthStatus.checks.dependencies = await this.checkDependencies();
      
      // Calculate overall status
      healthStatus.status = this.calculateOverallStatus(healthStatus.checks);
      
      // Add metrics
      healthStatus.metrics = this.collectMetrics();
      
      // Store in history (keep only recent entries)
      this.healthHistory.push(healthStatus);
      if (this.healthHistory.length > this.HEALTH_HISTORY_LIMIT) {
        this.healthHistory = this.healthHistory.slice(-this.HEALTH_HISTORY_LIMIT);
      }
      
      this.performanceMetrics.lastHealthCheck = Date.now();
      
      // Log if not healthy
      if (healthStatus.status !== 'healthy') {
        logger.warn('WhatsApp service health check warnings', {
          status: healthStatus.status,
          warnings: healthStatus.warnings,
          errors: healthStatus.errors
        });
      }
      
      return healthStatus;
      
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      healthStatus.status = 'error';
      healthStatus.errors.push(`Health check failed: ${error.message}`);
      return healthStatus;
    }
  }

  /**
   * Check memory health
   */
  async checkMemoryHealth() {
    const memoryUsage = process.memoryUsage();
    const whatsAppMemoryStats = this.whatsAppService.getMemoryStats();
    
    const check = {
      status: 'healthy',
      processMemory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
      },
      serviceMemory: whatsAppMemoryStats
    };

    // Check for memory warnings
    const heapUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    if (heapUsagePercent > this.MEMORY_WARNING_THRESHOLD) {
      check.status = 'warning';
      check.warning = `High heap usage: ${Math.round(heapUsagePercent * 100)}%`;
    }

    // Check service-specific memory usage
    if (whatsAppMemoryStats.rateLimiter > 1000) {
      check.status = 'warning';
      check.warning = `High rate limiter entries: ${whatsAppMemoryStats.rateLimiter}`;
    }

    return check;
  }

  /**
   * Check configuration health
   */
  async checkConfigurationHealth() {
    const check = {
      status: 'healthy',
      configInitialized: this.whatsAppService._configInitialized,
      reloadCount: this.performanceMetrics.configurationReloads
    };

    if (!this.whatsAppService._configInitialized) {
      check.status = 'error';
      check.error = 'Configuration not initialized';
      return check;
    }

    // Validate current configuration
    try {
      const validationStatus = await this.whatsAppService.getConfigValidationStatus();
      check.validation = validationStatus;
      
      if (validationStatus.status === 'invalid') {
        check.status = 'error';
        check.error = validationStatus.error;
      } else if (validationStatus.warnings > 0) {
        check.status = 'warning';
        check.warning = `Configuration has ${validationStatus.warnings} warnings`;
      }
    } catch (error) {
      check.status = 'warning';
      check.warning = `Configuration validation failed: ${error.message}`;
    }

    return check;
  }

  /**
   * Check error rates
   */
  checkErrorRates() {
    const now = Date.now();
    const recentErrors = Array.from(this.performanceMetrics.errorCounts.values())
      .filter(errorTime => now - errorTime < 300000); // Last 5 minutes

    const totalMessages = this.performanceMetrics.messageProcessingTimes.length;
    const errorRate = totalMessages > 0 ? recentErrors.length / totalMessages : 0;

    const check = {
      status: 'healthy',
      recentErrors: recentErrors.length,
      totalMessages,
      errorRate: Math.round(errorRate * 100) / 100
    };

    if (errorRate > this.ERROR_RATE_WARNING_THRESHOLD) {
      check.status = 'warning';
      check.warning = `High error rate: ${Math.round(errorRate * 100)}%`;
    }

    return check;
  }

  /**
   * Check performance metrics
   */
  checkPerformanceMetrics() {
    const recentTimes = this.performanceMetrics.messageProcessingTimes
      .slice(-100); // Last 100 messages

    if (recentTimes.length === 0) {
      return {
        status: 'healthy',
        averageResponseTime: 0,
        messageCount: 0
      };
    }

    const averageTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
    const maxTime = Math.max(...recentTimes);

    const check = {
      status: 'healthy',
      averageResponseTime: Math.round(averageTime),
      maxResponseTime: maxTime,
      messageCount: recentTimes.length
    };

    if (averageTime > 5000) { // 5 seconds
      check.status = 'warning';
      check.warning = `Slow average response time: ${Math.round(averageTime)}ms`;
    }

    return check;
  }

  /**
   * Check external dependencies
   */
  async checkDependencies() {
    const check = {
      status: 'healthy',
      redis: { status: 'unknown' },
      whatsappApi: { status: 'unknown' }
    };

    // Check Redis connection
    try {
      const redisClient = require('../../utils/redis-client');
      await redisClient.ping();
      check.redis.status = 'healthy';
    } catch (error) {
      check.redis.status = 'error';
      check.redis.error = error.message;
      check.status = 'warning';
    }

    // Note: WhatsApp API check would require actual API call
    // For now, just check if config is available
    if (this.whatsAppService._configInitialized) {
      check.whatsappApi.status = 'configured';
    } else {
      check.whatsappApi.status = 'not_configured';
      check.status = 'warning';
    }

    return check;
  }

  /**
   * Calculate overall health status
   */
  calculateOverallStatus(checks) {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('error')) {
      return 'error';
    } else if (statuses.includes('warning')) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * Collect metrics for monitoring
   */
  collectMetrics() {
    const now = Date.now();
    const recent = now - 300000; // 5 minutes ago

    return {
      uptime: process.uptime(),
      messageProcessingTimes: {
        count: this.performanceMetrics.messageProcessingTimes.length,
        recentCount: this.performanceMetrics.messageProcessingTimes
          .filter(time => time.timestamp > recent).length
      },
      errorCounts: {
        total: this.performanceMetrics.errorCounts.size,
        recent: Array.from(this.performanceMetrics.errorCounts.values())
          .filter(time => time > recent).length
      },
      configurationReloads: this.performanceMetrics.configurationReloads,
      lastHealthCheck: this.performanceMetrics.lastHealthCheck
    };
  }

  /**
   * Record message processing time
   */
  recordMessageProcessingTime(duration) {
    this.performanceMetrics.messageProcessingTimes.push({
      duration,
      timestamp: Date.now()
    });

    // Keep only recent entries
    const cutoff = Date.now() - 3600000; // 1 hour
    this.performanceMetrics.messageProcessingTimes = 
      this.performanceMetrics.messageProcessingTimes
        .filter(entry => entry.timestamp > cutoff);
  }

  /**
   * Record error occurrence
   */
  recordError(errorType, userId = 'unknown') {
    const errorKey = `${errorType}:${userId}`;
    this.performanceMetrics.errorCounts.set(errorKey, Date.now());

    // Clean old errors
    const cutoff = Date.now() - 3600000; // 1 hour
    for (const [key, timestamp] of this.performanceMetrics.errorCounts.entries()) {
      if (timestamp < cutoff) {
        this.performanceMetrics.errorCounts.delete(key);
      }
    }
  }

  /**
   * Record configuration reload
   */
  recordConfigurationReload() {
    this.performanceMetrics.configurationReloads++;
  }

  /**
   * Get current health status
   */
  getCurrentHealth() {
    if (this.healthHistory.length === 0) {
      return { status: 'unknown', message: 'No health checks performed yet' };
    }

    return this.healthHistory[this.healthHistory.length - 1];
  }

  /**
   * Get health history
   */
  getHealthHistory(limit = 20) {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get detailed health report
   */
  getDetailedHealthReport() {
    const currentHealth = this.getCurrentHealth();
    const recentHistory = this.getHealthHistory(10);
    
    return {
      current: currentHealth,
      history: recentHistory,
      trends: this.calculateHealthTrends(),
      summary: this.generateHealthSummary()
    };
  }

  /**
   * Calculate health trends
   */
  calculateHealthTrends() {
    if (this.healthHistory.length < 5) {
      return { status: 'insufficient_data' };
    }

    const recent = this.healthHistory.slice(-10);
    const errorCount = recent.filter(h => h.status === 'error').length;
    const warningCount = recent.filter(h => h.status === 'warning').length;
    const healthyCount = recent.filter(h => h.status === 'healthy').length;

    return {
      errorRate: errorCount / recent.length,
      warningRate: warningCount / recent.length,
      healthyRate: healthyCount / recent.length,
      trend: this.calculateTrendDirection(recent)
    };
  }

  /**
   * Calculate trend direction
   */
  calculateTrendDirection(history) {
    if (history.length < 3) return 'stable';

    const recent3 = history.slice(-3);
    const scores = recent3.map(h => {
      switch (h.status) {
        case 'healthy': return 2;
        case 'warning': return 1;
        case 'error': return 0;
        default: return 1;
      }
    });

    const slope = (scores[2] - scores[0]) / 2;
    
    if (slope > 0.3) return 'improving';
    if (slope < -0.3) return 'degrading';
    return 'stable';
  }

  /**
   * Generate health summary
   */
  generateHealthSummary() {
    const current = this.getCurrentHealth();
    const trends = this.calculateHealthTrends();
    
    let summary = `System is ${current.status}`;
    
    if (trends.trend !== 'stable') {
      summary += ` and ${trends.trend}`;
    }
    
    const warnings = current.warnings?.length || 0;
    const errors = current.errors?.length || 0;
    
    if (warnings > 0 || errors > 0) {
      summary += ` (${errors} errors, ${warnings} warnings)`;
    }
    
    return summary;
  }

  /**
   * Cleanup method
   */
  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health monitor cleanup completed');
    }
  }
}

module.exports = HealthMonitor;