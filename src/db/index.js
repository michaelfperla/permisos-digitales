// src/db/index.js

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

// RACE CONDITION FIX: Don't access config at module load time
// Config will be accessed when pool is created
let pool = null;
let poolConfig = null;
let externalConfig = null;

// Load config safely - try external config first, fallback to environment variables
function getConfig() {
  // Use external config if it was set
  if (externalConfig) {
    return externalConfig;
  }
  
  // In production, use environment variables directly
  if (process.env.NODE_ENV === 'production') {
    return {
      database: {
        url: process.env.DATABASE_URL, // In production, this MUST be set
        pool: {
          min: parseInt(process.env.DB_POOL_MIN || '2', 10),
          max: parseInt(process.env.DB_POOL_MAX || '10', 10),
          idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
          connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
          allowExitOnIdle: process.env.DB_ALLOW_EXIT_ON_IDLE === 'true'
        },
        ssl: process.env.DB_SSL === 'true' ? {
          rejectUnauthorized: false,
          ca: process.env.DB_SSL_CA || null
        } : false,
        query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10)
      }
    };
  }
  
  // In development, try to load dev-config
  try {
    return require('../config/dev-config');
  } catch (error) {
    // Fallback to environment variables for development
    logger.warn('Failed to load dev-config, using environment variables directly');
    return {
      database: {
        url: process.env.DATABASE_URL, // In production, this MUST be set
        pool: {
          min: parseInt(process.env.DB_POOL_MIN || '2', 10),
          max: parseInt(process.env.DB_POOL_MAX || '10', 10),
          idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
          connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
          allowExitOnIdle: process.env.DB_ALLOW_EXIT_ON_IDLE === 'true'
        },
        ssl: process.env.DB_SSL === 'true' ? {
          rejectUnauthorized: false,
          ca: process.env.DB_SSL_CA || null
        } : false,
        query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10)
      }
    };
  }
}

const createPool = () => {
  if (!pool) {
    logger.info('Creating database connection pool...');
    
    // RACE CONDITION FIX: Get config when needed, not at module load
    const config = getConfig();
    
    // Log SSL configuration
    logger.info(`Database SSL configuration: ${config.database.ssl ? 'enabled with certificate validation' : 'disabled for development'}`);
    
    // Prepare SSL config with RDS certificate for production
    let sslConfig = config.database.ssl;
    if (sslConfig && process.env.NODE_ENV === 'production') {
      try {
        const fs = require('fs');
        const path = require('path');
        const certPath = process.env.RDS_CA_CERT_PATH 
          ? path.resolve(process.env.RDS_CA_CERT_PATH)
          : path.join(__dirname, '..', 'utils', 'rds-ca-bundle.pem');
        // Create a new SSL config object with the certificate
        sslConfig = {
          ...config.database.ssl,
          ca: fs.readFileSync(certPath, 'utf8')
        };
        logger.info('RDS SSL certificate loaded from file');
      } catch (error) {
        logger.warn('Failed to load RDS certificate:', error.message);
      }
    }
    
    poolConfig = {
      // Database connection with SSL configuration from environment
      connectionString: config.database.url,
      ssl: sslConfig, // Use SSL configuration based on environment settings
      max: config.database.pool.max,
      min: config.database.pool.min,
      idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
      allowExitOnIdle: config.database.pool.allowExitOnIdle || false,
      query_timeout: config.database.query_timeout || 30000,
      statement_timeout: config.database.statement_timeout || 30000
    };
    
    pool = new Pool(poolConfig);
    
    pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle database client', { 
        error: err.message, 
        code: err.code,
        stack: err.stack 
      });
    });
  }
  return pool;
};

// Add getPool method for server.js compatibility
const getPool = () => {
  // FIX: Try to create pool if it doesn't exist instead of throwing
  if (!pool) {
    logger.warn('Pool requested but not initialized, attempting to create...');
    return createPool();
  }
  return pool;
};


const testConnection = async () => {
  let client;
  try {
    // Use existing pool or get it, don't create a new one
    const currentPool = getPool();
    if (!currentPool) {
      logger.error('No database pool available for connection test');
      return false;
    }
    client = await currentPool.connect();
    const res = await client.query('SELECT NOW()');
    logger.info(`Database connection successful! Current time from DB: ${res.rows[0].now}`);
    return true;
  } catch (err) {
    // The detailed error is now very important for debugging.
    logger.error('Database connection failed:', err);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

let measureDatabaseQuery;
try {
  const metrics = require('../utils/metrics');
  measureDatabaseQuery = metrics.measureDatabaseQuery;
} catch (_error) {
  measureDatabaseQuery = async (queryType, table, queryFn) => queryFn();
}

function getQueryType(query) {
  const match = query.trim().match(/^\s*(\w+)/i);
  return match ? match[1].toUpperCase() : 'UNKNOWN';
}

function getTableFromQuery(query) {
  const match = query.match(/FROM\s+([^\s,;()]+)/i);
  return match ? match[1] : 'unknown';
}

const query = async (text, params = []) => {
  return measureDatabaseQuery(getQueryType(text), getTableFromQuery(text), async () => {
    const start = Date.now();
    const currentPool = pool || createPool();
    const client = await currentPool.connect();

    try {
      const result = await client.query(text, params);
      const duration = Date.now() - start;

      if (duration > 500) {
        logger.warn('Slow query', { text, duration, rows: result.rowCount });
      } else {
        logger.debug('Query executed', { duration, rows: result.rowCount });
      }

      return result;
    } catch (error) {
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

const shutdown = async () => {
  if (pool) {
    logger.info('Closing database pool...');
    await pool.end();
    pool = null; // Clear the pool reference after ending it
    logger.info('Database pool has been closed');
  } else {
    logger.info('No database pool to close');
  }
};

// RACE CONDITION FIX: Add pool getter for safer access
const getDbPool = () => {
  if (!pool) {
    // Get config when needed, not at module load
    const config = getConfig();
    if (config && config.database && config.database.url) {
      // Create pool if it doesn't exist yet
      return createPool();
    }
  }
  return pool;
};

// Function to set config from external source (e.g., service container)
const setConfig = (config) => {
  externalConfig = config;
  logger.info('Database config set from external source');
};

// Function to recreate pool (for reconnection)
const recreatePool = async () => {
  logger.info('Recreating database pool...');
  
  // Close existing pool if any
  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      logger.warn('Error closing old pool:', error.message);
    }
    pool = null;
  }
  
  // Create new pool
  const newPool = createPool();
  
  // Test the new connection
  try {
    const client = await newPool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('New database pool created and tested successfully');
  } catch (error) {
    logger.error('Failed to test new pool:', error.message);
    throw error;
  }
  
  return newPool;
};

module.exports = {
  query,
  // RACE CONDITION FIX: Use getter property instead of calling function at module load
  get dbPool() {
    return getDbPool();
  },
  getPool, // New method for server.js
  createPool, // Export for connection monitoring
  testConnection,
  shutdown,
  getDbPool, // Export getter function for explicit access
  setConfig, // Allow external config injection
  recreatePool // Export for reconnection handling
};