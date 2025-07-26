/**
 * Permisos Digitales Redis Connection Manager
 * Unified Redis management for production ElastiCache and development
 * 
 * @module PermisosRedisManager
 */

const Redis = require('ioredis');
const { logger } = require('../../utils/logger');

// Redis status constants
const REDIS_STATUS_INITIALIZING = 'initializing';
const REDIS_STATUS_CONNECTED = 'connected';
const REDIS_STATUS_DEGRADED = 'degraded';
const REDIS_STATUS_DISCONNECTED = 'disconnected';
const REDIS_STATUS_MOCK = 'mock';
const REDIS_STATUS_ERROR = 'error';

// Configuration constants
const REDIS_CONNECTION_TIMEOUT = 10000;
const REDIS_HEALTH_CHECK_INTERVAL = 30000;
const REDIS_RETRY_ATTEMPTS = 10;
const REDIS_MAX_COMMAND_TIMEOUT = 5000;

/**
 * Enhanced Mock Redis Client for Development
 * Provides accurate Redis-like behavior for testing
 */
class PermisosMockRedisClient {
  constructor() {
    this.data = new Map();
    this.expirations = new Map();
    this.keyPrefix = 'mock:';
    this.status = 'ready';
    
    // Cleanup expired keys every minute
    this.cleanupInterval = setInterval(() => this.cleanupExpiredKeys(), 60000);
    
    // Event emitter simulation
    this.eventHandlers = new Map();
    
    logger.info('[PermisosMockRedis] Mock Redis client initialized');
  }

  // Core Redis commands
  async get(key) {
    this.cleanupExpiredKeys();
    const prefixedKey = this.keyPrefix + key;
    
    if (this.isExpired(prefixedKey)) {
      this.data.delete(prefixedKey);
      this.expirations.delete(prefixedKey);
      return null;
    }
    
    return this.data.get(prefixedKey) || null;
  }

  async set(key, value, expiryMode, time) {
    const prefixedKey = this.keyPrefix + key;
    this.data.set(prefixedKey, String(value));
    
    if (expiryMode === 'EX' && time) {
      const expiry = Date.now() + (time * 1000);
      this.expirations.set(prefixedKey, expiry);
    } else if (expiryMode === 'PX' && time) {
      const expiry = Date.now() + time;
      this.expirations.set(prefixedKey, expiry);
    }
    
    return 'OK';
  }

  async incr(key) {
    const prefixedKey = this.keyPrefix + key;
    this.cleanupExpiredKeys();
    
    if (this.isExpired(prefixedKey)) {
      this.data.delete(prefixedKey);
      this.expirations.delete(prefixedKey);
    }
    
    const currentValue = this.data.get(prefixedKey);
    const newValue = currentValue ? parseInt(currentValue, 10) + 1 : 1;
    this.data.set(prefixedKey, String(newValue));
    
    return newValue;
  }

  async expire(key, seconds) {
    const prefixedKey = this.keyPrefix + key;
    
    if (this.data.has(prefixedKey)) {
      const expiry = Date.now() + (seconds * 1000);
      this.expirations.set(prefixedKey, expiry);
      return 1;
    }
    
    return 0;
  }

  async ttl(key) {
    const prefixedKey = this.keyPrefix + key;
    this.cleanupExpiredKeys();
    
    if (!this.data.has(prefixedKey)) return -2; // Key doesn't exist
    if (!this.expirations.has(prefixedKey)) return -1; // Key exists but has no expiry
    
    const expiry = this.expirations.get(prefixedKey);
    const now = Date.now();
    const ttl = Math.ceil((expiry - now) / 1000);
    
    return ttl > 0 ? ttl : -2;
  }

  async exists(key) {
    const prefixedKey = this.keyPrefix + key;
    this.cleanupExpiredKeys();
    
    if (this.isExpired(prefixedKey)) {
      this.data.delete(prefixedKey);
      this.expirations.delete(prefixedKey);
      return 0;
    }
    
    return this.data.has(prefixedKey) ? 1 : 0;
  }

  async del(...keys) {
    let count = 0;
    
    for (const key of keys) {
      const prefixedKey = this.keyPrefix + key;
      if (this.data.delete(prefixedKey)) count++;
      this.expirations.delete(prefixedKey);
    }
    
    return count;
  }

  // Additional Redis commands for completeness
  async ping() {
    return 'PONG';
  }

  async flushall() {
    this.data.clear();
    this.expirations.clear();
    return 'OK';
  }

  async keys(pattern) {
    const regex = this.patternToRegex(pattern);
    const matchingKeys = [];
    
    for (const [key] of this.data) {
      if (regex.test(key)) {
        matchingKeys.push(key.replace(this.keyPrefix, ''));
      }
    }
    
    return matchingKeys;
  }

  // Helper methods
  isExpired(key) {
    if (!this.expirations.has(key)) return false;
    
    const expiry = this.expirations.get(key);
    return Date.now() > expiry;
  }

  cleanupExpiredKeys() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, expiry] of this.expirations) {
      if (now > expiry) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.data.delete(key);
      this.expirations.delete(key);
    }
  }

  patternToRegex(pattern) {
    // Convert Redis pattern to regex
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = escaped.replace(/\\\*/g, '.*').replace(/\\\?/g, '.');
    return new RegExp(`^${this.keyPrefix}${regex}$`);
  }

  // Event emitter methods
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
    return this;
  }

  emit(event, ...args) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }

  // Cleanup
  disconnect() {
    clearInterval(this.cleanupInterval);
    this.data.clear();
    this.expirations.clear();
    this.eventHandlers.clear();
    this.status = 'disconnected';
  }
}

/**
 * Unified Redis Connection Manager
 */
class PermisosRedisManager {
  constructor(redisConfig) {
    this.config = redisConfig || {};
    this.client = null;
    this.connectionStatus = REDIS_STATUS_INITIALIZING;
    this.reconnectAttempts = 0;
    this.lastError = null;
    this.useMockClient = false;
    this.healthCheckInterval = null;
    this.connectionTimeout = null;
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Performance tracking
    this.commandMetrics = new Map();
    this.slowCommandThreshold = 50; // milliseconds
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    logger.info('[PermisosRedisManager] Initializing Redis connection...');
    
    try {
      await this.determineConnectionStrategy();
      await this.createRedisClient();
      await this.testConnection();
      this.startHealthMonitoring();
      
      logger.info(`[PermisosRedisManager] Redis initialized successfully (${this.connectionStatus})`);
      return true;
    } catch (error) {
      logger.error('[PermisosRedisManager] Failed to initialize Redis:', error);
      this.connectionStatus = REDIS_STATUS_ERROR;
      this.lastError = error;
      
      // In production, throw error. In development, continue with mock
      if (this.isProduction) {
        throw error;
      }
      
      return false;
    }
  }

  /**
   * Determine connection strategy based on configuration and environment
   */
  async determineConnectionStrategy() {
    // Check if Redis host is configured
    if (!this.config.host || this.config.host === 'localhost') {
      if (this.isProduction) {
        throw new Error('Redis host configuration is required in production');
      } else {
        logger.warn('[PermisosRedisManager] No Redis host configured, using mock client');
        this.useMockClient = true;
      }
    }
    
    // Validate production requirements
    if (this.isProduction && !this.config.tls) {
      logger.warn('[PermisosRedisManager] TLS not configured for production Redis');
    }
  }

  /**
   * Create Redis client based on strategy
   */
  async createRedisClient() {
    if (this.useMockClient) {
      this.client = new PermisosMockRedisClient();
      this.connectionStatus = REDIS_STATUS_MOCK;
      
      // Simulate connection events
      setTimeout(() => {
        this.client.emit('connect');
        this.client.emit('ready');
      }, 100);
    } else {
      this.client = this.createIORedisClient();
      this.setupConnectionEventHandlers();
    }
  }

  /**
   * Create IORedis client with proper configuration
   */
  createIORedisClient() {
    const options = {
      host: this.config.host,
      port: this.config.port || 6379,
      password: this.config.password,
      connectTimeout: this.config.connectTimeout || REDIS_CONNECTION_TIMEOUT,
      maxRetriesPerRequest: this.config.maxRetriesPerRequest || 3,
      retryStrategy: this.buildRetryStrategy(),
      enableReadyCheck: true,
      lazyConnect: false,
      keyPrefix: this.config.keyPrefix || 'pd:',
      
      // Performance optimizations
      enableOfflineQueue: true,
      commandTimeout: REDIS_MAX_COMMAND_TIMEOUT,
      
      // Connection name for monitoring
      connectionName: `permisos-${process.env.NODE_ENV || 'unknown'}`
    };
    
    // Add TLS for production ElastiCache
    if (this.config.tls) {
      options.tls = this.config.tls;
      logger.info('[PermisosRedisManager] Configuring TLS for ElastiCache connection');
    }
    
    return new Redis(options);
  }

  /**
   * Build retry strategy for Redis connection
   */
  buildRetryStrategy() {
    return (times) => {
      this.reconnectAttempts = times;
      
      // Give up after too many attempts
      if (times > REDIS_RETRY_ATTEMPTS) {
        logger.error(`[PermisosRedisManager] Max reconnection attempts (${REDIS_RETRY_ATTEMPTS}) exceeded`);
        this.connectionStatus = REDIS_STATUS_ERROR;
        return null; // Stop retrying
      }
      
      // Exponential backoff with jitter
      const baseDelay = Math.min(times * 1000, 5000);
      const jitter = Math.random() * 500;
      const delay = baseDelay + jitter;
      
      logger.warn(`[PermisosRedisManager] Retrying connection in ${Math.round(delay)}ms (attempt ${times})`);
      return delay;
    };
  }

  /**
   * Setup connection event handlers
   */
  setupConnectionEventHandlers() {
    this.client.on('connect', () => {
      logger.info('[PermisosRedisManager] Redis connected');
      this.connectionStatus = REDIS_STATUS_CONNECTED;
      this.reconnectAttempts = 0;
      clearTimeout(this.connectionTimeout);
    });
    
    this.client.on('ready', () => {
      logger.info('[PermisosRedisManager] Redis ready to accept commands');
      this.connectionStatus = REDIS_STATUS_CONNECTED;
    });
    
    this.client.on('error', (error) => {
      // Only log if error is different from last
      if (!this.lastError || this.lastError.message !== error.message) {
        logger.error('[PermisosRedisManager] Redis error:', error.message);
      }
      this.lastError = error;
      
      // Don't change status to error immediately - let retry strategy handle it
      if (this.connectionStatus === REDIS_STATUS_CONNECTED) {
        this.connectionStatus = REDIS_STATUS_DEGRADED;
      }
    });
    
    this.client.on('close', () => {
      logger.warn('[PermisosRedisManager] Redis connection closed');
      this.connectionStatus = REDIS_STATUS_DISCONNECTED;
    });
    
    this.client.on('reconnecting', (delay) => {
      logger.info(`[PermisosRedisManager] Reconnecting to Redis in ${delay}ms`);
      this.connectionStatus = REDIS_STATUS_DEGRADED;
    });
    
    this.client.on('end', () => {
      logger.error('[PermisosRedisManager] Redis connection terminated');
      this.connectionStatus = REDIS_STATUS_DISCONNECTED;
    });
  }

  /**
   * Test Redis connection
   */
  async testConnection() {
    if (this.useMockClient) {
      logger.info('[PermisosRedisManager] Mock client connection test passed');
      return true;
    }
    
    return new Promise((resolve, reject) => {
      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        const error = new Error('Redis connection timeout');
        this.lastError = error;
        this.connectionStatus = REDIS_STATUS_ERROR;
        reject(error);
      }, REDIS_CONNECTION_TIMEOUT);
      
      // Wait for ready event
      if (this.client.status === 'ready') {
        clearTimeout(this.connectionTimeout);
        resolve(true);
      } else {
        this.client.once('ready', () => {
          clearTimeout(this.connectionTimeout);
          resolve(true);
        });
        
        this.client.once('error', (error) => {
          clearTimeout(this.connectionTimeout);
          reject(error);
        });
      }
    });
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    // Clear existing interval if any
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        if (this.useMockClient) {
          // Mock client is always healthy
          return;
        }
        
        // Perform health check
        const start = Date.now();
        await this.client.ping();
        const duration = Date.now() - start;
        
        if (duration > 1000) {
          logger.warn(`[PermisosRedisManager] Health check slow: ${duration}ms`);
        }
        
        // Update status if degraded
        if (this.connectionStatus === REDIS_STATUS_DEGRADED) {
          this.connectionStatus = REDIS_STATUS_CONNECTED;
          logger.info('[PermisosRedisManager] Connection recovered');
        }
      } catch (error) {
        logger.error('[PermisosRedisManager] Health check failed:', error.message);
        this.connectionStatus = REDIS_STATUS_DEGRADED;
        this.lastError = error;
      }
    }, REDIS_HEALTH_CHECK_INTERVAL);
  }

  /**
   * Execute Redis command with proper error handling
   */
  async executeCommand(command, args = []) {
    const start = Date.now();
    
    try {
      // Use mock client directly if available
      if (this.useMockClient) {
        const result = await this.client[command](...args);
        this.trackCommandMetrics(command, Date.now() - start, true);
        return result;
      }
      
      // Check connection status
      if (this.connectionStatus !== REDIS_STATUS_CONNECTED && 
          this.connectionStatus !== REDIS_STATUS_DEGRADED) {
        logger.warn(`[PermisosRedisManager] Redis unavailable (${this.connectionStatus}), returning default for ${command}`);
        return this.getDefaultResponseForCommand(command);
      }
      
      // Execute command
      const result = await this.client[command](...args);
      const duration = Date.now() - start;
      
      this.trackCommandMetrics(command, duration, true);
      
      // Log slow commands
      if (duration > this.slowCommandThreshold) {
        logger.warn(`[PermisosRedisManager] Slow command: ${command} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.trackCommandMetrics(command, duration, false);
      
      this.handleCommandError(command, error);
      return this.getDefaultResponseForCommand(command);
    }
  }

  /**
   * Track command metrics for monitoring
   */
  trackCommandMetrics(command, duration, success) {
    if (!this.commandMetrics.has(command)) {
      this.commandMetrics.set(command, {
        count: 0,
        errors: 0,
        totalDuration: 0,
        maxDuration: 0
      });
    }
    
    const metrics = this.commandMetrics.get(command);
    metrics.count++;
    metrics.totalDuration += duration;
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    
    if (!success) {
      metrics.errors++;
    }
  }

  /**
   * Handle command execution errors
   */
  handleCommandError(command, error) {
    // Log error with rate limiting
    const key = `${command}:${error.message}`;
    const now = Date.now();
    
    if (!this.errorLog) {
      this.errorLog = new Map();
    }
    
    const lastLogged = this.errorLog.get(key) || 0;
    if (now - lastLogged > 60000) { // Log same error max once per minute
      logger.error(`[PermisosRedisManager] Command ${command} failed:`, error.message);
      this.errorLog.set(key, now);
    }
    
    this.lastError = error;
  }

  /**
   * Get default response for failed commands
   */
  getDefaultResponseForCommand(command) {
    const defaults = {
      get: null,
      exists: 0,
      ttl: -2,
      incr: 1,
      del: 0,
      ping: 'PONG',
      keys: [],
      set: 'OK',
      expire: 0
    };
    
    return defaults[command] || null;
  }

  /**
   * Get comprehensive health status
   */
  getHealthStatus() {
    const metrics = this.getCommandMetrics();
    
    return {
      status: this.connectionStatus,
      connected: this.client?.status === 'ready',
      mockClient: this.useMockClient,
      reconnectAttempts: this.reconnectAttempts,
      lastError: this.lastError?.message || null,
      host: this.config.host || 'mock',
      port: this.config.port || 6379,
      tlsEnabled: !!this.config.tls,
      keyPrefix: this.config.keyPrefix || 'pd:',
      uptime: this.client?.connector?.stream?.connecting ? 0 : Date.now() - (this.client?.connector?.stream?.connectTime || Date.now()),
      metrics: {
        totalCommands: metrics.totalCommands,
        totalErrors: metrics.totalErrors,
        avgDuration: metrics.avgDuration,
        slowCommands: metrics.slowCommands
      }
    };
  }

  /**
   * Get command metrics summary
   */
  getCommandMetrics() {
    let totalCommands = 0;
    let totalErrors = 0;
    let totalDuration = 0;
    let slowCommands = 0;
    
    for (const [, metrics] of this.commandMetrics) {
      totalCommands += metrics.count;
      totalErrors += metrics.errors;
      totalDuration += metrics.totalDuration;
      
      if (metrics.maxDuration > this.slowCommandThreshold) {
        slowCommands++;
      }
    }
    
    return {
      totalCommands,
      totalErrors,
      avgDuration: totalCommands > 0 ? Math.round(totalDuration / totalCommands) : 0,
      slowCommands,
      byCommand: Object.fromEntries(this.commandMetrics)
    };
  }

  /**
   * Gracefully shutdown Redis connection
   */
  async shutdown() {
    logger.info('[PermisosRedisManager] Shutting down Redis connection...');
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Clear connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    // Disconnect client
    if (this.client) {
      if (this.useMockClient) {
        this.client.disconnect();
      } else {
        await this.client.quit();
      }
      
      this.client = null;
    }
    
    this.connectionStatus = REDIS_STATUS_DISCONNECTED;
    logger.info('[PermisosRedisManager] Redis shutdown complete');
  }
}

module.exports = { PermisosRedisManager, PermisosMockRedisClient };