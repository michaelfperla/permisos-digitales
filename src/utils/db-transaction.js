/**
 * Database Transaction Utility
 *
 * This utility provides a way to execute database operations within a transaction.
 * It ensures that all operations either succeed together or fail together.
 */
const { logger } = require('./logger');
const { dbPool: pool } = require('../db');

/**
 * Execute a function within a database transaction
 * @param {Function} fn - Function to execute within the transaction
 * @returns {Promise<any>} - Result of the function
 */
const withTransaction = async (fn) => {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query('BEGIN');
    logger.debug('Database transaction started');

    // Execute the function with the client
    const result = await fn(client);

    // Commit transaction
    await client.query('COMMIT');
    logger.debug('Database transaction committed');

    return result;
  } catch (error) {
    // Rollback transaction on error
    try {
      await client.query('ROLLBACK');
      logger.warn('Database transaction rolled back due to error:', {
        error: error.message,
        code: error.code
      });
    } catch (rollbackError) {
      logger.error('Error rolling back transaction:', {
        error: rollbackError.message,
        originalError: error.message
      });
    }

    // Re-throw the original error
    throw error;
  } finally {
    // Release the client back to the pool
    client.release();
    logger.debug('Database client released');
  }
};

/**
 * Execute a function with a database client
 * This is useful for operations that don't need a transaction
 * @param {Function} fn - Function to execute with the client
 * @returns {Promise<any>} - Result of the function
 */
const withClient = async (fn) => {
  const client = await pool.connect();

  try {
    // Execute the function with the client
    return await fn(client);
  } finally {
    // Release the client back to the pool
    client.release();
  }
};

module.exports = {
  withTransaction,
  withClient
};
