/**
 * Enhanced Logger with Correlation IDs and Log Sanitization
 * Provides structured logging with request context and automatic sanitization of sensitive data
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const httpContext = require('express-http-context');
const { sanitize, createSanitizedLogger } = require('./log-sanitizer');
const { defaultLogAnalyzer } = require('./log-analyzer');

// Ensure log directory exists
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define custom format for structured logs with sanitization
const structuredFormat = winston.format((info) => {
  // Add standard fields
  info.timestamp = new Date().toISOString();
  info.service = 'permisos-digitales-api';
  info.environment = process.env.NODE_ENV || 'development';

  // Add correlation IDs from context if available
  const requestId = httpContext.get('requestId');
  const userId = httpContext.get('userId');
  const sessionId = httpContext.get('sessionId');

  if (requestId) info.requestId = requestId;
  if (userId) info.userId = userId;
  // Sanitize session ID before logging
  if (sessionId) info.sessionId = sessionId.length > 8 ? `***${sessionId.slice(-4)}` : '[REDACTED]';

  // Add AI-friendly structured fields if not already present
  if (!info.eventType && info.level) {
    // Auto-categorize based on level and content
    if (info.level === 'error') {
      info.eventType = 'ERROR_OCCURRED';
      info.category = 'system';
      info.severity = 'high';
    } else if (info.level === 'warn') {
      info.eventType = 'WARNING_DETECTED';
      info.category = 'system';
      info.severity = 'medium';
    } else if (info.level === 'info') {
      info.eventType = 'INFO_EVENT';
      info.category = 'general';
      info.severity = 'normal';
    }
  }

  // Add PM2 instance info if available
  if (process.env.pm_id) {
    info.instanceId = process.env.pm_id;
    info.clusterId = process.env.NODE_APP_INSTANCE || '0';
  }

  // Sanitize the entire log info object
  const sanitizedInfo = sanitize(info);
  
  // Send to log analyzer for real-time analysis (non-blocking)
  try {
    setImmediate(() => {
      defaultLogAnalyzer.processLogEvent(sanitizedInfo);
    });
  } catch (error) {
    // Don't let analyzer errors break logging
  }
  
  return sanitizedInfo;
});

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    structuredFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'permisos-digitales-api' },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Console transport with colorization
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, requestId, userId, ...rest }) => {
          const reqId = requestId ? `[${requestId}]` : '';
          const userInfo = userId ? `(User: ${userId})` : '';

          // Remove some fields from rest to avoid clutter
          const { service, environment, sessionId, ...cleanRest } = rest;

          // Custom replacer function to handle circular references
          const getCircularReplacer = () => {
            const seen = new WeakSet();
            return (key, value) => {
              // Skip null and undefined values
              if (value === null || value === undefined) {
                return value;
              }

              // Handle circular references
              if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                  return '[Circular Reference]';
                }
                seen.add(value);
              }

              // Handle Error objects
              if (value instanceof Error) {
                return {
                  message: value.message,
                  stack: value.stack,
                  name: value.name
                };
              }

              return value;
            };
          };

          // Safely stringify the object with circular reference handling
          const safeStringify = (obj) => {
            try {
              return JSON.stringify(obj, getCircularReplacer(), 2);
            } catch (error) {
              return `[Error serializing log data: ${error.message}]`;
            }
          };

          const meta = Object.keys(cleanRest).length > 0
            ? `\n${safeStringify(cleanRest)}`
            : '';

          return `${timestamp} ${reqId} ${level}: ${message} ${userInfo}${meta}`;
        })
      )
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'application.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),

    // File transport for error logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.Console()
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.Console()
  ],
  exitOnError: false
});

// Middleware to set up correlation IDs
const correlationMiddleware = (req, res, next) => {
  // Set request ID in context
  if (req.id) {
    httpContext.set('requestId', req.id);
  }

  // Set user ID in context if authenticated
  if (req.session && req.session.userId) {
    httpContext.set('userId', req.session.userId);
    httpContext.set('sessionId', req.session.id);
  }

  // Add response time tracking
  const startTime = Date.now();

  // Capture response metrics when the response is finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;

    // Skip logging for static assets and successful GET requests to reduce noise
    const isStaticAsset = url.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)/);
    const isSuccessfulGet = method === 'GET' && statusCode >= 200 && statusCode < 400;

    // Only log if it's NOT a static asset AND (it's NOT a successful GET request OR it's a slow request)
    if (!isStaticAsset && (!isSuccessfulGet || duration > 500)) {
      logger.info(`${method} ${url} ${statusCode} ${duration}ms`, {
        method,
        url,
        statusCode,
        duration,
        userAgent: req.get('user-agent'),
        referer: req.get('referer'),
        ip: req.ip
      });
    }
  });

  next();
};

// Add a child logger method to create loggers with additional context
logger.child = (defaultMeta) => {
  return winston.createLogger({
    ...logger.configure(),
    defaultMeta: {
      ...logger.defaultMeta,
      ...defaultMeta
    }
  });
};

// Create sanitized version of the logger
const sanitizedLogger = createSanitizedLogger(logger);

// Enhanced AI-friendly logging methods
const enhancedLogger = {
  ...sanitizedLogger,
  
  // Business event logging with structured context
  business: (message, data = {}) => {
    sanitizedLogger.info(message, {
      eventType: 'BUSINESS_EVENT',
      category: 'business',
      severity: 'normal',
      ...data
    });
  },

  // Payment-specific logging
  payment: (message, data = {}) => {
    sanitizedLogger.info(message, {
      eventType: 'PAYMENT_EVENT',
      category: 'business',
      severity: 'normal',
      ...data
    });
  },

  // Security event logging
  security: (message, data = {}) => {
    sanitizedLogger.warn(message, {
      eventType: 'SECURITY_EVENT',
      category: 'security',
      severity: 'high',
      ...data
    });
  },

  // Performance/metric logging
  performance: (message, data = {}) => {
    sanitizedLogger.info(message, {
      eventType: 'PERFORMANCE_METRIC',
      category: 'performance',
      severity: 'normal',
      ...data
    });
  },

  // User action logging
  userAction: (message, data = {}) => {
    sanitizedLogger.info(message, {
      eventType: 'USER_ACTION',
      category: 'user',
      severity: 'normal',
      ...data
    });
  },

  // System lifecycle events
  lifecycle: (message, data = {}) => {
    sanitizedLogger.info(message, {
      eventType: 'LIFECYCLE_EVENT',
      category: 'system',
      severity: 'normal',
      ...data
    });
  },

  // Error with enhanced context
  errorWithContext: (message, error, data = {}) => {
    sanitizedLogger.error(message, {
      eventType: 'ERROR_OCCURRED',
      category: 'system',
      severity: 'high',
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        code: error?.code
      },
      autoRecoverable: false,
      escalationRequired: true,
      ...data
    });
  }
};

// AI Log Analysis Utilities
const logAnalyzer = {
  // Find patterns in log data (would integrate with actual log storage)
  findPatterns: (timeRange, filters) => {
    // Placeholder for pattern analysis
    return {
      patterns: [],
      anomalies: [],
      trends: {}
    };
  },

  // Detect performance anomalies
  detectAnomalies: (baseline, current) => {
    // Placeholder for anomaly detection
    return {
      detected: false,
      severity: 'normal',
      recommendations: []
    };
  },

  // Correlate related events
  correlateEvents: (eventTypes, timeWindow = '5m') => {
    // Placeholder for event correlation
    return {
      correlations: [],
      rootCause: null,
      timeline: []
    };
  }
};

// Performance baseline tracking
const performanceTracker = {
  baselines: new Map(),
  
  setBaseline: (endpoint, avgDuration) => {
    performanceTracker.baselines.set(endpoint, avgDuration);
  },
  
  checkPerformance: (endpoint, duration) => {
    const baseline = performanceTracker.baselines.get(endpoint);
    if (!baseline) return { withinBaseline: true };
    
    const deviation = ((duration - baseline) / baseline) * 100;
    const withinBaseline = Math.abs(deviation) <= 50; // 50% threshold
    
    return {
      withinBaseline,
      baseline,
      current: duration,
      deviation: `${deviation > 0 ? '+' : ''}${Math.round(deviation)}%`,
      trend: deviation > 20 ? 'degrading' : deviation < -20 ? 'improving' : 'stable'
    };
  }
};

module.exports = {
  logger: enhancedLogger, // Export enhanced logger as default
  rawLogger: logger, // Export raw logger for cases where sanitization is not desired
  correlationMiddleware,
  logAnalyzer,
  performanceTracker,
  
  // Export log analyzer for direct access
  analyzer: defaultLogAnalyzer
};
