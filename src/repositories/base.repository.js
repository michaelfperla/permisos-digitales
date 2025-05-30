const db = require('../db');
const { logger } = require('../utils/enhanced-logger');

class BaseRepository {
  constructor(tableName, primaryKey = 'id') {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    logger.debug(`Initialized ${tableName} repository`);
  }

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

  async findAll(criteria = {}, options = {}) {
    const { limit, offset, orderBy } = options;
    const params = [];

    const whereClauses = [];
    Object.entries(criteria).forEach(([column, value], _index) => {
      params.push(value);
      whereClauses.push(`${column} = $${params.length}`);
    });

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(' AND ')}`
      : '';

    const orderClause = orderBy
      ? `ORDER BY ${orderBy}`
      : '';

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

  async create(data) {
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

  async count(criteria = {}) {
    const params = [];

    const whereClauses = [];
    Object.entries(criteria).forEach(([column, value], _index) => {
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
