// Simplified memory cleanup utilities
import { logger } from './logger';

// Legacy function kept for compatibility - does not actually clean timers
// Components should properly clean up their own timers in useEffect cleanup
export const cleanupAllTimers = () => {
  logger.debug('Legacy cleanup called - components should handle their own cleanup');
};

// Monitor memory usage (development only)
export const logMemoryUsage = () => {
  // Only log memory in development to avoid production overhead
  if (import.meta.env.DEV && 'memory' in performance) {
    const memory = (performance as any).memory;
    logger.debug('Memory usage:', {
      usedJSHeapSize: `${(memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
      totalJSHeapSize: `${(memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
      jsHeapSizeLimit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
    });
  }
};

// Cleanup global DOM state on route change
export const cleanupEventListeners = () => {
  // Reset body overflow that may have been set by modals/drawers
  if (document.body.style.overflow) {
    document.body.style.overflow = '';
  }
  
  // Components should clean up their own event listeners in useEffect cleanup
  logger.debug('Global DOM cleanup completed');
};

// Simplified initialization - no timer tracking overhead
export const initializeTimerTracking = () => {
  // No-op - timer tracking removed for production performance
  logger.debug('Memory cleanup initialized without timer tracking overhead');
};

// Force garbage collection hint for development
export const forceGarbageCollection = () => {
  if (import.meta.env.DEV && window.gc) {
    try {
      window.gc();
      logger.debug('Garbage collection triggered');
    } catch (error) {
      logger.debug('Garbage collection not available');
    }
  }
};