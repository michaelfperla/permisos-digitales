/**
 * Debug utility functions
 */

// Enable this to see detailed debug logs
const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';

/**
 * Log debug information to console
 * @param component Component name or identifier
 * @param message Debug message
 * @param data Optional data to log
 */
export const debugLog = (component: string, message: string, data?: any) => {
  if (DEBUG_ENABLED) {
    if (data) {
      console.debug(`[DEBUG][${component}] ${message}`, data);
    } else {
      console.debug(`[DEBUG][${component}] ${message}`);
    }
  }
};

/**
 * Log error information to console
 * @param component Component name or identifier
 * @param message Error message
 * @param error Error object
 */
export const errorLog = (component: string, message: string, error: any) => {
  console.error(`[ERROR][${component}] ${message}`, error);

  // Log additional error details if available
  if (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`[ERROR][${component}] Response data:`, error.response.data);
      console.error(`[ERROR][${component}] Response status:`, error.response.status);
      console.error(`[ERROR][${component}] Response headers:`, error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error(`[ERROR][${component}] No response received:`, error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error(`[ERROR][${component}] Error message:`, error.message);
    }
    console.error(`[ERROR][${component}] Error config:`, error.config);

    // Log stack trace
    if (error.stack) {
      console.error(`[ERROR][${component}] Stack trace:`, error.stack);
    }
  }
};

/**
 * Create a global error handler to catch unhandled errors
 */
export const setupGlobalErrorHandler = () => {
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('[GLOBAL ERROR]', {
      message,
      source,
      lineno,
      colno,
      error,
    });
    return false; // Let default handler run
  };

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[UNHANDLED PROMISE REJECTION]', event.reason);
  });
};
