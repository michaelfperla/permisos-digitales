const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';

/**
 * Log debug information in development
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
 * Log error information with detailed context
 */
export const errorLog = (component: string, message: string, error: any) => {
  console.error(`[ERROR][${component}] ${message}`, error);

  if (error) {
    if (error.response) {
      console.error(`[ERROR][${component}] Response data:`, error.response.data);
      console.error(`[ERROR][${component}] Response status:`, error.response.status);
      console.error(`[ERROR][${component}] Response headers:`, error.response.headers);
    } else if (error.request) {
      console.error(`[ERROR][${component}] No response received:`, error.request);
    } else {
      console.error(`[ERROR][${component}] Error message:`, error.message);
    }
    console.error(`[ERROR][${component}] Error config:`, error.config);

    if (error.stack) {
      console.error(`[ERROR][${component}] Stack trace:`, error.stack);
    }
  }
};

/**
 * Set up global error handlers for unhandled errors and promise rejections
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
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[UNHANDLED PROMISE REJECTION]', event.reason);
  });
};
