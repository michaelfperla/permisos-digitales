/**
 * =============================================================================
 * Permisos Digitales - Frontend Logger Utility
 * =============================================================================
 * 
 * A centralized logging utility that replaces direct console.log calls.
 * Features:
 * - Consistent log format with timestamps and module names
 * - Ability to disable logs in production
 * - Log levels (debug, info, warn, error)
 * - Optional remote logging for errors in production
 */

// Configuration
const loggerConfig = {
  // Enable/disable logging based on environment
  // In production, this should be set to false except for errors
  enabled: true,
  
  // Minimum log level to display
  // 0: debug, 1: info, 2: warn, 3: error
  minLevel: 0,
  
  // Whether to include timestamps in logs
  showTimestamps: true,
  
  // Whether to send errors to a remote endpoint
  remoteLogging: false,
  
  // Remote logging endpoint
  remoteEndpoint: '/api/logs',
  
  // Maximum number of logs to keep in memory
  maxMemoryLogs: 100
};

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// In-memory log storage
const memoryLogs = [];

/**
 * Format a log message with timestamp and module name
 * @param {string} level - Log level
 * @param {string} module - Module name
 * @param {string} message - Log message
 * @returns {string} - Formatted log message
 */
function formatLogMessage(level, module, message) {
  const timestamp = loggerConfig.showTimestamps ? 
    `[${new Date().toISOString()}] ` : '';
  
  return `${timestamp}[${level}][${module}] ${message}`;
}

/**
 * Add a log to the in-memory storage
 * @param {string} level - Log level
 * @param {string} module - Module name
 * @param {string} message - Log message
 * @param {*} data - Additional data
 */
function addToMemoryLog(level, module, message, data) {
  // Add to memory logs
  memoryLogs.unshift({
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    data
  });
  
  // Trim logs if they exceed the maximum
  if (memoryLogs.length > loggerConfig.maxMemoryLogs) {
    memoryLogs.pop();
  }
}

/**
 * Send an error log to the remote endpoint
 * @param {string} module - Module name
 * @param {string} message - Error message
 * @param {*} data - Additional error data
 */
async function sendRemoteErrorLog(module, message, data) {
  if (!loggerConfig.remoteLogging) return;
  
  try {
    const response = await fetch(loggerConfig.remoteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        module,
        message,
        data,
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    });
    
    if (!response.ok) {
      // Don't use logger here to avoid infinite loop
      console.error(`Failed to send remote error log: ${response.status}`);
    }
  } catch (err) {
    // Don't use logger here to avoid infinite loop
    console.error('Error sending remote log:', err);
  }
}

/**
 * Main logger object
 */
const logger = {
  /**
   * Log a debug message
   * @param {string} module - Module name
   * @param {string} message - Log message
   * @param {*} [data] - Additional data
   */
  debug(module, message, data) {
    if (!loggerConfig.enabled || LOG_LEVELS.DEBUG < loggerConfig.minLevel) return;
    
    const formattedMessage = formatLogMessage('DEBUG', module, message);
    console.debug(formattedMessage, data !== undefined ? data : '');
    
    addToMemoryLog('DEBUG', module, message, data);
  },
  
  /**
   * Log an info message
   * @param {string} module - Module name
   * @param {string} message - Log message
   * @param {*} [data] - Additional data
   */
  info(module, message, data) {
    if (!loggerConfig.enabled || LOG_LEVELS.INFO < loggerConfig.minLevel) return;
    
    const formattedMessage = formatLogMessage('INFO', module, message);
    console.info(formattedMessage, data !== undefined ? data : '');
    
    addToMemoryLog('INFO', module, message, data);
  },
  
  /**
   * Log a warning message
   * @param {string} module - Module name
   * @param {string} message - Log message
   * @param {*} [data] - Additional data
   */
  warn(module, message, data) {
    if (!loggerConfig.enabled || LOG_LEVELS.WARN < loggerConfig.minLevel) return;
    
    const formattedMessage = formatLogMessage('WARN', module, message);
    console.warn(formattedMessage, data !== undefined ? data : '');
    
    addToMemoryLog('WARN', module, message, data);
  },
  
  /**
   * Log an error message
   * @param {string} module - Module name
   * @param {string} message - Error message
   * @param {*} [error] - Error object or additional data
   */
  error(module, message, error) {
    if (!loggerConfig.enabled || LOG_LEVELS.ERROR < loggerConfig.minLevel) return;
    
    const formattedMessage = formatLogMessage('ERROR', module, message);
    console.error(formattedMessage, error !== undefined ? error : '');
    
    addToMemoryLog('ERROR', module, message, error);
    
    // Send to remote endpoint if enabled
    if (loggerConfig.remoteLogging) {
      sendRemoteErrorLog(module, message, error);
    }
  },
  
  /**
   * Get all logs from memory
   * @returns {Array} - Array of log objects
   */
  getLogs() {
    return [...memoryLogs];
  },
  
  /**
   * Clear all logs from memory
   */
  clearLogs() {
    memoryLogs.length = 0;
  },
  
  /**
   * Configure the logger
   * @param {Object} config - Configuration object
   */
  configure(config) {
    Object.assign(loggerConfig, config);
    
    // In production, set minimum level to WARN by default
    if (config.environment === 'production' && config.minLevel === undefined) {
      loggerConfig.minLevel = LOG_LEVELS.WARN;
    }
  }
};

// Configure logger based on environment
if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
  // Production-like environment
  logger.configure({
    enabled: true,
    minLevel: LOG_LEVELS.WARN,
    remoteLogging: true
  });
}

// Make logger available globally
window.logger = logger;

// Export logger
export default logger;
