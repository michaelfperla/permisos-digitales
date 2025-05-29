const { Pool } = require('pg');
const config = require('../config');
const { logger } = require('../utils/enhanced-logger');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' && !config.disableSsl ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle database client', { error: err, clientInfo: client });
});

const testConnection = async () => {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    logger.info(`Database connection successful! Current time from DB: ${res.rows[0].now}`);
    return true;
  } catch (err) {
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
} catch (error) {
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
    const client = await pool.connect();

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
  logger.info('Closing database pool...');
  await pool.end();
  logger.info('Database pool has been closed');
};

module.exports = {
  query,
  dbPool: pool,
  testConnection,
  shutdown
};