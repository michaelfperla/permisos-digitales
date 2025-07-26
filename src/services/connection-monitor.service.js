/**
 * Connection Monitor Service
 * 
 * Monitors database and Redis connections
 * Implements auto-reconnect logic
 * Prevents app crashes on connection loss
 */

const { logger } = require('../utils/logger');
const EventEmitter = require('events');

class ConnectionMonitorService extends EventEmitter {
  constructor() {
    super();
    this.monitors = new Map();
    this.intervals = new Map();
    this.reconnectAttempts = new Map();
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000; // Start with 5 seconds
    this.maxReconnectDelay = 60000; // Max 1 minute
    this.checkInterval = 30000; // Check every 30 seconds
  }

  /**
   * Register a connection to monitor
   */
  registerConnection(name, options) {
    const monitor = {
      name,
      type: options.type, // 'database' or 'redis'
      checkHealth: options.checkHealth,
      reconnect: options.reconnect,
      onDisconnect: options.onDisconnect,
      onReconnect: options.onReconnect,
      isHealthy: true,
      lastCheck: Date.now(),
      consecutiveFailures: 0
    };

    this.monitors.set(name, monitor);
    this.reconnectAttempts.set(name, 0);

    // Start monitoring
    this.startMonitoring(name);

    logger.info(`[ConnectionMonitor] Registered ${name} for monitoring`);
  }

  /**
   * Start monitoring a connection
   */
  startMonitoring(name) {
    const monitor = this.monitors.get(name);
    if (!monitor) return;

    // Clear existing interval if any
    if (this.intervals.has(name)) {
      clearInterval(this.intervals.get(name));
    }

    // Set up periodic health checks
    const interval = setInterval(async () => {
      await this.checkConnection(name);
    }, this.checkInterval);

    this.intervals.set(name, interval);

    // Do an immediate check
    this.checkConnection(name);
  }

  /**
   * Check connection health
   */
  async checkConnection(name) {
    const monitor = this.monitors.get(name);
    if (!monitor) return;

    try {
      // Call the health check function
      const isHealthy = await monitor.checkHealth();
      
      if (isHealthy) {
        // Connection is healthy
        if (!monitor.isHealthy) {
          // Was unhealthy, now recovered
          logger.info(`[ConnectionMonitor] ${name} connection recovered`);
          monitor.isHealthy = true;
          monitor.consecutiveFailures = 0;
          this.reconnectAttempts.set(name, 0);
          
          // Call recovery callback
          if (monitor.onReconnect) {
            await monitor.onReconnect();
          }
          
          this.emit('connection-recovered', { name, type: monitor.type });
        }
        monitor.lastCheck = Date.now();
      } else {
        throw new Error('Health check returned false');
      }
    } catch (error) {
      // Connection is unhealthy
      monitor.consecutiveFailures++;
      
      if (monitor.isHealthy) {
        // First failure
        logger.error(`[ConnectionMonitor] ${name} connection lost`, {
          error: error.message,
          consecutiveFailures: monitor.consecutiveFailures
        });
        
        monitor.isHealthy = false;
        
        // Call disconnect callback
        if (monitor.onDisconnect) {
          await monitor.onDisconnect();
        }
        
        this.emit('connection-lost', { name, type: monitor.type, error });
      }
      
      // Attempt reconnection
      await this.attemptReconnection(name);
    }
  }

  /**
   * Attempt to reconnect
   */
  async attemptReconnection(name) {
    const monitor = this.monitors.get(name);
    if (!monitor || !monitor.reconnect) return;

    const attempts = this.reconnectAttempts.get(name) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      logger.error(`[ConnectionMonitor] ${name} max reconnection attempts reached`, {
        attempts: this.maxReconnectAttempts
      });
      
      this.emit('connection-failed', { 
        name, 
        type: monitor.type, 
        reason: 'max_attempts_reached' 
      });
      
      // In production with PM2, let the process restart
      if (process.env.NODE_ENV === 'production') {
        logger.error(`[ConnectionMonitor] Critical: ${name} connection cannot be restored. Exiting for PM2 restart...`);
        process.exit(1);
      }
      return;
    }

    // Calculate backoff delay
    const delay = Math.min(
      this.reconnectDelay * Math.pow(1.5, attempts),
      this.maxReconnectDelay
    );

    logger.info(`[ConnectionMonitor] Attempting ${name} reconnection in ${delay}ms (attempt ${attempts + 1}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        // Attempt reconnection
        await monitor.reconnect();
        
        // If successful, the next health check will detect it
        logger.info(`[ConnectionMonitor] ${name} reconnection attempt completed`);
      } catch (error) {
        logger.error(`[ConnectionMonitor] ${name} reconnection failed`, {
          error: error.message,
          attempt: attempts + 1
        });
        
        this.reconnectAttempts.set(name, attempts + 1);
      }
    }, delay);
  }

  /**
   * Stop monitoring a connection
   */
  stopMonitoring(name) {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
    
    this.monitors.delete(name);
    this.reconnectAttempts.delete(name);
    
    logger.info(`[ConnectionMonitor] Stopped monitoring ${name}`);
  }

  /**
   * Stop all monitoring
   */
  async shutdown() {
    logger.info('[ConnectionMonitor] Shutting down connection monitoring...');
    
    // Stop all intervals
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
    }
    
    this.intervals.clear();
    this.monitors.clear();
    this.reconnectAttempts.clear();
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    const status = {};
    
    for (const [name, monitor] of this.monitors) {
      status[name] = {
        isHealthy: monitor.isHealthy,
        lastCheck: monitor.lastCheck,
        consecutiveFailures: monitor.consecutiveFailures,
        reconnectAttempts: this.reconnectAttempts.get(name) || 0,
        uptime: monitor.isHealthy ? Date.now() - monitor.lastCheck : 0
      };
    }
    
    return status;
  }
}

// Export singleton instance
module.exports = new ConnectionMonitorService();