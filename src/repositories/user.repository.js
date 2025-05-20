/**
 * User Repository
 * Handles database operations for users
 */
const BaseRepository = require('./base.repository');
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Find a user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} - User object or null
   */
  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';

    try {
      const { rows } = await db.query(query, [email]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error in findByEmail:', error);
      throw error;
    }
  }

  /**
   * Find users with pagination and filtering
   * @param {Object} filters - Filter criteria (role, search)
   * @param {Object} pagination - Pagination options (page, limit)
   * @returns {Promise<{users: Array, total: number, page: number, limit: number, totalPages: number}>} - Paginated users
   */
  async findUsersWithPagination(filters = {}, pagination = {}) {
    const { role, search } = filters;
    const { page = 1, limit = 10 } = pagination;

    const offset = (page - 1) * limit;
    const params = [];

    // Build base query
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    let query = `
      SELECT id, email, first_name, last_name, account_type, is_admin_portal, is_active, created_at, updated_at
      FROM users
      WHERE 1=1
    `;

    // Add role filter if provided
    if (role) {
      params.push(role);
      const paramIndex = params.length;
      query += ` AND account_type = $${paramIndex}`;
      countQuery += ` AND account_type = $${paramIndex}`;
    }

    // Add search filter if provided
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

    // Add order by
    query += ' ORDER BY created_at DESC';

    // Add pagination
    params.push(limit);
    params.push(offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    try {
      // Get total count
      const countResult = await db.query(countQuery, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].count, 10);

      // Get paginated users
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

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Created user
   */
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

  /**
   * Update user password
   * @param {number} userId - User ID
   * @param {string} passwordHash - New password hash
   * @returns {Promise<boolean>} - True if updated successfully
   */
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

  /**
   * Find admin users
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of admin users
   */
  async findAdmins(options = {}) {
    return this.findAll({ account_type: 'admin' }, options);
  }

  /**
   * Get user security events
   * @param {number} userId - User ID
   * @param {number} limit - Maximum number of events to return
   * @returns {Promise<Array>} - Array of security events
   */
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

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} - True if email exists
   */
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

  /**
   * Get detailed user information by ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} - User object or null
   */
  async getUserDetails(userId) {
    const query = `
      SELECT
        u.id, u.email, u.first_name, u.last_name,
        u.account_type, u.is_admin_portal, u.is_active, u.created_at, u.updated_at,
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

      // Get recent security events
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

  /**
   * Set user active status
   * @param {number} userId - User ID
   * @param {boolean} isActive - Active status to set
   * @returns {Promise<boolean>} - True if updated successfully
   */
  async setUserStatus(userId, isActive) {
    const query = `
      UPDATE users
      SET is_active = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;

    try {
      const { rowCount } = await db.query(query, [userId, isActive]);
      return rowCount > 0;
    } catch (error) {
      logger.error('Error in setUserStatus:', error);
      throw error;
    }
  }
}

module.exports = new UserRepository();
