const userService = require('../services/user.service');
const { logger } = require('../utils/logger');
const { handleControllerError } = require('../utils/error-helpers');
const ApiResponse = require('../utils/api-response');
const db = require('../db');
const emailService = require('../services/email.service');
const { userRepository } = require('../repositories');
const { validateAndSanitizeWhatsAppPhone, maskPhoneNumber } = require('../utils/phone-validation');

exports.getProfile = async (req, res, next) => {
  const userId = req.session.userId;

  if (!userId) {
    return ApiResponse.unauthorized(res, 'Usuario no autenticado.');
  }

  try {
    logger.info(`Fetching profile for user ID: ${userId}`);

    const user = await userService.getUserProfile(userId);

    if (!user) {
      return ApiResponse.notFound(res, 'Perfil de usuario no encontrado.');
    }

    return ApiResponse.success(res, {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        account_type: user.account_type,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    handleControllerError(error, 'getProfile', req, res, next);
  }
};

exports.updateProfile = async (req, res, next) => {
  const userId = req.session.userId;

  if (!userId) {
    return ApiResponse.unauthorized(res, 'Usuario no autenticado.');
  }

  try {
    logger.info(`Updating profile for user ID: ${userId}`);

    const { first_name, last_name, email } = req.body;

    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;

    if (Object.keys(updateData).length === 0) {
      return ApiResponse.badRequest(res, 'No se proporcionaron campos válidos para actualizar.');
    }

    if (email) {
      const emailExists = await userService.checkEmailExists(email, userId);
      if (emailExists) {
        return ApiResponse.conflict(res, 'El correo electrónico ya está en uso por otra cuenta.');
      }
    }

    const updatedUser = await userService.updateUserProfile(userId, updateData);

    if (!updatedUser) {
      return ApiResponse.notFound(res, 'Perfil de usuario no encontrado.');
    }

    // Update session data
    if (updatedUser.first_name) req.session.userName = updatedUser.first_name;
    if (updatedUser.last_name) req.session.userLastName = updatedUser.last_name;
    req.session.accountType = updatedUser.account_type || req.session.accountType;

    try {
      await new Promise((resolve, _reject) => {
        req.session.save(err => {
          if (err) {
            logger.error(`[userController.updateProfile] Error saving session: ${err}`);
            resolve();
          } else {
            logger.debug(`Session explicitly saved. Session ID: ${req.session.id}`);
            resolve();
          }
        });
      });
    } catch (saveError) {
      logger.error(`[userController.updateProfile] Exception during session save promise: ${saveError}`);
    }

    return ApiResponse.success(res,
      null,
      200,
      'Perfil actualizado exitosamente.'
    );
  } catch (error) {
    handleControllerError(error, 'updateProfile', req, res, next, {
      errorMappings: {
        '23505': {
          status: 409,
          message: 'El correo electrónico ya está en uso por otra cuenta.'
        }
      }
    });
  }
};

/**
 * Delete user's own account and data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.deleteAccount = async (req, res, next) => {
  let client;
  
  try {
    const userId = req.session.userId;
    const { confirmEmail, deleteReason } = req.body;
    
    if (!userId) {
      return ApiResponse.unauthorized(res, 'Usuario no autenticado.');
    }
    
    // Validate input
    if (!confirmEmail || typeof confirmEmail !== 'string') {
      return ApiResponse.badRequest(res, 'El correo de confirmación es requerido');
    }
    
    // Sanitize deletion reason
    const sanitizedReason = deleteReason ? 
      String(deleteReason).substring(0, 500).replace(/[<>]/g, '') : 
      'User requested deletion';
    
    logger.info(`User ${userId} requested account deletion`);
    
    // Get database connection
    client = await db.getPool().connect();
    
    // Get user details
    const userQuery = 'SELECT email, first_name, last_name, whatsapp_phone, account_status FROM users WHERE id = $1';
    const userResult = await client.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return ApiResponse.notFound(res, 'Usuario no encontrado');
    }
    
    const user = userResult.rows[0];
    
    // Check if account is already deleted
    if (user.account_status === 'deleted') {
      return ApiResponse.badRequest(res, 'Esta cuenta ya ha sido eliminada');
    }
    
    // Verify email confirmation (case-insensitive)
    if (confirmEmail.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
      return ApiResponse.badRequest(res, 'El correo de confirmación no coincide');
    }
    
    await client.query('BEGIN');
    
    // Check for active permits
    const activePermitsQuery = `
      SELECT COUNT(*) as count
      FROM permit_applications
      WHERE user_id = $1
        AND status = 'PERMIT_READY'
        AND fecha_vencimiento > NOW()
    `;
    const activePermitsResult = await client.query(activePermitsQuery, [userId]);
    const activePermitsCount = parseInt(activePermitsResult.rows[0].count, 10);
    
    if (activePermitsCount > 0) {
      await client.query('ROLLBACK');
      return ApiResponse.badRequest(res, 
        'No puedes eliminar tu cuenta mientras tengas permisos activos. ' +
        'Por favor espera a que venzan o contacta soporte.'
      );
    }
    
    // Archive user data if table exists (we'll create in migration)
    try {
      const archiveQuery = `
        INSERT INTO deleted_users_archive 
        (user_id, email, first_name, last_name, whatsapp_phone, 
         account_type, role, user_data, deleted_by, deleted_at, deletion_reason)
        SELECT 
          id, email, first_name, last_name, whatsapp_phone,
          account_type, role, row_to_json(users.*), id, NOW(), $2
        FROM users
        WHERE id = $1
      `;
      
      await client.query(archiveQuery, [userId, sanitizedReason]);
    } catch (archiveError) {
      logger.warn('Deleted users archive table may not exist yet', { error: archiveError.message });
    }
    
    // Delete WhatsApp data if function exists
    try {
      await client.query('SELECT delete_user_whatsapp_data($1)', [userId]);
    } catch (whatsappError) {
      logger.warn('WhatsApp deletion function may not exist yet', { error: whatsappError.message });
      // Fallback to manual deletion
      await client.query(`
        UPDATE users 
        SET whatsapp_phone = NULL, 
            whatsapp_opted_out = TRUE,
            whatsapp_optout_date = NOW()
        WHERE id = $1
      `, [userId]);
    }
    
    // Archive all user's applications
    await client.query(`
      UPDATE permit_applications
      SET 
        archived = true,
        archived_at = NOW(),
        archived_by = $1
      WHERE user_id = $1
    `, [userId]);
    
    // Soft delete user account
    const deleteQuery = `
      UPDATE users 
      SET 
        account_status = 'deleted',
        email = CONCAT('deleted_', id, '_', email),
        first_name = 'Deleted',
        last_name = 'User',
        whatsapp_phone = NULL,
        deleted_at = NOW(),
        deleted_by = $1,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
    
    await client.query(deleteQuery, [userId]);
    
    await client.query('COMMIT');
    
    // Clear session
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error destroying session after account deletion', { error: err });
      }
    });
    
    // Send confirmation email
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Confirmación de eliminación de cuenta - Permisos Digitales',
        html: `
          <h2>Cuenta eliminada</h2>
          <p>Hola ${user.first_name},</p>
          <p>Tu cuenta en Permisos Digitales ha sido eliminada exitosamente.</p>
          <p>Todos tus datos personales han sido removidos de nuestros sistemas activos.</p>
          <p>Si esto fue un error o deseas crear una nueva cuenta en el futuro, siempre serás bienvenido.</p>
          <p>Gracias por usar nuestros servicios.</p>
          <p>Atentamente,<br>Equipo de Permisos Digitales</p>
        `
      });
    } catch (emailError) {
      logger.error('Error sending deletion confirmation email', { error: emailError });
    }
    
    logger.info(`User ${userId} account deleted successfully`);
    
    return ApiResponse.success(res, {
      message: 'Tu cuenta ha sido eliminada exitosamente',
      deletedData: {
        email: user.email
      }
    });
    
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Error rolling back transaction', { error: rollbackError.message });
      }
    }
    
    logger.error('Error deleting user account', { 
      error: error.message, 
      userId: req.session?.userId,
      stack: error.stack 
    });
    
    // Return user-friendly error message
    if (error.code === '23503') {
      return ApiResponse.badRequest(res, 
        'No se puede eliminar la cuenta debido a restricciones de datos. ' +
        'Por favor contacta soporte.'
      );
    }
    
    return ApiResponse.error(res, 
      'Ocurrió un error al eliminar tu cuenta. Por favor intenta de nuevo o contacta soporte.'
    );
  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * Request data export
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.requestDataExport = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    
    if (!userId) {
      return ApiResponse.unauthorized(res, 'Usuario no autenticado.');
    }
    
    logger.info(`User ${userId} requested data export`);
    
    // Get all user data
    const userData = await userRepository.getUserDataExport(userId);
    
    if (!userData) {
      return ApiResponse.notFound(res, 'No se encontraron datos para exportar');
    }
    
    // Sanitization helper function
    const sanitizeString = (str) => {
      if (!str) return str;
      return String(str)
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .substring(0, 1000); // Limit string length
    };
    
    const sanitizePhone = (phone) => {
      if (!phone) return null;
      // Only keep digits and limit to reasonable length
      return String(phone).replace(/\D/g, '').substring(0, 15);
    };
    
    // Format and sanitize data for export
    const exportData = {
      profile: {
        email: sanitizeString(userData.email),
        firstName: sanitizeString(userData.first_name),
        lastName: sanitizeString(userData.last_name),
        whatsappPhone: sanitizePhone(userData.whatsapp_phone),
        accountType: sanitizeString(userData.account_type),
        createdAt: userData.created_at,
        emailVerified: Boolean(userData.is_email_verified)
      },
      permits: (userData.permits || []).map(permit => ({
        id: permit.id,
        folio: sanitizeString(permit.folio),
        status: sanitizeString(permit.status),
        fecha_emision: permit.fecha_emision,
        fecha_vencimiento: permit.fecha_vencimiento,
        nombre_completo: sanitizeString(permit.nombre_completo),
        curp_rfc: sanitizeString(permit.curp_rfc),
        domicilio: sanitizeString(permit.domicilio),
        marca: sanitizeString(permit.marca),
        linea: sanitizeString(permit.linea),
        color: sanitizeString(permit.color),
        numero_serie: sanitizeString(permit.numero_serie),
        numero_motor: sanitizeString(permit.numero_motor),
        ano_modelo: sanitizeString(permit.ano_modelo),
        importe: permit.importe,
        permit_url: sanitizeString(permit.permit_url),
        created_at: permit.created_at
      })),
      payments: (userData.payments || []).map(payment => ({
        id: payment.id,
        amount: payment.amount,
        currency: sanitizeString(payment.currency),
        status: sanitizeString(payment.status),
        payment_method: sanitizeString(payment.payment_method),
        payment_intent_id: sanitizeString(payment.payment_intent_id),
        created_at: payment.created_at,
        paid_at: payment.paid_at
      })),
      whatsappNotifications: (userData.whatsapp_notifications || []).map(notif => ({
        id: notif.id,
        notification_type: sanitizeString(notif.notification_type),
        phone_number: sanitizePhone(notif.phone_number),
        message_content: sanitizeString(notif.message_content),
        status: sanitizeString(notif.status),
        sent_at: notif.sent_at,
        created_at: notif.created_at
      })),
      exportDate: new Date().toISOString(),
      exportFormat: 'JSON'
    };
    
    // Set secure headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-permisos-digitales.json"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    return res.json(exportData);
    
  } catch (error) {
    logger.error('Error exporting user data', { error: error.message, userId: req.session?.userId });
    return next(error);
  }
};

/**
 * Toggle WhatsApp notifications
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.toggleWhatsAppNotifications = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { enabled, whatsappPhone } = req.body;
    
    if (!userId) {
      return ApiResponse.unauthorized(res, 'Usuario no autenticado.');
    }
    
    logger.info(`User ${userId} toggling WhatsApp notifications`, { 
      enabled,
      maskedPhone: whatsappPhone ? maskPhoneNumber(whatsappPhone) : null 
    });
    
    const client = await db.getPool().connect();
    
    try {
      await client.query('BEGIN');
      
      if (enabled) {
        // Validate and sanitize phone number
        const phoneValidation = validateAndSanitizeWhatsAppPhone(whatsappPhone);
        
        if (!phoneValidation.isValid) {
          await client.query('ROLLBACK');
          return ApiResponse.badRequest(res, phoneValidation.error);
        }
        
        const sanitizedPhone = phoneValidation.sanitized;
        
        // Check if phone is in opt-out list
        const optOutCheck = await client.query(
          'SELECT id FROM whatsapp_optout_list WHERE phone_number = $1',
          [sanitizedPhone]
        );
        
        if (optOutCheck.rows.length > 0) {
          // Remove from opt-out list
          await client.query(
            'DELETE FROM whatsapp_optout_list WHERE phone_number = $1',
            [sanitizedPhone]
          );
        }
        
        // Update user record
        await client.query(`
          UPDATE users 
          SET whatsapp_phone = $1,
              whatsapp_opted_out = FALSE,
              whatsapp_optout_date = NULL,
              whatsapp_consent_date = NOW(),
              whatsapp_consent_method = 'web',
              whatsapp_consent_ip = $2,
              updated_at = NOW()
          WHERE id = $3
        `, [sanitizedPhone, req.ip, userId]);
        
        // Log consent
        await client.query(`
          INSERT INTO whatsapp_consent_audit
          (user_id, phone_number, action, source, ip_address, user_agent, created_at)
          VALUES ($1, $2, 'consent_given', 'web', $3, $4, NOW())
        `, [userId, sanitizedPhone, req.ip, req.get('user-agent')]);
        
      } else {
        // Get current phone
        const userResult = await client.query(
          'SELECT whatsapp_phone FROM users WHERE id = $1',
          [userId]
        );
        
        const currentPhone = userResult.rows[0]?.whatsapp_phone;
        
        if (currentPhone) {
          // Add to opt-out list
          await client.query(`
            INSERT INTO whatsapp_optout_list 
            (phone_number, user_id, opt_out_source, created_at)
            VALUES ($1, $2, 'web_toggle', NOW())
            ON CONFLICT (phone_number) DO NOTHING
          `, [currentPhone, userId]);
          
          // Log consent revocation
          await client.query(`
            INSERT INTO whatsapp_consent_audit
            (user_id, phone_number, action, source, ip_address, user_agent, created_at)
            VALUES ($1, $2, 'consent_revoked', 'web', $3, $4, NOW())
          `, [userId, currentPhone, req.ip, req.get('user-agent')]);
        }
        
        // Update user record
        await client.query(`
          UPDATE users 
          SET whatsapp_phone = NULL,
              whatsapp_opted_out = TRUE,
              whatsapp_optout_date = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `, [userId]);
      }
      
      await client.query('COMMIT');
      
      return ApiResponse.success(res, {
        message: enabled ? 
          'Notificaciones de WhatsApp activadas exitosamente' : 
          'Notificaciones de WhatsApp desactivadas exitosamente',
        whatsappEnabled: enabled
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('Error toggling WhatsApp notifications', { error: error.message, userId: req.session?.userId });
    return next(error);
  }
};
