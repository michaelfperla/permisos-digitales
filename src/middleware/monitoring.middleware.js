// src/middleware/monitoring.middleware.js
const systemMonitoringService = require('../services/system-monitoring.service');
const { logger } = require('../utils/logger');

/**
 * Middleware to track API response times and performance metrics
 */
const performanceMonitoring = (req, res, next) => {
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to capture response time
  res.end = function(...args) {
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Record API response time
    const endpoint = req.route ? req.route.path : req.path;
    const method = req.method;
    
    systemMonitoringService.recordApiResponseTime(endpoint, method, responseTime);
    
    // Log slow requests
    if (responseTime > 1000) {
      logger.warn('Slow API request detected', {
        method,
        endpoint,
        responseTime,
        query: req.query,
        body: req.body ? Object.keys(req.body) : undefined,
        statusCode: res.statusCode
      });
    }
    
    // Call original end function
    originalEnd.apply(res, args);
  };
  
  next();
};

/**
 * Middleware to track database query times
 * This should be applied to the database connection/pool
 */
const databaseMonitoring = (query, duration) => {
  systemMonitoringService.recordDbQueryTime(query, duration);
  
  // Log slow queries
  if (duration > 1000) {
    logger.warn('Slow database query detected', {
      query: query.substring(0, 200),
      duration
    });
  }
};

/**
 * Middleware to track errors
 */
const errorMonitoring = (error, req, res, next) => {
  const errorType = error.name || 'UnknownError';
  const errorCode = error.code || 'UNKNOWN';
  const severity = error.statusCode >= 500 ? 'critical' : 'error';
  
  systemMonitoringService.recordError(errorType, errorCode, {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    statusCode: error.statusCode || 500
  }, severity);
  
  // Pass error to next handler
  next(error);
};

module.exports = {
  performanceMonitoring,
  databaseMonitoring,
  errorMonitoring
};