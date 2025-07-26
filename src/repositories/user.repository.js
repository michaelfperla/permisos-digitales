const BaseRepository = require('./base.repository');
const db = require('../db');
const { logger } = require('../utils/logger');

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

  async updateEmailVerification(userId, token, expires) {
    const query = `
      UPDATE users 
      SET email_verification_token = $1, 
          email_verification_expires = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, email
    `;

    try {
      const { rows } = await db.query(query, [token, expires, userId]);
      if (rows.length === 0) {
        return null;
      }
      logger.debug(`Updated email verification for user ${userId}`);
      return rows[0];
    } catch (error) {
      logger.error('Error in updateEmailVerification:', error);
      throw error;
    }
  }

  // Password Reset Repository Methods

  /**
   * Create a password reset token for a user
   * @param {number} userId - User ID
   * @param {string} token - Reset token
   * @param {Date} expiresAt - Token expiration date
   * @returns {Promise<string|null>} Reset token or null if failed
   */
  async createPasswordResetToken(userId, token, expiresAt) {
    try {
      // Delete any existing tokens for this user first
      await db.query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [userId]
      );

      // Insert new token
      const query = `
        INSERT INTO password_reset_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING token
      `;
      const { rows } = await db.query(query, [userId, token, expiresAt]);

      if (rows.length === 0) {
        throw new Error('Failed to create reset token');
      }

      logger.info(`Created password reset token for user ${userId}`);
      return token;
    } catch (error) {
      logger.error(`Error creating reset token for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Find user by reset token with comprehensive security checks
   * @param {string} token - Reset token
   * @returns {Promise<Object|null>} User data with security info or null
   */
  async findUserByResetToken(token) {
    try {
      // Intelligent user verification query
      const query = `
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.is_email_verified,
          u.account_status,
          u.created_at,
          u.last_login_at,
          prt.expires_at,
          prt.used_at,
          COUNT(DISTINCT prt_active.id) as active_reset_tokens,
          MAX(prt_active.created_at) as last_reset_request
        FROM password_reset_tokens prt
        INNER JOIN users u ON prt.user_id = u.id
        LEFT JOIN password_reset_tokens prt_active ON u.id = prt_active.user_id 
          AND prt_active.expires_at > CURRENT_TIMESTAMP 
          AND prt_active.used_at IS NULL
        WHERE prt.token = $1
        GROUP BY u.id, u.email, u.first_name, u.last_name, 
                 u.is_email_verified, u.account_status, 
                 u.created_at, u.last_login_at,
                 prt.expires_at, prt.used_at
      `;
      
      const { rows } = await db.query(query, [token]);

      if (rows.length === 0) {
        logger.warn(`Invalid reset token: ${token}`);
        return null;
      }

      return rows[0];
    } catch (error) {
      logger.error('Error finding user by reset token:', error);
      throw error;
    }
  }

  /**
   * Find user by email with security context for password reset
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User data with security context or null
   */
  async findUserForPasswordReset(email) {
    try {
      // Intelligent user verification query
      const query = `
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.is_email_verified,
          u.account_status,
          u.created_at,
          u.last_login_at,
          COUNT(DISTINCT prt.id) as active_reset_tokens,
          MAX(prt.created_at) as last_reset_request
        FROM users u
        LEFT JOIN password_reset_tokens prt ON u.id = prt.user_id 
          AND prt.expires_at > CURRENT_TIMESTAMP 
          AND prt.used_at IS NULL
        WHERE LOWER(u.email) = LOWER($1)
        GROUP BY u.id, u.email, u.first_name, u.last_name, 
                 u.is_email_verified, u.account_status, 
                 u.created_at, u.last_login_at
      `;
      
      const { rows } = await db.query(query, [email.trim()]);

      if (rows.length === 0) {
        return null;
      }

      return rows[0];
    } catch (error) {
      logger.error('Error finding user for password reset:', error);
      throw error;
    }
  }

  /**
   * Mark a reset token as used
   * @param {string} token - Reset token
   * @returns {Promise<boolean>} True if successful
   */
  async invalidateResetToken(token) {
    try {
      const query = `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE token = $1
      `;
      const { rowCount } = await db.query(query, [token]);
      
      if (rowCount > 0) {
        logger.info(`Marked reset token as used: ${token}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error invalidating reset token:', error);
      throw error;
    }
  }

  /**
   * Update user password with transaction safety
   * @param {number} userId - User ID
   * @param {string} passwordHash - New password hash
   * @returns {Promise<boolean>} True if successful
   */
  async updateUserPassword(userId, passwordHash) {
    try {
      const query = `
        UPDATE users
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      const { rowCount } = await db.query(query, [passwordHash, userId]);
      
      if (rowCount > 0) {
        logger.info(`Password updated successfully for user ${userId}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error updating user password:', error);
      throw error;
    }
  }

  /**
   * Clean up expired password reset tokens
   * @returns {Promise<number>} Number of tokens cleaned up
   */
  async cleanupExpiredTokens() {
    try {
      const query = `
        DELETE FROM password_reset_tokens
        WHERE expires_at < CURRENT_TIMESTAMP
      `;
      const { rowCount } = await db.query(query);
      
      if (rowCount > 0) {
        logger.info(`Cleaned up ${rowCount} expired password reset tokens`);
      }
      return rowCount;
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
      throw error;
    }
  }

  /**
   * Log security audit event
   * @param {number|null} userId - User ID (can be null for anonymous events)
   * @param {string} actionType - Type of security action
   * @param {string} ipAddress - IP address
   * @param {Object} details - Additional details
   * @returns {Promise<boolean>} True if successful
   */
  async logSecurityEvent(userId, actionType, ipAddress, details) {
    try {
      const query = `
        INSERT INTO security_audit_log (user_id, action_type, ip_address, details, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `;
      await db.query(query, [userId, actionType, ipAddress, JSON.stringify(details)]);
      return true;
    } catch (error) {
      logger.error('Error logging security event:', error);
      throw error;
    }
  }

  /**
   * Execute password reset with transaction safety
   * @param {string} token - Reset token
   * @param {string} passwordHash - New password hash
   * @returns {Promise<{success: boolean, userId?: number}>} Result with user ID if successful
   */
  async executePasswordReset(token, passwordHash) {
    const client = await db.getPool().connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');

      // Validate token and get user data
      const tokenQuery = `
        SELECT 
          u.id,
          prt.expires_at,
          prt.used_at
        FROM password_reset_tokens prt
        INNER JOIN users u ON prt.user_id = u.id
        WHERE prt.token = $1
      `;
      const tokenResult = await client.query(tokenQuery, [token]);

      if (tokenResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false };
      }

      const { id: userId, expires_at, used_at } = tokenResult.rows[0];

      // Check if token is expired
      if (new Date() > new Date(expires_at)) {
        await client.query('ROLLBACK');
        return { success: false };
      }

      // Check if token has already been used
      if (used_at) {
        await client.query('ROLLBACK');
        return { success: false };
      }

      // Update user's password
      const updateQuery = `
        UPDATE users
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      await client.query(updateQuery, [passwordHash, userId]);

      // Mark token as used
      const tokenUpdateQuery = `
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE token = $1
      `;
      await client.query(tokenUpdateQuery, [token]);

      // Commit transaction
      await client.query('COMMIT');

      logger.info(`Password reset successful for user ${userId}`);
      return { success: true, userId };
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      logger.error('Error executing password reset:', error);
      throw error;
    } finally {
      // Release client back to pool
      client.release();
    }
  }

  /**
   * Get all user data for export
   * @param {number} userId - User ID
   * @returns {Promise<Object>} All user data
   */
  async getUserDataExport(userId) {
    const client = await db.getPool().connect();
    
    try {
      // Get user profile
      const userQuery = `
        SELECT id, email, first_name, last_name, whatsapp_phone, 
               account_type, role, created_at, updated_at, 
               is_email_verified
        FROM users 
        WHERE id = $1
      `;
      const userResult = await client.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        return null;
      }
      
      const userData = userResult.rows[0];
      
      // Get permits
      const permitsQuery = `
        SELECT id, folio, status, fecha_emision, fecha_vencimiento,
               nombre_completo, curp_rfc, domicilio, marca, linea, 
               color, numero_serie, numero_motor, ano_modelo, 
               importe, permit_url, created_at
        FROM permit_applications
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;
      const permitsResult = await client.query(permitsQuery, [userId]);
      userData.permits = permitsResult.rows;
      
      // Get payments
      const paymentsQuery = `
        SELECT p.id, p.amount, p.currency, p.status, p.payment_method,
               p.payment_intent_id, p.created_at, p.paid_at
        FROM payments p
        JOIN permit_applications pa ON p.application_id = pa.id
        WHERE pa.user_id = $1
        ORDER BY p.created_at DESC
      `;
      const paymentsResult = await client.query(paymentsQuery, [userId]);
      userData.payments = paymentsResult.rows;
      
      // Get WhatsApp notifications if table exists
      try {
        // Use parameterized query to prevent SQL injection
        const whatsappQuery = `
          SELECT id, notification_type, phone_number, message_content,
                 status, sent_at, created_at
          FROM whatsapp_notifications
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2
        `;
        const whatsappResult = await client.query(whatsappQuery, [userId, 100]);
        userData.whatsapp_notifications = whatsappResult.rows;
      } catch (error) {
        // Table might not exist yet
        logger.debug('WhatsApp notifications table not available', { error: error.message });
        userData.whatsapp_notifications = [];
      }
      
      return userData;
      
    } catch (error) {
      logger.error('Error getting user data export', { error: error.message, userId });
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new UserRepository();
