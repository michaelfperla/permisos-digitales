/**
 * Base Repository Class
 * Provides common database operations for entities
 */
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');

class BaseRepository {
  constructor(tableName, primaryKey = 'id') {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    logger.debug(`Initialized ${tableName} repository`);
  }

  /**
   * Find a record by its primary key
   * @param {number|string} id - Primary key value
   * @returns {Promise<Object|null>} - Found record or null
   */
  async findById(id) {
    const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
    try {
      const { rows } = await db.query(query, [id]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error in ${this.tableName}.findById:`, error);
      throw error;
    }
  }

  /**
   * Find all records matching the given criteria
   * @param {Object} criteria - Object with column:value pairs for WHERE clause
   * @param {Object} options - Additional options (limit, offset, orderBy)
   * @returns {Promise<Array>} - Array of matching records
   */
  async findAll(criteria = {}, options = {}) {
    const { limit, offset, orderBy } = options;
    const params = [];

    // Build WHERE clause from criteria
    const whereClauses = [];
    Object.entries(criteria).forEach(([column, value], index) => {
      params.push(value);
      whereClauses.push(`${column} = $${params.length}`);
    });

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    // Add ORDER BY if specified
    const orderClause = orderBy
      ? `ORDER BY ${orderBy}`
      : '';

    // Add LIMIT and OFFSET if specified
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const offsetClause = offset ? `OFFSET ${offset}` : '';

    const query = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ${orderClause}
      ${limitClause}
      ${offsetClause}
    `;

    try {
      const { rows } = await db.query(query, params);
      return rows;
    } catch (error) {
      logger.error(`Error in ${this.tableName}.findAll:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   * @param {Object} data - Object with column:value pairs to insert
   * @returns {Promise<Object>} - Created record
   */
  async create(data) {
    // Add validation for permit_applications table to ensure status is not null
    if (this.tableName === 'permit_applications' && (!data.status || data.status === 'undefined')) {
      const error = new Error('Cannot create application with null or undefined status');
      logger.error(`Validation error in ${this.tableName}.create:`, {
        error: error.message,
        data: JSON.stringify(data)
      });
      throw error;
    }

    const columns = Object.keys(data);
    const values = Object.values(data);

    // Log the values being inserted for debugging
    if (this.tableName === 'permit_applications') {
      logger.debug(`Creating ${this.tableName} record with values:`, {
        columns,
        values: values.map((val, idx) => `${columns[idx]}: ${val === null ? 'NULL' : val}`)
      });
    }

    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const columnNames = columns.join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columnNames})
      VALUES (${placeholders})
      RETURNING *
    `;

    try {
      const { rows } = await db.query(query, values);

      // Log the created record for debugging
      if (this.tableName === 'permit_applications') {
        logger.debug(`Created ${this.tableName} record:`, {
          id: rows[0]?.id,
          status: rows[0]?.status
        });
      }

      return rows[0];
    } catch (error) {
      logger.error(`Error in ${this.tableName}.create:`, {
        error: error.message,
        errorCode: error.code,
        tableName: this.tableName,
        data: JSON.stringify(data)
      });
      throw error;
    }
  }

  /**
   * Update a record by its primary key
   * @param {number|string} id - Primary key value
   * @param {Object} data - Object with column:value pairs to update
   * @returns {Promise<Object|null>} - Updated record or null
   */
  async update(id, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);

    const setClauses = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
      WHERE ${this.primaryKey} = $${values.length + 1}
      RETURNING *
    `;

    try {
      const { rows } = await db.query(query, [...values, id]);
      return rows[0] || null;
    } catch (error) {
      logger.error(`Error in ${this.tableName}.update:`, error);
      throw error;
    }
  }

  /**
   * Delete a record by its primary key
   * @param {number|string} id - Primary key value
   * @returns {Promise<boolean>} - True if deleted, false if not found
   */
  async delete(id) {
    const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1 RETURNING ${this.primaryKey}`;

    try {
      const { rowCount } = await db.query(query, [id]);
      return rowCount > 0;
    } catch (error) {
      logger.error(`Error in ${this.tableName}.delete:`, error);
      throw error;
    }
  }

  /**
   * Count records matching the given criteria
   * @param {Object} criteria - Object with column:value pairs for WHERE clause
   * @returns {Promise<number>} - Count of matching records
   */
  async count(criteria = {}) {
    const params = [];

    // Build WHERE clause from criteria
    const whereClauses = [];
    Object.entries(criteria).forEach(([column, value], index) => {
      params.push(value);
      whereClauses.push(`${column} = $${params.length}`);
    });

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const query = `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`;

    try {
      const { rows } = await db.query(query, params);
      return parseInt(rows[0].count, 10);
    } catch (error) {
      logger.error(`Error in ${this.tableName}.count:`, error);
      throw error;
    }
  }

  /**
   * Execute a custom query
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Query result
   */
  async executeQuery(query, params = []) {
    try {
      return await db.query(query, params);
    } catch (error) {
      logger.error(`Error in ${this.tableName}.executeQuery:`, error);
      throw error;
    }
  }
}

module.exports = BaseRepository;
