/**
 * Database Service
 * Manages PostgreSQL connections with connection pooling
 */

const { Pool } = require('pg');
const { logger } = require('../../utils/logger');
const config = require('../../config/v2/config');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.connected = false;
  }

  /**
   * Initialize database connection pool
   */
  async initialize() {
    logger.info('[DatabaseService] Initializing PostgreSQL connection pool...');
    
    const dbConfig = config.getValue('database');
    
    if (!dbConfig.url) {
      throw new Error('Database URL not configured');
    }

    try {
      // Create connection pool with SSL configuration
      const poolConfig = {
        connectionString: dbConfig.url,
        ssl: false, // Force SSL off for AWS RDS within VPC
        min: dbConfig.pool.min,
        max: dbConfig.pool.max,
        idleTimeoutMillis: dbConfig.pool.idleTimeoutMillis,
        connectionTimeoutMillis: dbConfig.pool.connectionTimeoutMillis,
        // Additional production-ready settings
        statement_timeout: 30000, // 30 seconds
        query_timeout: 30000,
        application_name: 'permisos_digitales',
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
      };

      this.pool = new Pool(poolConfig);

      // Handle pool errors
      this.pool.on('error', (err, client) => {
        logger.error('[DatabaseService] Unexpected pool error:', err);
      });

      this.pool.on('connect', (client) => {
        logger.debug('[DatabaseService] New client connected to pool');
      });

      this.pool.on('acquire', (client) => {
        logger.debug('[DatabaseService] Client acquired from pool');
      });

      this.pool.on('remove', (client) => {
        logger.debug('[DatabaseService] Client removed from pool');
      });

      // Test the connection
      await this._testConnection();
      
      this.connected = true;
      logger.info('[DatabaseService] PostgreSQL connection pool initialized successfully');
      
    } catch (error) {
      logger.error('[DatabaseService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async _testConnection() {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      logger.info('[DatabaseService] Database connection successful:', {
        currentTime: result.rows[0].current_time,
        version: result.rows[0].pg_version.split(' ')[1]
      });
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params = []) {
    if (!this.connected) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('[DatabaseService] Query executed:', {
        query: text.substring(0, 100),
        params: params.length,
        rows: result.rowCount,
        duration
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('[DatabaseService] Query error:', {
        query: text.substring(0, 100),
        error: error.message,
        duration
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transaction handling
   * @returns {Promise<Object>} Database client
   */
  async getClient() {
    if (!this.connected) {
      throw new Error('Database not connected');
    }
    
    const client = await this.pool.connect();
    
    // Wrap the client to ensure proper release
    const wrappedClient = {
      ...client,
      query: client.query.bind(client),
      release: () => {
        logger.debug('[DatabaseService] Releasing client back to pool');
        client.release();
      }
    };
    
    return wrappedClient;
  }

  /**
   * Execute a transaction
   * @param {Function} callback - Transaction callback
   * @returns {Promise<*>} Transaction result
   */
  async transaction(callback) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      logger.debug('[DatabaseService] Transaction started');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      logger.debug('[DatabaseService] Transaction committed');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[DatabaseService] Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute multiple queries in a transaction
   * @param {Array} queries - Array of { text, params } objects
   * @returns {Promise<Array>} Array of results
   */
  async batchTransaction(queries) {
    return this.transaction(async (client) => {
      const results = [];
      
      for (const { text, params = [] } of queries) {
        const result = await client.query(text, params);
        results.push(result);
      }
      
      return results;
    });
  }

  /**
   * Check if a table exists
   * @param {string} tableName - Table name
   * @returns {Promise<boolean>}
   */
  async tableExists(tableName) {
    const result = await this.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    
    return result.rows[0].exists;
  }

  /**
   * Get pool statistics
   * @returns {Object} Pool statistics
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }
    
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount
    };
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    const status = {
      healthy: false,
      service: 'database',
      details: {}
    };

    try {
      const startTime = Date.now();
      const result = await this.query('SELECT 1 as health_check');
      const responseTime = Date.now() - startTime;

      const poolStats = this.getPoolStats();

      status.healthy = true;
      status.details = {
        connected: true,
        responseTime,
        pool: poolStats
      };
    } catch (error) {
      status.error = error.message;
      status.details = {
        connected: false
      };
    }

    return status;
  }

  /**
   * Run database migrations (placeholder for integration)
   * @returns {Promise<void>}
   */
  async runMigrations() {
    logger.info('[DatabaseService] Running database migrations...');
    // This would integrate with node-pg-migrate
    // For now, it's a placeholder
    logger.info('[DatabaseService] Migrations completed');
  }

  /**
   * Shutdown service
   */
  async shutdown() {
    logger.info('[DatabaseService] Shutting down...');
    
    if (this.pool) {
      await this.pool.end();
      logger.info('[DatabaseService] Connection pool closed');
    }
    
    this.connected = false;
  }

  /**
   * Helper method to format query for logging
   * @param {string} query - SQL query
   * @returns {string} Formatted query
   */
  _formatQuery(query) {
    return query.replace(/\s+/g, ' ').trim().substring(0, 100);
  }

  /**
   * Helper to build WHERE clause from conditions
   * @param {Object} conditions - Key-value pairs for WHERE clause
   * @returns {Object} { whereClause, values }
   */
  buildWhereClause(conditions) {
    const keys = Object.keys(conditions);
    const values = Object.values(conditions);
    
    if (keys.length === 0) {
      return { whereClause: '', values: [] };
    }
    
    const whereClause = 'WHERE ' + keys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(' AND ');
    
    return { whereClause, values };
  }

  /**
   * Helper to build INSERT query
   * @param {string} table - Table name
   * @param {Object} data - Data to insert
   * @returns {Object} { text, values }
   */
  buildInsertQuery(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    const columns = keys.join(', ');
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    
    const text = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
    
    return { text, values };
  }

  /**
   * Helper to build UPDATE query
   * @param {string} table - Table name
   * @param {Object} data - Data to update
   * @param {Object} conditions - WHERE conditions
   * @returns {Object} { text, values }
   */
  buildUpdateQuery(table, data, conditions) {
    const dataKeys = Object.keys(data);
    const dataValues = Object.values(data);
    
    const setClause = dataKeys
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    
    const { whereClause, values: whereValues } = this.buildWhereClause(conditions);
    
    // Adjust parameter indices for WHERE clause
    const adjustedWhereClause = whereClause.replace(
      /\$(\d+)/g,
      (match, num) => `$${parseInt(num) + dataKeys.length}`
    );
    
    const text = `UPDATE ${table} SET ${setClause} ${adjustedWhereClause} RETURNING *`;
    const values = [...dataValues, ...whereValues];
    
    return { text, values };
  }
}

// Factory function for service container
function createDatabaseService() {
  return new DatabaseService();
}

module.exports = createDatabaseService;
module.exports.DatabaseService = DatabaseService;