/**
 * Core Logger Module
 * Simple, reliable, fail-safe logging
 * 
 * Design principles:
 * - Never crash the application
 * - Start simple, enhance progressively
 * - Work even if Winston fails
 * - No complex dependencies at module level
 */

const winston = require('winston');
const path = require('path');

// Fallback console logger in case Winston fails
const fallbackLogger = {
  error: (...args) => console.error('[ERROR]', new Date().toISOString(), ...args),
  warn: (...args) => console.warn('[WARN]', new Date().toISOString(), ...args),
  info: (...args) => console.log('[INFO]', new Date().toISOString(), ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  },
  verbose: (...args) => {
    if (process.env.LOG_LEVEL === 'verbose') {
      console.log('[VERBOSE]', new Date().toISOString(), ...args);
    }
  }
};

// Logger configuration based on environment
function getLoggerConfig() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');
  
  return {
    level: logLevel,
    isDevelopment,
    // Only try to write to files in production
    useFileTransport: !isDevelopment && process.env.LOG_TO_FILE !== 'false',
    // Pretty print in development
    prettyPrint: isDevelopment && process.env.LOG_PRETTY !== 'false'
  };
}

// Create Winston logger with safe configuration
function createWinstonLogger() {
  try {
    const config = getLoggerConfig();
    const transports = [];
    
    // Console transport - always enabled
    if (config.isDevelopment && config.prettyPrint) {
      // Pretty console output for development
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            let msg = `${timestamp} ${level}: ${message}`;
            if (Object.keys(meta).length > 0) {
              // Filter out some noisy meta fields
              const { service, environment, ...cleanMeta } = meta;
              if (Object.keys(cleanMeta).length > 0) {
                msg += ' ' + JSON.stringify(cleanMeta, null, 2);
              }
            }
            return msg;
          })
        )
      }));
    } else {
      // JSON output for production
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      }));
    }
    
    // File transport - only in production and if enabled
    if (config.useFileTransport) {
      try {
        const logDir = path.join(process.cwd(), 'logs');
        
        transports.push(new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }));
        
        transports.push(new winston.transports.File({
          filename: path.join(logDir, 'app.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }));
      } catch (error) {
        // If file transport fails, just use console
        console.warn('Failed to setup file logging:', error.message);
      }
    }
    
    const logger = winston.createLogger({
      level: config.level,
      defaultMeta: { 
        service: 'permisos-digitales',
        environment: process.env.NODE_ENV || 'development'
      },
      transports
    });
    
    // Add convenience methods
    logger.withContext = function(context) {
      return {
        error: (message, meta = {}) => this.error(message, { ...context, ...meta }),
        warn: (message, meta = {}) => this.warn(message, { ...context, ...meta }),
        info: (message, meta = {}) => this.info(message, { ...context, ...meta }),
        debug: (message, meta = {}) => this.debug(message, { ...context, ...meta })
      };
    };
    
    // Add timer function for performance tracking
    logger.time = function(label) {
      const start = Date.now();
      return {
        end: (message, meta = {}) => {
          const duration = Date.now() - start;
          this.info(message || `${label} completed`, { 
            ...meta, 
            duration, 
            durationPretty: `${duration}ms` 
          });
        }
      };
    };
    
    return logger;
    
  } catch (error) {
    console.error('Failed to create Winston logger, using fallback:', error.message);
    return fallbackLogger;
  }
}

// Create and export logger instance
let logger;
try {
  logger = createWinstonLogger();
} catch (error) {
  console.error('Critical logger error, using fallback:', error);
  logger = fallbackLogger;
}

// Export both logger instance and utility functions
module.exports = {
  logger,
  
  // Re-export log levels for convenience
  error: (...args) => logger.error(...args),
  warn: (...args) => logger.warn(...args),
  info: (...args) => logger.info(...args),
  debug: (...args) => logger.debug(...args),
  
  // Utility to create child loggers
  createLogger: (defaultMeta = {}) => {
    if (logger.child) {
      return logger.child(defaultMeta);
    }
    // Fallback for simple logger
    return {
      error: (msg, meta) => logger.error(msg, { ...defaultMeta, ...meta }),
      warn: (msg, meta) => logger.warn(msg, { ...defaultMeta, ...meta }),
      info: (msg, meta) => logger.info(msg, { ...defaultMeta, ...meta }),
      debug: (msg, meta) => logger.debug(msg, { ...defaultMeta, ...meta })
    };
  },
  
  // Test function to verify logger is working
  test: () => {
    logger.info('Logger test - INFO level');
    logger.debug('Logger test - DEBUG level');
    logger.warn('Logger test - WARN level');
    logger.error('Logger test - ERROR level');
    return true;
  }
};