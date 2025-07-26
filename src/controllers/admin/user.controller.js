/**
 * Admin User Controller
 * Handles admin user management operations
 */
const { userRepository, applicationRepository, paymentRepository, securityRepository } = require('../../repositories');
const ApiResponse = require('../../utils/api-response');
const { logger } = require('../../utils/logger');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const emailService = require('../../services/email.service');
const db = require('../../db');

// Will be injected by dependency container
let auditService = null;
const setAuditService = (service) => {
  auditService = service;
};
exports.setAuditService = setAuditService;

/**
 * Get all users with advanced filtering, sorting and pagination
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const { 
      page = 1, 
      limit = 10, 
      role, 
      accountStatus, 
      verificationStatus,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    logger.info(`Admin ${adminId} requested users list with filters:`, {
      page, limit, role, accountStatus, verificationStatus, search, sortBy, sortOrder
    });

    // Validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return ApiResponse.badRequest(res, 'Parámetro de página inválido');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return ApiResponse.badRequest(res, 'Parámetro de límite inválido (debe estar entre 1 y 100)');
    }

    // Validate sort parameters
    const allowedSortFields = ['created_at', 'updated_at', 'last_login_at', 'email', 'first_name', 'last_name'];
    const allowedSortOrders = ['ASC', 'DESC'];
    
    if (!allowedSortFields.includes(sortBy)) {
      return ApiResponse.badRequest(res, 'Campo de ordenamiento inválido');
    }
    
    if (!allowedSortOrders.includes(sortOrder.toUpperCase())) {
      return ApiResponse.badRequest(res, 'Orden de ordenamiento inválido');
    }

    // Build query with filters
    const offset = (pageNum - 1) * limitNum;
    const params = [];
    
    let countQuery = `
      SELECT COUNT(DISTINCT u.id) 
      FROM users u
      WHERE 1=1
    `;
    
    let query = `
      SELECT DISTINCT
        u.id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.whatsapp_phone,
        u.account_type, 
        u.role,
        u.is_email_verified,
        u.account_status,
        u.created_at, 
        u.updated_at,
        u.last_login_at,
        u.failed_login_attempts,
        u.is_admin_portal,
        COUNT(DISTINCT pa.id) as application_count,
        COUNT(DISTINCT CASE WHEN pa.status = 'completed' THEN pa.id END) as completed_applications
      FROM users u
      LEFT JOIN permit_applications pa ON u.id = pa.user_id
      WHERE 1=1
    `;

    // Apply filters
    if (role) {
      params.push(role);
      const paramIndex = params.length;
      query += ` AND u.account_type = $${paramIndex}`;
      countQuery += ` AND u.account_type = $${paramIndex}`;
    }

    if (accountStatus) {
      params.push(accountStatus);
      const paramIndex = params.length;
      query += ` AND u.account_status = $${paramIndex}`;
      countQuery += ` AND u.account_status = $${paramIndex}`;
    }

    if (verificationStatus !== undefined) {
      params.push(verificationStatus === 'true');
      const paramIndex = params.length;
      query += ` AND u.is_email_verified = $${paramIndex}`;
      countQuery += ` AND u.is_email_verified = $${paramIndex}`;
    }

    if (search) {
      params.push(`%${search}%`);
      const paramIndex = params.length;
      query += ` AND (
        u.email ILIKE $${paramIndex} OR
        u.first_name ILIKE $${paramIndex} OR
        u.last_name ILIKE $${paramIndex} OR
        u.whatsapp_phone ILIKE $${paramIndex}
      )`;
      countQuery += ` AND (
        u.email ILIKE $${paramIndex} OR
        u.first_name ILIKE $${paramIndex} OR
        u.last_name ILIKE $${paramIndex} OR
        u.whatsapp_phone ILIKE $${paramIndex}
      )`;
    }

    // Add GROUP BY clause
    query += ` GROUP BY u.id, u.email, u.first_name, u.last_name, u.whatsapp_phone,
               u.account_type, u.role, u.is_email_verified, u.account_status,
               u.created_at, u.updated_at, u.last_login_at, u.failed_login_attempts,
               u.is_admin_portal`;

    // Add sorting
    query += ` ORDER BY u.${sortBy} ${sortOrder.toUpperCase()}`;

    // Add pagination
    params.push(limitNum);
    params.push(offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    // Execute queries
    const countResult = await db.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await db.query(query, params);

    // Audit log
    if (auditService) {
      await auditService.logAdminAction(
        adminId,
        'view',
        'user_list',
        null,
        { filters: { role, accountStatus, verificationStatus, search }, page: pageNum, resultCount: rows.length },
        req
      );
    }

    return ApiResponse.success(res, {
      users: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error getting all users:', error);
    return next(error);
  }
};

/**
 * Get users with pagination and filtering (legacy method for backward compatibility)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUsers = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const { page = 1, limit = 10, role, search } = req.query;

    logger.info(`Admin ${adminId} requested users list with filters: ${JSON.stringify({ page, limit, role, search })}`);

    // Validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return ApiResponse.badRequest(res, 'Parámetro de página inválido');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return ApiResponse.badRequest(res, 'Parámetro de límite inválido (debe estar entre 1 y 100)');
    }

    // Get users with pagination and filtering
    const result = await userRepository.findUsersWithPagination(
      { role, search },
      { page: pageNum, limit: limitNum }
    );

    // Return paginated users
    return ApiResponse.success(res, {
      users: result.users,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    logger.error('Error getting users:', error);
    return next(error);
  }
};

/**
 * Get complete user details including history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUserDetails = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'ID de usuario inválido');
    }

    logger.info(`Admin ${adminId} requested complete details for user ${userId}`);

    // Get basic user details
    const userQuery = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.whatsapp_phone,
        u.account_type, u.role, u.is_email_verified, u.account_status,
        u.created_at, u.updated_at, u.last_login_at,
        u.failed_login_attempts, u.lockout_until, u.admin_notes,
        u.is_admin_portal, u.created_by,
        creator.first_name as created_by_first_name,
        creator.last_name as created_by_last_name,
        creator.email as created_by_email
      FROM users u
      LEFT JOIN users creator ON u.created_by = creator.id
      WHERE u.id = $1
    `;

    const userResult = await db.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      logger.warn(`Admin ${adminId} requested non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'Usuario no encontrado');
    }

    const user = userResult.rows[0];

    // Get application history
    const applicationsQuery = `
      SELECT 
        pa.id, pa.status, pa.created_at, pa.updated_at,
        pa.payment_reference, pa.permit_number,
        pa.marca, pa.linea, pa.ano_modelo, pa.placas,
        pa.total_amount, pa.payment_method
      FROM permit_applications pa
      WHERE pa.user_id = $1
      ORDER BY pa.created_at DESC
      LIMIT 20
    `;
    
    const applicationsResult = await db.query(applicationsQuery, [userId]);

    // Get payment history
    const paymentsQuery = `
      SELECT 
        pe.id, pe.application_id, pe.order_id, pe.event_type,
        pe.event_data, pe.created_at,
        pa.payment_reference, pa.total_amount, pa.payment_method
      FROM payment_events pe
      JOIN permit_applications pa ON pe.application_id = pa.id
      WHERE pa.user_id = $1
      ORDER BY pe.created_at DESC
      LIMIT 50
    `;
    
    const paymentsResult = await db.query(paymentsQuery, [userId]);

    // Get login history
    const loginHistoryQuery = `
      SELECT 
        sal.id, sal.action_type, sal.ip_address, sal.user_agent,
        sal.details, sal.created_at
      FROM security_audit_log sal
      WHERE sal.user_id = $1
        AND sal.action_type IN ('login_success', 'login_failed', 'logout', 'password_reset')
      ORDER BY sal.created_at DESC
      LIMIT 20
    `;
    
    const loginHistoryResult = await db.query(loginHistoryQuery, [userId]);

    // Get security events
    const securityEventsQuery = `
      SELECT 
        sal.id, sal.action_type, sal.ip_address, sal.user_agent,
        sal.details, sal.created_at
      FROM security_audit_log sal
      WHERE sal.user_id = $1
        AND sal.action_type NOT IN ('login_success', 'login_failed', 'logout')
      ORDER BY sal.created_at DESC
      LIMIT 20
    `;
    
    const securityEventsResult = await db.query(securityEventsQuery, [userId]);

    // Audit log
    if (auditService) {
      await auditService.logAdminAction(
        adminId,
        'view',
        'user',
        userId,
        null,
        req
      );
    }

    return ApiResponse.success(res, {
      user: {
        ...user,
        applicationHistory: applicationsResult.rows,
        paymentHistory: paymentsResult.rows,
        loginHistory: loginHistoryResult.rows,
        securityEvents: securityEventsResult.rows
      }
    });
  } catch (error) {
    logger.error(`Error getting user details for ID ${req.params.id}:`, error);
    return next(error);
  }
};

/**
 * Get user details by ID (legacy method for backward compatibility)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUserById = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'ID de usuario inválido');
    }

    logger.info(`Admin ${adminId} requested details for user ${userId}`);

    // Get user details
    const user = await userRepository.getUserDetails(userId);

    if (!user) {
      logger.warn(`Admin ${req.session.userId} requested non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'User not found');
    }

    // Return user details
    return ApiResponse.success(res, { user });
  } catch (error) {
    logger.error(`Error getting user details for ID ${req.params.id}:`, error);
    return next(error);
  }
};

/**
 * Get applications for a specific user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getUserApplications = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'ID de usuario inválido');
    }

    logger.info(`Admin ${adminId} requested applications for user ${userId}`);

    // Check if user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      logger.warn(`Admin ${adminId} requested applications for non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'User not found');
    }

    // Get applications for the user
    const applications = await applicationRepository.findByUserId(userId);

    // Return applications
    return ApiResponse.success(res, { applications });
  } catch (error) {
    logger.error(`Error getting applications for user ID ${req.params.userId}:`, error);
    return next(error);
  }
};

/**
 * Update user information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.updateUser = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.id, 10);
    const {
      first_name,
      last_name,
      email,
      whatsapp_phone,
      account_type,
      role,
      account_status,
      admin_notes
    } = req.body;

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'ID de usuario inválido');
    }

    logger.info(`Admin ${adminId} is updating user ${userId}`, { updates: req.body });

    // Check if user exists
    const existingUserQuery = 'SELECT * FROM users WHERE id = $1';
    const existingUserResult = await db.query(existingUserQuery, [userId]);
    
    if (existingUserResult.rows.length === 0) {
      logger.warn(`Admin ${adminId} attempted to update non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'Usuario no encontrado');
    }

    const existingUser = existingUserResult.rows[0];

    // Prevent admins from changing their own role or disabling their own account
    if (userId === adminId) {
      if (account_type && account_type !== existingUser.account_type) {
        return ApiResponse.badRequest(res, 'No puedes cambiar tu propio rol');
      }
      if (account_status && account_status !== existingUser.account_status && account_status !== 'active') {
        return ApiResponse.badRequest(res, 'No puedes desactivar tu propia cuenta');
      }
    }

    // Check if email is being changed and if it's already in use
    if (email && email !== existingUser.email) {
      const emailCheckQuery = 'SELECT id FROM users WHERE email = $1 AND id != $2';
      const emailCheckResult = await db.query(emailCheckQuery, [email, userId]);
      
      if (emailCheckResult.rows.length > 0) {
        return ApiResponse.badRequest(res, 'Este correo electrónico ya está en uso');
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    if (first_name !== undefined) {
      paramCount++;
      updateFields.push(`first_name = $${paramCount}`);
      updateValues.push(first_name);
    }

    if (last_name !== undefined) {
      paramCount++;
      updateFields.push(`last_name = $${paramCount}`);
      updateValues.push(last_name);
    }

    if (email !== undefined) {
      paramCount++;
      updateFields.push(`email = $${paramCount}`);
      updateValues.push(email);
      // Reset email verification if email is changed
      updateFields.push(`is_email_verified = false`);
    }

    if (whatsapp_phone !== undefined) {
      paramCount++;
      updateFields.push(`whatsapp_phone = $${paramCount}`);
      updateValues.push(whatsapp_phone);
    }

    if (account_type !== undefined) {
      paramCount++;
      updateFields.push(`account_type = $${paramCount}`);
      updateValues.push(account_type);
    }

    if (role !== undefined) {
      paramCount++;
      updateFields.push(`role = $${paramCount}`);
      updateValues.push(role);
    }

    if (account_status !== undefined) {
      paramCount++;
      updateFields.push(`account_status = $${paramCount}`);
      updateValues.push(account_status);
    }

    if (admin_notes !== undefined) {
      paramCount++;
      updateFields.push(`admin_notes = $${paramCount}`);
      updateValues.push(admin_notes);
    }

    if (updateFields.length === 0) {
      return ApiResponse.badRequest(res, 'No se proporcionaron campos para actualizar');
    }

    // Add updated_at and user ID
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    paramCount++;
    updateValues.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, whatsapp_phone, 
                account_type, role, account_status, is_email_verified, 
                admin_notes, updated_at
    `;

    const result = await db.query(updateQuery, updateValues);

    // Audit log
    await securityRepository.logActivity(
      adminId,
      'admin_user_updated',
      req.ip,
      req.get('user-agent'),
      { 
        updatedUserId: userId,
        changedFields: Object.keys(req.body),
        oldValues: {
          email: existingUser.email,
          account_type: existingUser.account_type,
          account_status: existingUser.account_status
        }
      }
    );

    logger.info(`Admin ${adminId} successfully updated user ${userId}`);
    return ApiResponse.success(res, { user: result.rows[0] }, 200, 'Usuario actualizado exitosamente');
  } catch (error) {
    logger.error(`Error updating user ID ${req.params.id}:`, error);
    return next(error);
  }
};

/**
 * Enable a user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.enableUser = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'ID de usuario inválido');
    }

    logger.info(`Admin ${adminId} is enabling user ${userId}`);

    // Check if user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      logger.warn(`Admin ${adminId} attempted to enable non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'User not found');
    }

    // Update user status
    const updated = await userRepository.setUserStatus(userId, true);
    if (!updated) {
      logger.error(`Failed to enable user ID: ${userId}`);
      return ApiResponse.error(res, 'Failed to enable user account', 500);
    }

    logger.info(`Admin ${adminId} successfully enabled user ${userId}`);
    return ApiResponse.success(res, null, 200, 'User account enabled successfully');
  } catch (error) {
    logger.error(`Error enabling user ID ${req.params.id}:`, error);
    return next(error);
  }
};

/**
 * Disable a user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.disableUser = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'ID de usuario inválido');
    }

    // Prevent admins from disabling their own account
    if (userId === adminId) {
      logger.warn(`Admin ${adminId} attempted to disable their own account`);
      return ApiResponse.badRequest(res, 'You cannot disable your own account');
    }

    logger.info(`Admin ${adminId} is disabling user ${userId}`);

    // Check if user exists
    const user = await userRepository.findById(userId);
    if (!user) {
      logger.warn(`Admin ${adminId} attempted to disable non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'User not found');
    }

    // Update user status
    const updated = await userRepository.setUserStatus(userId, false);
    if (!updated) {
      logger.error(`Failed to disable user ID: ${userId}`);
      return ApiResponse.error(res, 'Failed to disable user account', 500);
    }

    logger.info(`Admin ${adminId} successfully disabled user ${userId}`);
    return ApiResponse.success(res, null, 200, 'User account disabled successfully');
  } catch (error) {
    logger.error(`Error disabling user ID ${req.params.id}:`, error);
    return next(error);
  }
};

/**
 * Reset user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.resetUserPassword = async (req, res, next) => {
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.id, 10);
    const { sendEmail = true } = req.body;

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'ID de usuario inválido');
    }

    logger.info(`Admin ${adminId} is resetting password for user ${userId}`);

    // Check if user exists
    const userQuery = 'SELECT id, email, first_name, last_name FROM users WHERE id = $1';
    const userResult = await db.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      logger.warn(`Admin ${adminId} attempted to reset password for non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'Usuario no encontrado');
    }

    const user = userResult.rows[0];

    // Generate secure temporary password
    const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
    const tempPasswordHash = await bcrypt.hash(tempPassword, 10);

    // Update user's password
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1, 
          updated_at = CURRENT_TIMESTAMP,
          failed_login_attempts = 0,
          lockout_until = NULL
      WHERE id = $2
      RETURNING id
    `;
    
    await db.query(updateQuery, [tempPasswordHash, userId]);

    // Create password reset token for user to change password on first login
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration

    await userRepository.createPasswordResetToken(userId, resetToken, expiresAt);

    // Send email if requested
    if (sendEmail) {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      
      await emailService.sendEmail({
        to: user.email,
        subject: 'Restablecimiento de contraseña - Permisos Digitales',
        html: `
          <h2>Restablecimiento de contraseña</h2>
          <p>Hola ${user.first_name},</p>
          <p>Un administrador ha restablecido tu contraseña. Tu nueva contraseña temporal es:</p>
          <p><strong>${tempPassword}</strong></p>
          <p>Por razones de seguridad, te recomendamos cambiar esta contraseña inmediatamente.</p>
          <p>Puedes cambiar tu contraseña haciendo clic en el siguiente enlace:</p>
          <p><a href="${resetUrl}">Cambiar contraseña</a></p>
          <p>Este enlace expirará en 24 horas.</p>
          <p>Si no solicitaste este cambio, por favor contacta al soporte inmediatamente.</p>
          <p>Saludos,<br>Equipo de Permisos Digitales</p>
        `
      });
    }

    // Audit log
    await securityRepository.logActivity(
      adminId,
      'admin_password_reset',
      req.ip,
      req.get('user-agent'),
      { 
        resetUserId: userId,
        emailSent: sendEmail
      }
    );

    logger.info(`Admin ${adminId} successfully reset password for user ${userId}`);
    
    const response = {
      message: 'Contraseña restablecida exitosamente',
      temporaryPassword: tempPassword
    };

    if (sendEmail) {
      response.emailSent = true;
    }

    return ApiResponse.success(res, response);
  } catch (error) {
    logger.error(`Error resetting password for user ID ${req.params.id}:`, error);
    return next(error);
  }
};

/**
 * Delete user (soft delete with data retention)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.deleteUser = async (req, res, next) => {
  const client = await db.getPool().connect();
  
  try {
    const adminId = req.session.userId;
    const userId = parseInt(req.params.id, 10);
    const { force = false } = req.body;

    if (isNaN(userId)) {
      return ApiResponse.badRequest(res, 'ID de usuario inválido');
    }

    // Prevent admins from deleting their own account
    if (userId === adminId) {
      logger.warn(`Admin ${adminId} attempted to delete their own account`);
      return ApiResponse.badRequest(res, 'No puedes eliminar tu propia cuenta');
    }

    logger.info(`Admin ${adminId} is deleting user ${userId}`, { force });

    await client.query('BEGIN');

    // Check if user exists
    const userQuery = 'SELECT * FROM users WHERE id = $1';
    const userResult = await client.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      logger.warn(`Admin ${adminId} attempted to delete non-existent user ID: ${userId}`);
      return ApiResponse.notFound(res, 'Usuario no encontrado');
    }

    const user = userResult.rows[0];

    // Check for active applications
    const activeApplicationsQuery = `
      SELECT COUNT(*) as count
      FROM permit_applications
      WHERE user_id = $1
        AND status IN ('pending_payment', 'pending_approval', 'processing', 'approved')
    `;
    const activeApplicationsResult = await client.query(activeApplicationsQuery, [userId]);
    const activeApplicationsCount = parseInt(activeApplicationsResult.rows[0].count, 10);

    if (activeApplicationsCount > 0 && !force) {
      await client.query('ROLLBACK');
      return ApiResponse.badRequest(res, 
        `El usuario tiene ${activeApplicationsCount} solicitudes activas. ` +
        'Use force=true para eliminar de todos modos.'
      );
    }

    // Archive user data
    const archiveQuery = `
      INSERT INTO deleted_users_archive 
      (user_id, email, first_name, last_name, whatsapp_phone, 
       account_type, role, user_data, deleted_by, deleted_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    `;
    
    await client.query(archiveQuery, [
      user.id,
      user.email,
      user.first_name,
      user.last_name,
      user.whatsapp_phone,
      user.account_type,
      user.role,
      JSON.stringify(user),
      adminId
    ]);

    // Soft delete - mark user as deleted but keep the record
    const deleteQuery = `
      UPDATE users 
      SET 
        account_status = 'deleted',
        email = CONCAT('deleted_', id, '_', email),
        deleted_at = CURRENT_TIMESTAMP,
        deleted_by = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id
    `;
    
    await client.query(deleteQuery, [adminId, userId]);

    // Archive all user's applications
    const archiveApplicationsQuery = `
      UPDATE permit_applications
      SET 
        archived = true,
        archived_at = CURRENT_TIMESTAMP,
        archived_by = $1
      WHERE user_id = $2
    `;
    
    await client.query(archiveApplicationsQuery, [adminId, userId]);

    await client.query('COMMIT');

    // Audit log
    await securityRepository.logActivity(
      adminId,
      'admin_user_deleted',
      req.ip,
      req.get('user-agent'),
      { 
        deletedUserId: userId,
        userEmail: user.email,
        force: force,
        activeApplications: activeApplicationsCount
      }
    );

    logger.info(`Admin ${adminId} successfully deleted user ${userId}`);
    
    return ApiResponse.success(res, {
      message: 'Usuario eliminado exitosamente',
      archivedData: {
        userId: user.id,
        email: user.email,
        applicationCount: activeApplicationsCount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Error deleting user ID ${req.params.id}:`, error);
    return next(error);
  } finally {
    client.release();
  }
};
