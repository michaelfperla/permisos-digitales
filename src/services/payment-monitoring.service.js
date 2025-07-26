// src/services/payment-monitoring.service.js
const { logger } = require('../utils/logger');

class PaymentMonitoringService {
  constructor() {
    // Time windows in milliseconds
    this.timeWindows = {
      '1h': 3600000,
      '24h': 86400000,
      '7d': 604800000
    };
    
    // Initialize sliding window data
    this.slidingWindowData = {
      payments: [],
      processingTimes: [],
      failures: []
    };
    
    this.metrics = {
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
      averageProcessingTime: 0,
      processingTimes: [],
      totalRevenue: 0,
      paymentAmounts: [],
      errorsByType: {},
      paymentsByMethod: {
        card: 0,
        oxxo: 0
      },
      recentFailures: [],
      consecutiveFailures: 0,
      alertThresholds: {
        failureRate: 0.15, // 15% failure rate triggers alert
        processingTime: 10000, // 10 seconds
        consecutiveFailures: 5
      },
      lastAlertTime: null,
      alertCooldown: 300000 // 5 minutes between alerts
    };

    // Store interval ID for cleanup
    this.monitoringInterval = null;
    
    // Start monitoring interval
    this.startMonitoring();
    
    // Register cleanup handlers
    this.registerCleanupHandlers();
  }

  /**
   * Record a payment attempt
   */
  recordPaymentAttempt(paymentData) {
    try {
      this.metrics.totalPayments++;
      
      const { method, amount, applicationId, userId } = paymentData;
      
      if (method && this.metrics.paymentsByMethod[method] !== undefined) {
        this.metrics.paymentsByMethod[method]++;
      }

      // Add to sliding window
      const timestamp = Date.now();
      this.slidingWindowData.payments.push({
        timestamp,
        method,
        amount: amount || 150, // Default to permit price
        applicationId,
        userId,
        status: 'attempt'
      });
      
      // Clean up old data
      this.cleanupOldData();

      logger.info('Payment attempt recorded:', {
        method,
        amount,
        applicationId,
        userId,
        totalPayments: this.metrics.totalPayments
      });
    } catch (error) {
      logger.error('Error recording payment attempt:', error);
    }
  }

  /**
   * Record a successful payment
   */
  recordPaymentSuccess(paymentData) {
    try {
      this.metrics.successfulPayments++;
      
      const { processingTime, method, amount, paymentIntentId } = paymentData;
      
      if (processingTime) {
        this.metrics.processingTimes.push(processingTime);
        
        // Keep only last 100 processing times
        if (this.metrics.processingTimes.length > 100) {
          this.metrics.processingTimes.shift();
        }
        
        // Update average
        this.metrics.averageProcessingTime = 
          this.metrics.processingTimes.reduce((a, b) => a + b, 0) / 
          this.metrics.processingTimes.length;
      }

      // Track payment method
      if (method && this.metrics.paymentsByMethod[method] !== undefined) {
        this.metrics.paymentsByMethod[method]++;
      }

      // Track payment amount
      if (amount) {
        this.metrics.totalRevenue += amount;
        this.metrics.paymentAmounts.push(amount);
        
        // Keep only last 100 payment amounts
        if (this.metrics.paymentAmounts.length > 100) {
          this.metrics.paymentAmounts.shift();
        }
      }

      // Reset consecutive failures on success
      this.metrics.consecutiveFailures = 0;

      // Add success to sliding window
      const timestamp = Date.now();
      this.slidingWindowData.payments.push({
        timestamp,
        method,
        amount: amount || 150,
        paymentIntentId,
        status: 'success',
        processingTime
      });
      
      if (processingTime) {
        this.slidingWindowData.processingTimes.push({
          timestamp,
          time: processingTime
        });
      }
      
      // Clean up old data
      this.cleanupOldData();

      logger.info('Payment success recorded:', {
        method,
        amount,
        paymentIntentId,
        processingTime,
        successRate: this.getSuccessRate()
      });
    } catch (error) {
      logger.error('Error recording payment success:', error);
    }
  }

  /**
   * Record a payment failure
   */
  recordPaymentFailure(errorData) {
    try {
      this.metrics.failedPayments++;
      
      const { error, method, amount, applicationId, userId } = errorData;
      const errorType = error.code || error.type || 'unknown';
      
      // Track error types
      if (!this.metrics.errorsByType[errorType]) {
        this.metrics.errorsByType[errorType] = 0;
      }
      this.metrics.errorsByType[errorType]++;

      // Track recent failures
      this.metrics.recentFailures.push({
        timestamp: Date.now(),
        errorType,
        method,
        amount,
        applicationId,
        userId,
        message: error.message
      });

      // Keep only last 50 failures
      if (this.metrics.recentFailures.length > 50) {
        this.metrics.recentFailures.shift();
      }

      this.metrics.consecutiveFailures++;

      // Add failure to sliding window
      const timestamp = Date.now();
      this.slidingWindowData.payments.push({
        timestamp,
        method,
        amount: amount || 150,
        applicationId,
        userId,
        status: 'failure',
        errorType,
        errorMessage: error.message
      });
      
      this.slidingWindowData.failures.push({
        timestamp,
        errorType,
        method
      });
      
      // Clean up old data
      this.cleanupOldData();

      logger.warn('Payment failure recorded:', {
        errorType,
        method,
        amount,
        applicationId,
        userId,
        consecutiveFailures: this.metrics.consecutiveFailures,
        failureRate: this.getFailureRate()
      });

      // Check if we need to send alerts
      this.checkAlertConditions();
    } catch (error) {
      logger.error('Error recording payment failure:', error);
    }
  }

  /**
   * Get current success rate
   */
  getSuccessRate() {
    if (this.metrics.totalPayments === 0) return 1;
    return this.metrics.successfulPayments / this.metrics.totalPayments;
  }

  /**
   * Get current failure rate
   */
  getFailureRate() {
    if (this.metrics.totalPayments === 0) return 0;
    return this.metrics.failedPayments / this.metrics.totalPayments;
  }

  /**
   * Get average payment amount
   */
  getAveragePaymentAmount() {
    if (this.metrics.paymentAmounts.length === 0) return 150; // Default to permit price
    return this.metrics.paymentAmounts.reduce((a, b) => a + b, 0) / this.metrics.paymentAmounts.length;
  }

  /**
   * Check if alert conditions are met
   */
  checkAlertConditions() {
    try {
      const now = Date.now();
      const { alertThresholds, lastAlertTime, alertCooldown } = this.metrics;

      // Check cooldown period
      if (lastAlertTime && (now - lastAlertTime) < alertCooldown) {
        return;
      }

      const failureRate = this.getFailureRate();
      const avgProcessingTime = this.metrics.averageProcessingTime;
      const consecutiveFailures = this.metrics.consecutiveFailures;

      let shouldAlert = false;
      let alertReason = '';

      // Check failure rate
      if (failureRate > alertThresholds.failureRate && this.metrics.totalPayments >= 10) {
        shouldAlert = true;
        alertReason = `High failure rate: ${(failureRate * 100).toFixed(1)}%`;
      }

      // Check processing time
      if (avgProcessingTime > alertThresholds.processingTime && this.metrics.processingTimes.length >= 5) {
        shouldAlert = true;
        alertReason += (alertReason ? ', ' : '') + `Slow processing: ${avgProcessingTime.toFixed(0)}ms avg`;
      }

      // Check consecutive failures
      if (consecutiveFailures >= alertThresholds.consecutiveFailures) {
        shouldAlert = true;
        alertReason += (alertReason ? ', ' : '') + `${consecutiveFailures} consecutive failures`;
      }

      if (shouldAlert) {
        this.sendAlert(alertReason);
        this.metrics.lastAlertTime = now;
      }
    } catch (error) {
      logger.error('Error checking alert conditions:', error);
    }
  }

  /**
   * Send alert through external alert service
   */
  async sendAlert(reason) {
    const alertData = {
      reason,
      metrics: {
        totalPayments: this.metrics.totalPayments,
        successRate: this.getSuccessRate(),
        failureRate: this.getFailureRate(),
        averageProcessingTime: this.metrics.averageProcessingTime,
        consecutiveFailures: this.metrics.consecutiveFailures,
        recentErrors: this.metrics.errorsByType
      },
      timestamp: new Date().toISOString()
    };

    logger.error('PAYMENT SYSTEM ALERT:', alertData);

    // Send external alert
    try {
      const alertService = require('./alert.service');
      
      // Determine severity based on the issue
      let severity = 'HIGH';
      if (this.getFailureRate() > 0.25 || this.metrics.consecutiveFailures >= 10) {
        severity = 'CRITICAL';
      } else if (this.getFailureRate() > 0.10 || this.metrics.consecutiveFailures >= 3) {
        severity = 'HIGH';
      } else {
        severity = 'MEDIUM';
      }
      
      await alertService.sendPaymentAlert(
        'Payment System Alert',
        reason,
        alertData.metrics,
        severity
      );
    } catch (error) {
      logger.error('Failed to send external alert:', error);
      // Don't throw - alerting failure shouldn't break payment processing
    }
  }

  /**
   * Clean up data older than the longest time window (7 days)
   */
  cleanupOldData() {
    const cutoffTime = Date.now() - this.timeWindows['7d'];
    
    this.slidingWindowData.payments = this.slidingWindowData.payments.filter(
      payment => payment.timestamp > cutoffTime
    );
    
    this.slidingWindowData.processingTimes = this.slidingWindowData.processingTimes.filter(
      pt => pt.timestamp > cutoffTime
    );
    
    this.slidingWindowData.failures = this.slidingWindowData.failures.filter(
      failure => failure.timestamp > cutoffTime
    );
  }
  
  /**
   * Get metrics for a specific time window
   */
  getWindowMetrics(window) {
    const cutoffTime = Date.now() - this.timeWindows[window];
    
    const windowPayments = this.slidingWindowData.payments.filter(
      p => p.timestamp > cutoffTime
    );
    
    const successful = windowPayments.filter(p => p.status === 'success');
    const failed = windowPayments.filter(p => p.status === 'failure');
    
    const processingTimes = this.slidingWindowData.processingTimes
      .filter(pt => pt.timestamp > cutoffTime)
      .map(pt => pt.time);
    
    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      : 0;
    
    const revenue = successful.reduce((sum, p) => sum + (p.amount || 150), 0);
    
    return {
      total: windowPayments.length,
      successful: successful.length,
      failed: failed.length,
      successRate: windowPayments.length > 0 ? successful.length / windowPayments.length : 1,
      failureRate: windowPayments.length > 0 ? failed.length / windowPayments.length : 0,
      avgProcessingTime,
      revenue,
      avgPaymentAmount: successful.length > 0 ? revenue / successful.length : 150
    };
  }

  /**
   * Get comprehensive metrics report
   */
  getMetricsReport() {
    const timeWindowMetrics = {};
    
    // Get metrics for each time window
    for (const window of Object.keys(this.timeWindows)) {
      timeWindowMetrics[window] = this.getWindowMetrics(window);
    }
    
    return {
      summary: {
        totalPayments: this.metrics.totalPayments,
        successfulPayments: this.metrics.successfulPayments,
        failedPayments: this.metrics.failedPayments,
        successRate: this.getSuccessRate(),
        failureRate: this.getFailureRate(),
        averageProcessingTime: this.metrics.averageProcessingTime,
        totalRevenue: this.metrics.totalRevenue,
        averagePaymentAmount: this.getAveragePaymentAmount()
      },
      timeWindows: timeWindowMetrics,
      paymentsByMethod: this.metrics.paymentsByMethod,
      errorsByType: this.metrics.errorsByType,
      recentFailures: this.metrics.recentFailures.slice(-10), // Last 10 failures
      consecutiveFailures: this.metrics.consecutiveFailures,
      alertThresholds: this.metrics.alertThresholds
    };
  }

  /**
   * Start monitoring interval
   */
  startMonitoring() {
    // Prevent multiple intervals
    if (this.monitoringInterval) {
      logger.warn('Payment monitoring already running');
      return;
    }
    
    // Log metrics every 5 minutes
    this.monitoringInterval = setInterval(() => {
      const report = this.getMetricsReport();
      logger.info('Payment system metrics:', report.summary);
    }, 300000); // 5 minutes
    
    logger.info('Payment monitoring started');
  }
  
  /**
   * Stop monitoring interval
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Payment monitoring stopped');
    }
  }
  
  /**
   * Register cleanup handlers for graceful shutdown
   */
  registerCleanupHandlers() {
    // Handle process termination
    const cleanup = () => {
      logger.info('Cleaning up payment monitoring service...');
      this.stopMonitoring();
    };
    
    // Register handlers for various termination signals
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
    
    // Handle uncaught exceptions (log but don't exit)
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in payment monitoring:', error);
      // Don't exit, let the main error handler deal with it
    });
  }

  /**
   * Reset metrics (useful for testing or maintenance)
   */
  resetMetrics() {
    this.metrics.totalPayments = 0;
    this.metrics.successfulPayments = 0;
    this.metrics.failedPayments = 0;
    this.metrics.processingTimes = [];
    this.metrics.totalRevenue = 0;
    this.metrics.paymentAmounts = [];
    this.metrics.errorsByType = {};
    this.metrics.recentFailures = [];
    this.metrics.consecutiveFailures = 0;
    this.metrics.paymentsByMethod = { card: 0, oxxo: 0 };
    
    // Also reset sliding window data
    this.slidingWindowData.payments = [];
    this.slidingWindowData.processingTimes = [];
    this.slidingWindowData.failures = [];
    
    logger.info('Payment monitoring metrics reset');
  }
}

// Export singleton instance
module.exports = new PaymentMonitoringService();
