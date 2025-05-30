const BaseRepository = require('./base.repository');
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  async findByEmail(email) {
    logger.debug(`[User Repository] findByEmail called for email: ${email}`);
    const query = 'SELECT * FROM users WHERE email = $1';
    logger.debug(`[User Repository] Executing SQL query: ${query}`);

    try {
      logger.debug(`[User Repository] About to execute database query for email: ${email}`);
      const result = await db.query(query, [email]);

      const rowCount = result.rows.length;
      logger.debug(`[User Repository] Query returned ${rowCount} rows for email: ${email}`);

      if (rowCount > 0) {
        const user = result.rows[0];
        logger.debug(`[User Repository] User found with ID: ${user.id}`);

        const criticalFields = ['id', 'password_hash', 'is_email_verified', 'role'];
        const missingFields = criticalFields.filter(field => user[field] === undefined);

        if (missingFields.length > 0) {
          logger.warn(`[User Repository] User record for ${email} is missing critical fields: ${missingFields.join(', ')}`);
        } else {
          logger.debug(`[User Repository] All critical fields present for user ${email}: id=${user.id}, is_email_verified=${user.is_email_verified}, role=${user.role}, password_hash=${!!user.password_hash}`);
        }

        return user;
      }

      logger.debug(`[User Repository] No user found with email: ${email}`);
      return null;
    } catch (error) {
      logger.error(`[User Repository] Error in findByEmail for ${email}:`, {
        error: error,
        stack: error.stack,
        query: query,
        parameters: [email]
      });
      throw error;
    }
  }

  async findUsersWithPagination(filters = {}, pagination = {}) {
    const { role, search } = filters;
    const { page = 1, limit = 10 } = pagination;

    const offset = (page - 1) * limit;
    const params = [];

    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    let query = `
      SELECT id, email, first_name, last_name, account_type, is_admin_portal, created_at, updated_at
      FROM users
      WHERE 1=1
    `;

    if (role) {
      params.push(role);
      const paramIndex = params.length;
      query += ` AND account_type = $${paramIndex}`;
      countQuery += ` AND account_type = $${paramIndex}`;
    }

    if (search) {
      params.push(`%${search}%`);
      const paramIndex = params.length;
      query += ` AND (
        email ILIKE $${paramIndex} OR
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex}
      )`;
      countQuery += ` AND (
        email ILIKE $${paramIndex} OR
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex}
      )`;
    }

    query += ' ORDER BY created_at DESC';

    params.push(limit);
    params.push(offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    try {
      const countResult = await db.query(countQuery, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].count, 10);

      const { rows } = await db.query(query, params);

      return {
        users: rows,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error in findUsersWithPagination:', error);
      throw error;
    }
  }

  async createUser(userData) {
    const { email, password_hash, first_name, last_name, account_type = 'client', created_by = null, is_admin_portal = false } = userData;

    const query = `
      INSERT INTO users
      (email, password_hash, first_name, last_name, account_type, created_by, is_admin_portal)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, first_name, last_name, account_type, is_admin_portal, created_at
    `;

    try {
      const { rows } = await db.query(query, [
        email,
        password_hash,
        first_name,
        last_name,
        account_type,
        created_by,
        is_admin_portal
      ]);
      return rows[0];
    } catch (error) {
      logger.error('Error in createUser:', error);
      throw error;
    }
  }

  async updatePassword(userId, passwordHash) {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id
    `;

    try {
      const { rowCount } = await db.query(query, [passwordHash, userId]);
      return rowCount > 0;
    } catch (error) {
      logger.error('Error in updatePassword:', error);
      throw error;
    }
  }

  async findAdmins(options = {}) {
    return this.findAll({ account_type: 'admin' }, options);
  }

  async getSecurityEvents(userId, limit = 10) {
    const query = `
      SELECT id, action_type, ip_address, user_agent, details, created_at
      FROM security_audit_log
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    try {
      const { rows } = await db.query(query, [userId, limit]);
      return rows;
    } catch (error) {
      logger.error('Error in getSecurityEvents:', error);
      throw error;
    }
  }

  async emailExists(email) {
    const query = 'SELECT 1 FROM users WHERE email = $1';

    try {
      const { rowCount } = await db.query(query, [email]);
      return rowCount > 0;
    } catch (error) {
      logger.error('Error in emailExists:', error);
      throw error;
    }
  }

  async getUserDetails(userId) {
    const query = `
      SELECT
        u.id, u.email, u.first_name, u.last_name,
        u.account_type, u.is_admin_portal, u.created_at, u.updated_at,
        u.role, u.created_by,
        creator.first_name as created_by_first_name,
        creator.last_name as created_by_last_name
      FROM users u
      LEFT JOIN users creator ON u.created_by = creator.id
      WHERE u.id = $1
    `;

    try {
      const { rows } = await db.query(query, [userId]);

      if (rows.length === 0) {
        return null;
      }

      const securityEvents = await this.getSecurityEvents(userId, 5);

      return {
        ...rows[0],
        securityEvents
      };
    } catch (error) {
      logger.error('Error in getUserDetails:', error);
      throw error;
    }
  }

  async setUserStatus(userId, _isActive) {
    // Legacy method kept for compatibility - isActive parameter no longer used since is_active column was removed
    logger.warn(`setUserStatus called for user ${userId} but is_active column no longer exists`);
    return true;
  }
}

module.exports = new UserRepository();
