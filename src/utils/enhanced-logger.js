/**
 * Enhanced Logger with Correlation IDs
 * Provides structured logging with request context
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const httpContext = require('express-http-context');

// Ensure log directory exists
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define custom format for structured logs
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
  if (sessionId) info.sessionId = sessionId;

  return info;
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

module.exports = {
  logger,
  correlationMiddleware
};
