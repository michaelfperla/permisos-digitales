/**
 * Production-ready logger utility with environment-based configuration
 * Replaces console statements with structured logging
 */

const IS_DEVELOPMENT = import.meta.env.DEV;
const IS_PRODUCTION = import.meta.env.PROD;

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  context?: string;
  data?: any;
}

class Logger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private formatMessage(level: string, message: string, data?: any): LogEntry {
    return {
      level: level as LogEntry['level'],
      message,
      timestamp: new Date().toISOString(),
      context: this.context,
      data,
    };
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
    const logEntry = this.formatMessage(level, message, data);

    // In development, use console methods for better debugging
    if (IS_DEVELOPMENT) {
      switch (level) {
        case 'debug':
          if (data) {
            console.debug(`[${this.context || 'APP'}] ${message}`, data);
          } else {
            console.debug(`[${this.context || 'APP'}] ${message}`);
          }
          break;
        case 'info':
          if (data) {
            console.info(`[${this.context || 'APP'}] ${message}`, data);
          } else {
            console.info(`[${this.context || 'APP'}] ${message}`);
          }
          break;
        case 'warn':
          if (data) {
            console.warn(`[${this.context || 'APP'}] ${message}`, data);
          } else {
            console.warn(`[${this.context || 'APP'}] ${message}`);
          }
          break;
        case 'error':
          if (data) {
            console.error(`[${this.context || 'APP'}] ${message}`, data);
          } else {
            console.error(`[${this.context || 'APP'}] ${message}`);
          }
          break;
      }
    } else if (IS_PRODUCTION) {
      // In production, only log errors and warnings
      if (level === 'error' || level === 'warn') {
        // Send to external logging service or use structured console output
        console.log(JSON.stringify(logEntry));
      }
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  /**
   * Create a new logger instance with a specific context
   */
  withContext(context: string): Logger {
    return new Logger(context);
  }
}

// Convenience function to create contextual loggers
export const createLogger = (context: string) => new Logger(context);

// Default logger instance
const logger = new Logger();

// Export both the class and default instance
export { Logger };
export { logger };
export default logger;