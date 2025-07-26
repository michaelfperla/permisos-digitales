// src/controllers/payment-health.controller.js
const { logger } = require('../utils/logger');
const ApiResponse = require('../utils/api-response');
const paymentMonitoring = require('../services/payment-monitoring.service');
const paymentRecovery = require('../services/payment-recovery.service');
const stripePaymentService = require('../services/stripe-payment.service');

/**
 * Get payment system health status
 */
const getPaymentHealth = async (req, res) => {
  try {
    const metrics = paymentMonitoring.getMetricsReport();
    const now = Date.now();
    
    // Calculate health scores
    const healthChecks = {
      stripe_connectivity: await checkStripeConnectivity(),
      payment_success_rate: calculateSuccessRateHealth(metrics.summary.successRate),
      processing_time: calculateProcessingTimeHealth(metrics.summary.averageProcessingTime),
      error_rate: calculateErrorRateHealth(metrics.summary.failureRate),
      recent_failures: calculateRecentFailuresHealth(metrics.consecutiveFailures),
      circuit_breakers: await checkCircuitBreakers()
    };

    // Overall health score (0-100)
    const healthScore = calculateOverallHealth(healthChecks);
    
    // Determine status
    let status = 'healthy';
    if (healthScore < 50) {
      status = 'critical';
    } else if (healthScore < 80) {
      status = 'degraded';
    }

    const healthReport = {
      status,
      score: healthScore,
      timestamp: new Date().toISOString(),
      checks: healthChecks,
      metrics: metrics.summary,
      recommendations: generateRecommendations(healthChecks, metrics)
    };

    logger.info('Payment health check completed:', {
      status,
      score: healthScore,
      successRate: metrics.summary.successRate
    });

    ApiResponse.success(res, healthReport, {
      message: `Payment system is ${status}`
    });
  } catch (error) {
    logger.error('Error during payment health check:', error);
    ApiResponse.error(res, 'Error checking payment system health', 500);
  }
};

/**
 * Get detailed payment metrics
 */
const getPaymentMetrics = async (req, res) => {
  try {
    const metrics = paymentMonitoring.getMetricsReport();
    
    // Add additional computed metrics
    const enhancedMetrics = {
      ...metrics,
      computed: {
        hourlyPaymentRate: metrics.timeWindows?.['1h']?.total || 0,
        dailyPaymentRate: metrics.timeWindows?.['24h']?.total || 0,
        weeklyPaymentRate: metrics.timeWindows?.['7d']?.total || 0,
        averagePaymentValue: calculateAveragePaymentValue(metrics),
        topErrorTypes: getTopErrorTypes(metrics.errorsByType),
        paymentMethodDistribution: calculateMethodDistribution(metrics.paymentsByMethod)
      }
    };

    ApiResponse.success(res, enhancedMetrics, {
      message: 'Payment metrics retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving payment metrics:', error);
    ApiResponse.error(res, 'Error retrieving payment metrics', 500);
  }
};

/**
 * Trigger payment reconciliation for an application
 */
const reconcilePayment = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    logger.info('Manual payment reconciliation triggered:', { applicationId });
    
    const result = await paymentRecovery.reconcilePaymentStatus(applicationId);
    
    if (result.success) {
      ApiResponse.success(res, result, {
        message: 'Payment reconciliation completed successfully'
      });
    } else {
      ApiResponse.badRequest(res, result, {
        message: 'Payment reconciliation failed'
      });
    }
  } catch (error) {
    logger.error('Error during payment reconciliation:', error);
    ApiResponse.error(res, 'Error during payment reconciliation', 500);
  }
};

/**
 * Reset payment monitoring metrics (admin only)
 */
const resetMetrics = async (req, res) => {
  try {
    paymentMonitoring.resetMetrics();
    
    logger.info('Payment metrics reset by admin:', {
      adminId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    ApiResponse.success(res, null, {
      message: 'Payment metrics reset successfully'
    });
  } catch (error) {
    logger.error('Error resetting payment metrics:', error);
    ApiResponse.error(res, 'Error resetting payment metrics', 500);
  }
};

// Helper functions

async function checkStripeConnectivity() {
  try {
    // Initialize Stripe if needed
    await stripePaymentService.initializeStripe();
    
    // Actually test the connection by retrieving account info
    // This is a lightweight API call that verifies connectivity
    const stripe = stripePaymentService.stripe;
    if (!stripe) {
      throw new Error('Stripe not initialized');
    }
    
    // Try to list payment methods (with limit 1 to minimize data)
    // This is a real API call that will fail if there's no connectivity
    await stripe.paymentMethods.list({ limit: 1 });
    
    return { status: 'healthy', score: 100, message: 'Stripe API accessible' };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      score: 0, 
      message: `Stripe connectivity issue: ${error.message}` 
    };
  }
}

function calculateSuccessRateHealth(successRate) {
  const score = Math.round(successRate * 100);
  let status = 'healthy';
  
  if (successRate < 0.7) {
    status = 'critical';
  } else if (successRate < 0.9) {
    status = 'degraded';
  }
  
  return {
    status,
    score,
    value: successRate,
    message: `${(successRate * 100).toFixed(1)}% success rate`
  };
}

function calculateProcessingTimeHealth(avgProcessingTime) {
  let score = 100;
  let status = 'healthy';
  
  if (avgProcessingTime > 10000) { // 10 seconds
    score = 20;
    status = 'critical';
  } else if (avgProcessingTime > 5000) { // 5 seconds
    score = 60;
    status = 'degraded';
  } else if (avgProcessingTime > 2000) { // 2 seconds
    score = 80;
    status = 'warning';
  }
  
  return {
    status,
    score,
    value: avgProcessingTime,
    message: `${avgProcessingTime.toFixed(0)}ms average processing time`
  };
}

function calculateErrorRateHealth(errorRate) {
  const score = Math.max(0, 100 - (errorRate * 500)); // Scale error rate
  let status = 'healthy';
  
  if (errorRate > 0.2) {
    status = 'critical';
  } else if (errorRate > 0.1) {
    status = 'degraded';
  }
  
  return {
    status,
    score: Math.round(score),
    value: errorRate,
    message: `${(errorRate * 100).toFixed(1)}% error rate`
  };
}

function calculateRecentFailuresHealth(consecutiveFailures) {
  let score = 100;
  let status = 'healthy';
  
  if (consecutiveFailures >= 5) {
    score = 20;
    status = 'critical';
  } else if (consecutiveFailures >= 3) {
    score = 60;
    status = 'degraded';
  } else if (consecutiveFailures >= 1) {
    score = 80;
    status = 'warning';
  }
  
  return {
    status,
    score,
    value: consecutiveFailures,
    message: `${consecutiveFailures} consecutive failures`
  };
}

async function checkCircuitBreakers() {
  try {
    // Get circuit breaker states from stripe payment service
    const circuitBreakerStates = stripePaymentService.getCircuitBreakerStates();
    
    let overallStatus = 'healthy';
    let score = 100;
    const messages = [];
    
    // Check each circuit breaker
    for (const [name, state] of Object.entries(circuitBreakerStates)) {
      if (state.state === 'OPEN') {
        overallStatus = 'critical';
        score = Math.min(score, 20);
        messages.push(`${name} is OPEN (${state.consecutiveFailures} failures)`);
      } else if (state.state === 'HALF_OPEN') {
        overallStatus = overallStatus === 'critical' ? 'critical' : 'degraded';
        score = Math.min(score, 60);
        messages.push(`${name} is HALF_OPEN (testing recovery)`);
      } else {
        messages.push(`${name} is operational`);
      }
    }
    
    return {
      status: overallStatus,
      score,
      message: messages.join(', '),
      details: circuitBreakerStates
    };
  } catch (error) {
    logger.error('Error checking circuit breakers:', error);
    return {
      status: 'unhealthy',
      score: 0,
      message: 'Circuit breaker check failed'
    };
  }
}

function calculateOverallHealth(healthChecks) {
  const scores = Object.values(healthChecks).map(check => check.score || 0);
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function generateRecommendations(healthChecks, metrics) {
  const recommendations = [];
  
  if (healthChecks.payment_success_rate.score < 80) {
    recommendations.push('Consider investigating payment failures and improving error handling');
  }
  
  if (healthChecks.processing_time.score < 80) {
    recommendations.push('Payment processing times are high - consider optimizing API calls');
  }
  
  if (metrics.consecutiveFailures >= 3) {
    recommendations.push('Multiple consecutive failures detected - check Stripe connectivity');
  }
  
  if (healthChecks.stripe_connectivity.score < 100) {
    recommendations.push('Stripe connectivity issues detected - verify API keys and network');
  }
  
  return recommendations;
}

function calculateHourlyRate(totalPayments) {
  // This is a simplified calculation - in production you'd track time windows
  return Math.round(totalPayments / 24); // Assume 24 hour period
}

function calculateAveragePaymentValue(metrics) {
  // Use the actual average from the monitoring service
  return metrics.summary.averagePaymentAmount || 150;
}

function getTopErrorTypes(errorsByType) {
  return Object.entries(errorsByType)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));
}

function calculateMethodDistribution(paymentsByMethod) {
  const total = Object.values(paymentsByMethod).reduce((sum, count) => sum + count, 0);
  
  if (total === 0) return {};
  
  return Object.entries(paymentsByMethod).reduce((dist, [method, count]) => {
    dist[method] = {
      count,
      percentage: ((count / total) * 100).toFixed(1)
    };
    return dist;
  }, {});
}

module.exports = {
  getPaymentHealth,
  getPaymentMetrics,
  reconcilePayment,
  resetMetrics
};
