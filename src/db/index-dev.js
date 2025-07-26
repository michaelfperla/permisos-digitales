// Development database module
// Uses dev-config instead of unified-config to avoid race conditions

const { Pool } = require('pg');
const { logger } = require('../utils/logger');

// Use dev-config for development
const config = require('../config/dev-config');

let pool = null;

const createPool = () => {
  if (!pool) {
    logger.info('Creating database connection pool...');
    
    const poolConfig = {
      connectionString: config.database.url,
      ssl: config.database.ssl,
      max: config.database.pool.max,
      min: config.database.pool.min,
      idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
      connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
    };
    
    pool = new Pool(poolConfig);
    
    pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle database client', { 
        error: err.message,
        code: err.code 
      });
    });
  }
  return pool;
};

const getPool = () => {
  if (!pool) {
    return createPool();
  }
  return pool;
};

const testConnection = async () => {
  let client;
  try {
    const currentPool = createPool();
    client = await currentPool.connect();
    const res = await client.query('SELECT NOW()');
    logger.info(`Database connection successful! Current time from DB: ${res.rows[0].now}`);
    return true;
  } catch (err) {
    logger.error('Database connection failed:', {
      message: err.message,
      code: err.code,
      host: err.host,
      port: err.port
    });
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

const query = async (text, params = []) => {
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
      error: error.message,
      code: error.code,
    });
    throw error;
  } finally {
    client.release();
  }
};

const shutdown = async () => {
  if (pool) {
    logger.info('Closing database pool...');
    await pool.end();
    logger.info('Database pool has been closed');
  }
};

module.exports = {
  query,
  dbPool: pool,
  getPool,
  testConnection,
  shutdown,
  get pool() { return getPool(); }
};