/**
 * Database Transaction Helper
 * Provides a consistent way to handle database transactions
 */
const db = require('./index');
const { logger } = require('../utils/logger');
const { DatabaseError } = require('../utils/errors');

/**
 * Execute a function within a database transaction
 *
 * @param {Function} callback - Function to execute within transaction
 * @param {Object} options - Transaction options
 * @param {string} options.context - Context for logging
 * @param {boolean} options.readOnly - Whether transaction is read-only
 * @returns {Promise<any>} - Result of the callback function
 * @throws {DatabaseError} - If transaction fails
 */
async function withTransaction(callback, options = {}) {
  const { context = 'transaction', readOnly = false } = options;
  const client = await db.dbPool.connect();

  try {
    logger.debug(`Starting database ${readOnly ? 'read-only ' : ''}transaction: ${context}`);

    // Begin transaction
    await client.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');

    // Execute callback with transaction client
    const result = await callback(client);

    // Commit transaction
    await client.query('COMMIT');
    logger.debug(`Transaction committed: ${context}`);

    return result;
  } catch (error) {
    // Rollback transaction on error
    try {
      await client.query('ROLLBACK');
      logger.debug(`Transaction rolled back: ${context}`);
    } catch (rollbackError) {
      logger.error(`Error rolling back transaction: ${context}`, rollbackError);
    }

    // Log the original error
    logger.error(`Transaction failed: ${context}`, error);

    // Wrap in DatabaseError
    throw new DatabaseError(
      `Transaction failed: ${error.message}`,
      error,
      error.code
    );
  } finally {
    // Release client back to pool
    client.release();
    logger.debug(`Transaction client released: ${context}`);
  }
}

/**
 * Execute a query within a transaction
 *
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @param {Object} options - Transaction options
 * @returns {Promise<Object>} - Query result
 * @throws {DatabaseError} - If query fails
 */
async function queryWithTransaction(text, params = [], options = {}) {
  return withTransaction(async (client) => {
    return client.query(text, params);
  }, options);
}

/**
 * Execute multiple queries within a transaction
 *
 * @param {Array<Object>} queries - Array of query objects with text and params
 * @param {Object} options - Transaction options
 * @returns {Promise<Array>} - Array of query results
 * @throws {DatabaseError} - If any query fails
 */
async function batchWithTransaction(queries, options = {}) {
  return withTransaction(async (client) => {
    const results = [];

    for (const query of queries) {
      const { text, params = [] } = query;
      const result = await client.query(text, params);
      results.push(result);
    }

    return results;
  }, options);
}

module.exports = {
  withTransaction,
  queryWithTransaction,
  batchWithTransaction
};
