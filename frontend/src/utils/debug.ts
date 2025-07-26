import { logger } from './logger';

const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';

/**
 * Log debug information in development
 */
export const debugLog = (component: string, message: string, data?: any) => {
  if (DEBUG_ENABLED) {
    if (data) {
      logger.debug(`[DEBUG][${component}] ${message}`, data);
    } else {
      logger.debug(`[DEBUG][${component}] ${message}`);
    }
  }
};

/**
 * Log error information with detailed context
 */
export const errorLog = (component: string, message: string, error: any) => {
  logger.error(`[ERROR][${component}] ${message}`, error);

  if (error) {
    if (error.response) {
      logger.error(`[ERROR][${component}] Response data:`, error.response.data);
      logger.error(`[ERROR][${component}] Response status:`, error.response.status);
      logger.error(`[ERROR][${component}] Response headers:`, error.response.headers);
    } else if (error.request) {
      logger.error(`[ERROR][${component}] No response received:`, error.request);
    } else {
      logger.error(`[ERROR][${component}] Error message:`, error.message);
    }
    logger.error(`[ERROR][${component}] Error config:`, error.config);

    if (error.stack) {
      logger.error(`[ERROR][${component}] Stack trace:`, error.stack);
    }
  }
};

/**
 * Set up global error handlers for unhandled errors and promise rejections
 */
export const setupGlobalErrorHandler = () => {
  window.onerror = (message, source, lineno, colno, error) => {
    logger.error('[GLOBAL ERROR]', {
      message,
      source,
      lineno,
      colno,
      error,
    });
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('[UNHANDLED PROMISE REJECTION]', event.reason);
  });
};
