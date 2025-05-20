// src/db/index.js
const { Pool } = require('pg');
const config = require('../config');
const { logger } = require('../utils/enhanced-logger');

// Production-optimized pool configuration
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' && !config.disableSsl ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait for a connection
});

// Handle errors at the pool level
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle database client', { error: err, clientInfo: client });
  // For critical errors, we might want to exit the process
  // process.exit(-1);
});

// Test function updated to use logger
const testConnection = async () => {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    // Use logger for success
    logger.info(`Database connection successful! Current time from DB: ${res.rows[0].now}`);
    return true;
  } catch (err) {
    // Use logger for connection failure, pass the error object
    logger.error('Database connection failed:', err);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Import metrics
let measureDatabaseQuery;
try {
  // We need to handle the case where metrics might not be available yet (during tests)
  const metrics = require('../utils/metrics');
  measureDatabaseQuery = metrics.measureDatabaseQuery;
} catch (error) {
  // Fallback for when metrics module is not available
  measureDatabaseQuery = async (queryType, table, queryFn) => queryFn();
}

/**
 * Extract the query type (SELECT, INSERT, etc.) from a SQL query
 * @param {string} query - SQL query
 * @returns {string} - Query type
 */
function getQueryType(query) {
  const match = query.trim().match(/^\s*(\w+)/i);
  return match ? match[1].toUpperCase() : 'UNKNOWN';
}

/**
 * Extract the table name from a SQL query
 * @param {string} query - SQL query
 * @returns {string} - Table name
 */
function getTableFromQuery(query) {
  // Simple regex to extract table name
  const match = query.match(/FROM\s+([^\s,;()]+)/i);
  return match ? match[1] : 'unknown';
}

/**
 * Execute a query on the database with metrics
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} - Query result
 */
const query = async (text, params = []) => {
  return measureDatabaseQuery(getQueryType(text), getTableFromQuery(text), async () => {
    const start = Date.now();
    const client = await pool.connect();

    try {
      const result = await client.query(text, params);
      const duration = Date.now() - start;

      // Log query information for slow queries
      if (duration > 500) {
        logger.warn('Slow query', { text, duration, rows: result.rowCount });
      } else {
        logger.debug('Query executed', { duration, rows: result.rowCount });
      }

      return result;
    } catch (error) {
      // Enhanced error logging
      logger.error('Database query error', {
        query: text,
        params: JSON.stringify(params),
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    } finally {
      client.release();
    }
  });
};

/**
 * Graceful shutdown function for the database pool
 * @returns {Promise<void>}
 */
const shutdown = async () => {
  logger.info('Closing database pool...');
  await pool.end();
  logger.info('Database pool has been closed');
};

// Export the query function and the named pool
module.exports = {
  query, // Enhanced query function with metrics
  dbPool: pool, // Export the pool object itself with a specific name
  testConnection, // Export the test function
  shutdown // Export the shutdown function
};