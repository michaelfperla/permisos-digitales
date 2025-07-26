/**
 * Permisos Digitales Database Connection Manager
 * Proactive connection management with health monitoring
 * 
 * This replaces the lazy-loading approach with a robust, proactive system
 * that initializes connections before they're needed and provides
 * comprehensive health monitoring.
 * 
 * @module PermisosDatabaseManager
 */

const { Pool } = require('pg');
const { logger } = require('../../utils/logger');
const EventEmitter = require('events');

// Connection status constants
const DB_STATUS_INITIALIZING = 'DB_STATUS_INITIALIZING';
const DB_STATUS_HEALTHY = 'DB_STATUS_HEALTHY';
const DB_STATUS_DEGRADED = 'DB_STATUS_DEGRADED';
const DB_STATUS_FAILED = 'DB_STATUS_FAILED';

// Health check intervals
const DB_HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const DB_CONNECTION_TIMEOUT = 5000; // 5 seconds
const MAX_CONNECTION_ATTEMPTS = 3;
const CONNECTION_RETRY_DELAY = 1000; // Start with 1 second

class PermisosDatabaseManager extends EventEmitter {
  constructor(databaseConfig) {
    super();
    
    if (!databaseConfig) {
      throw new Error('Database configuration is required');
    }
    
    this.config = databaseConfig;
    this.pool = null;
    this.healthStatus = DB_STATUS_INITIALIZING;
    this.connectionAttempts = 0;
    this.lastHealthCheck = null;
    this.healthCheckInterval = null;
    this.isShuttingDown = false;
    
    // Performance metrics
    this.metrics = {
      totalQueries: 0,
      failedQueries: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      connectionErrors: 0,
      poolExhausted: 0
    };
    
    // Bind methods to ensure correct context
    this.query = this.query.bind(this);
    this.getPool = this.getPool.bind(this);
    this.testConnection = this.testConnection.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }

  /**
   * Initialize the database manager
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.info('[DatabaseManager] Initializing database connection manager...');
    
    try {
      // Validate configuration
      await this.validateConfiguration();
      
      // Test connection reliability with retries
      await this.testConnectionReliability();
      
      // Create connection pool
      this.createConnectionPool();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.healthStatus = DB_STATUS_HEALTHY;
      logger.info('[DatabaseManager] Database manager initialized successfully');
      
      this.emit('initialized');
    } catch (error) {
      this.healthStatus = DB_STATUS_FAILED;
      logger.error('[DatabaseManager] Failed to initialize database manager:', error);
      throw error;
    }
  }

  /**
   * Validate database configuration
   * @private
   */
  async validateConfiguration() {
    logger.debug('[DatabaseManager] Validating database configuration...');
    
    if (!this.config.url) {
      throw new Error('Database URL is required');
    }
    
    // Parse connection string to validate format
    try {
      const url = new URL(this.config.url);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('Invalid database protocol. Must be postgres:// or postgresql://');
      }
    } catch (error) {
      throw new Error(`Invalid database URL: ${error.message}`);
    }
    
    // SSL is disabled for AWS RDS within VPC
    if (process.env.NODE_ENV === 'production') {
      logger.info('[DatabaseManager] SSL disabled for AWS RDS within VPC');
    }
    
    // Validate pool configuration
    const poolConfig = this.config.pool || {};
    if (poolConfig.max && poolConfig.min && poolConfig.max < poolConfig.min) {
      throw new Error('Pool max size must be greater than or equal to min size');
    }
    
    logger.debug('[DatabaseManager] Database configuration validated successfully');
  }

  /**
   * Test connection reliability with exponential backoff
   * @private
   */
  async testConnectionReliability() {
    logger.info('[DatabaseManager] Testing database connection reliability...');
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= MAX_CONNECTION_ATTEMPTS; attempt++) {
      try {
        await this.performConnectionTest();
        logger.info(`[DatabaseManager] Connection test successful on attempt ${attempt}`);
        return;
      } catch (error) {
        lastError = error;
        this.connectionAttempts = attempt;
        
        logger.warn(`[DatabaseManager] Connection test failed on attempt ${attempt}:`, error.message);
        
        if (attempt < MAX_CONNECTION_ATTEMPTS) {
          const delay = CONNECTION_RETRY_DELAY * Math.pow(2, attempt - 1);
          logger.info(`[DatabaseManager] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Failed to establish database connection after ${MAX_CONNECTION_ATTEMPTS} attempts: ${lastError.message}`);
  }

  /**
   * Perform a single connection test
   * @private
   */
  async performConnectionTest() {
    const testPool = new Pool({
      connectionString: this.config.url,
      ssl: false, // Force SSL off for AWS RDS within VPC
      connectionTimeoutMillis: DB_CONNECTION_TIMEOUT,
      max: 1 // Minimal pool for testing
    });
    
    try {
      const client = await testPool.connect();
      
      try {
        // Test basic query
        const result = await client.query('SELECT NOW() as current_time, version() as db_version');
        const { current_time, db_version } = result.rows[0];
        
        logger.info('[DatabaseManager] Database connection test passed:', {
          currentTime: current_time,
          version: db_version,
          ssl: !!this.config.ssl
        });
        
        // Test schema compatibility
        const schemaResult = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_sessions'
          ) as session_table_exists
        `);
        
        if (!schemaResult.rows[0].session_table_exists) {
          logger.warn('[DatabaseManager] Session table does not exist. It will be created by migrations.');
        }
        
      } finally {
        client.release();
      }
    } finally {
      await testPool.end();
    }
  }

  /**
   * Create the main connection pool
   * @private
   */
  createConnectionPool() {
    logger.info('[DatabaseManager] Creating database connection pool...');
    
    const poolConfig = {
      connectionString: this.config.url,
      ssl: false, // Force SSL off for AWS RDS within VPC
      
      // Pool configuration
      max: this.config.pool?.max || 10,
      min: this.config.pool?.min || 2,
      idleTimeoutMillis: this.config.pool?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: this.config.pool?.connectionTimeoutMillis || 5000,
      allowExitOnIdle: this.config.pool?.allowExitOnIdle !== false,
      
      // Query timeouts
      query_timeout: this.config.query_timeout || 30000,
      statement_timeout: this.config.statement_timeout || 60000
    };
    
    this.pool = new Pool(poolConfig);
    
    // Set up pool event handlers
    this.setupPoolEventHandlers();
    
    logger.info('[DatabaseManager] Connection pool created with configuration:', {
      max: poolConfig.max,
      min: poolConfig.min,
      ssl: !!poolConfig.ssl,
      idleTimeout: poolConfig.idleTimeoutMillis,
      connectionTimeout: poolConfig.connectionTimeoutMillis
    });
  }

  /**
   * Set up event handlers for the connection pool
   * @private
   */
  setupPoolEventHandlers() {
    // Pool error handler
    this.pool.on('error', (err, client) => {
      logger.error('[DatabaseManager] Unexpected error on idle database client:', {
        error: err.message,
        code: err.code,
        clientInfo: client ? 'Client available' : 'No client info'
      });
      
      this.metrics.connectionErrors++;
      
      // Update health status based on error
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        this.healthStatus = DB_STATUS_FAILED;
      } else {
        this.healthStatus = DB_STATUS_DEGRADED;
      }
    });
    
    // Pool connect handler
    this.pool.on('connect', (client) => {
      logger.debug('[DatabaseManager] New client connected to pool');
    });
    
    // Pool acquire handler
    this.pool.on('acquire', (client) => {
      logger.debug('[DatabaseManager] Client acquired from pool');
    });
    
    // Pool remove handler
    this.pool.on('remove', (client) => {
      logger.debug('[DatabaseManager] Client removed from pool');
    });
  }

  /**
   * Start health monitoring
   * @private
   */
  startHealthMonitoring() {
    logger.info('[DatabaseManager] Starting health monitoring...');
    
    // Perform initial health check
    this.performHealthCheck();
    
    // Schedule periodic health checks
    this.healthCheckInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.performHealthCheck();
      }
    }, DB_HEALTH_CHECK_INTERVAL);
    
    // Ensure interval doesn't prevent process from exiting
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref();
    }
  }

  /**
   * Perform a health check
   * @private
   */
  async performHealthCheck() {
    try {
      const start = Date.now();
      const client = await this.pool.connect();
      
      try {
        await client.query('SELECT 1');
        const duration = Date.now() - start;
        
        this.lastHealthCheck = new Date();
        
        // Update health status based on response time
        if (duration < 100) {
          this.healthStatus = DB_STATUS_HEALTHY;
        } else if (duration < 1000) {
          this.healthStatus = DB_STATUS_DEGRADED;
          logger.warn('[DatabaseManager] Database response time degraded:', duration + 'ms');
        } else {
          this.healthStatus = DB_STATUS_DEGRADED;
          logger.error('[DatabaseManager] Database response time critical:', duration + 'ms');
        }
        
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('[DatabaseManager] Health check failed:', error.message);
      this.healthStatus = DB_STATUS_FAILED;
      this.metrics.connectionErrors++;
    }
  }

  /**
   * Execute a database query with enhanced error handling and monitoring
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<pg.Result>}
   */
  async query(text, params = []) {
    if (this.isShuttingDown) {
      throw new Error('Database manager is shutting down');
    }
    
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    
    if (this.healthStatus === DB_STATUS_FAILED) {
      throw new Error('Database connection is in failed state');
    }
    
    const start = Date.now();
    const queryId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug('[DatabaseManager] Executing query:', {
      queryId,
      type: this.getQueryType(text),
      table: this.getTableFromQuery(text)
    });
    
    let client;
    
    try {
      // Get client with timeout
      client = await this.pool.connect();
      
      // Check if pool is exhausted
      if (this.pool.waitingCount > 0) {
        this.metrics.poolExhausted++;
        logger.warn('[DatabaseManager] Connection pool has waiting queries:', {
          waiting: this.pool.waitingCount,
          total: this.pool.totalCount,
          idle: this.pool.idleCount
        });
      }
      
      // Execute query
      const result = await client.query(text, params);
      
      // Calculate duration and update metrics
      const duration = Date.now() - start;
      this.updateQueryMetrics(duration);
      
      // Log slow queries
      if (duration > 500) {
        this.metrics.slowQueries++;
        logger.warn('[DatabaseManager] Slow query detected:', {
          queryId,
          duration,
          rows: result.rowCount,
          query: text.substring(0, 100)
        });
      } else {
        logger.debug('[DatabaseManager] Query completed:', {
          queryId,
          duration,
          rows: result.rowCount
        });
      }
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - start;
      this.metrics.failedQueries++;
      
      // Enhanced error logging
      logger.error('[DatabaseManager] Query failed:', {
        queryId,
        duration,
        error: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        query: text.substring(0, 100)
      });
      
      // Check if error indicates connection issues
      if (this.isConnectionError(error)) {
        this.healthStatus = DB_STATUS_DEGRADED;
        
        // Attempt one retry for connection errors
        if (!error._retried) {
          logger.info('[DatabaseManager] Retrying query after connection error...');
          error._retried = true;
          return this.query(text, params);
        }
      }
      
      throw error;
      
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Get the connection pool
   * @returns {pg.Pool}
   */
  getPool() {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Ensure database manager is initialized first.');
    }
    
    if (this.healthStatus === DB_STATUS_FAILED) {
      throw new Error('Database connection is in failed state');
    }
    
    return this.pool;
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const result = await this.query('SELECT NOW() as current_time');
      logger.info('[DatabaseManager] Connection test successful:', result.rows[0].current_time);
      return true;
    } catch (error) {
      logger.error('[DatabaseManager] Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get current health status
   * @returns {Object}
   */
  getHealthStatus() {
    const poolStats = this.pool ? {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount
    } : null;
    
    return {
      status: this.healthStatus,
      lastHealthCheck: this.lastHealthCheck,
      connectionAttempts: this.connectionAttempts,
      pool: poolStats,
      metrics: { ...this.metrics },
      uptime: this.pool ? Date.now() - this.pool._startTime : 0
    };
  }

  /**
   * Shutdown the database manager
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    logger.info('[DatabaseManager] Shutting down database manager...');
    
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Close pool
    if (this.pool) {
      try {
        await this.pool.end();
        logger.info('[DatabaseManager] Connection pool closed successfully');
      } catch (error) {
        logger.error('[DatabaseManager] Error closing connection pool:', error);
      }
      
      this.pool = null;
    }
    
    this.healthStatus = DB_STATUS_FAILED;
    this.emit('shutdown');
    
    logger.info('[DatabaseManager] Database manager shut down complete');
  }

  // Helper methods

  /**
   * Get query type from SQL text
   * @private
   */
  getQueryType(query) {
    const match = query.trim().match(/^\s*(\w+)/i);
    return match ? match[1].toUpperCase() : 'UNKNOWN';
  }

  /**
   * Extract table name from query
   * @private
   */
  getTableFromQuery(query) {
    const match = query.match(/FROM\s+([^\s,;()]+)/i);
    return match ? match[1] : 'unknown';
  }

  /**
   * Update query metrics
   * @private
   */
  updateQueryMetrics(duration) {
    this.metrics.totalQueries++;
    
    // Calculate running average
    const currentAvg = this.metrics.averageQueryTime;
    const totalQueries = this.metrics.totalQueries;
    this.metrics.averageQueryTime = ((currentAvg * (totalQueries - 1)) + duration) / totalQueries;
  }

  /**
   * Check if error is connection-related
   * @private
   */
  isConnectionError(error) {
    const connectionErrorCodes = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
      '57P03', // cannot_connect_now
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004'  // sqlserver_rejected_establishment_of_sqlconnection
    ];
    
    return connectionErrorCodes.includes(error.code);
  }
}

module.exports = { PermisosDatabaseManager };