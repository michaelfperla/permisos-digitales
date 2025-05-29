const crypto = require('crypto');
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');
const securityService = require('../services/security.service');
const authSecurity = require('../services/auth-security.service');
const emailService = require('../services/email.service');
const config = require('../config');
const { hashPassword, verifyPassword } = require('../utils/password-utils');
const { handleControllerError, createError } = require('../utils/error-helpers');
const ApiResponse = require('../utils/api-response');
const ProductionDebugger = require('../utils/production-debug');

exports.register = async (req, res, next) => {
  const { email, password, first_name, last_name } = req.body;

  ProductionDebugger.logRequestDetails(req, 'registration');
  ProductionDebugger.logRegistrationAttempt(req, { email, first_name, last_name, password });

  if (!email || !password || !first_name || !last_name) {
    logger.warn(`Registration attempt failed: Missing required fields - ${email}`);
    ProductionDebugger.logError(new Error('Missing required fields'), 'registration_validation', req);
    return ApiResponse.badRequest(res, 'Faltan campos requeridos (correo, contraseña, nombre, apellido).');
  }

  try {
    logger.debug(`Registration attempt for email: ${email}`);

    const isLimited = await securityService.isRateLimitExceeded(req.ip, 'registration', 5, 60);
    if (isLimited) {
      await securityService.logActivity(null, 'registration_rate_limited', req.ip, req.headers['user-agent'], { email });
      return ApiResponse.tooManyRequests(res, 'Demasiados intentos de registro. Por favor, inténtalo de nuevo más tarde.');
    }

    const checkUserQuery = 'SELECT id FROM users WHERE email = $1';
    ProductionDebugger.logDatabaseOperation('user_check', true, { email, query: 'SELECT id FROM users WHERE email = $1' });
    const { rows: existingUsers } = await db.query(checkUserQuery, [email]);
    ProductionDebugger.logDatabaseOperation('user_check_result', true, { email, existingUsersCount: existingUsers.length });

    if (existingUsers.length > 0) {
      logger.warn(`Registration failed: Email already exists - ${email}`);
      ProductionDebugger.logDatabaseOperation('registration_failed', false, { email, reason: 'email_exists' });
      await securityService.logActivity(null, 'registration_failed', req.ip, req.headers['user-agent'], { email, reason: 'email_exists' });
      return ApiResponse.conflict(res, 'Ya existe un usuario con este correo electrónico.');
    }

    logger.debug(`Hashing password for ${email}`);
    const passwordHash = await hashPassword(password);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const insertUserQuery = `
            INSERT INTO users (
              email, password_hash, first_name, last_name, account_type, role, is_admin_portal, account_created_at,
              is_email_verified, email_verification_token, email_verification_expires
            )
            VALUES ($1, $2, $3, $4, 'client', 'client', false, CURRENT_TIMESTAMP, false, $5, $6)
            RETURNING id, email, created_at;
        `;
    const insertParams = [
      email, passwordHash, first_name, last_name,
      verificationToken, verificationExpires
    ];

    const { rows: insertedUserRows } = await db.query(insertUserQuery, insertParams);
    if (insertedUserRows.length === 0) {
      logger.error('User registration failed during database insert unexpectedly.');
      throw new Error('User registration failed during insert.');
    }
    const newUser = insertedUserRows[0];
    logger.info(`User registered successfully: ${newUser.email} (ID: ${newUser.id})`);

    await securityService.logActivity(newUser.id, 'registration_successful', req.ip, req.headers['user-agent'], { email: newUser.email });

    // Send verification email (non-blocking)
    try {
      const verificationUrl = `${config.frontendUrl}/verify-email`;
      const emailSent = await emailService.sendEmailVerificationEmail(
        email,
        verificationToken,
        verificationUrl
      );

      if (emailSent) {
        logger.info(`Verification email sent to ${email}`);
      } else {
        logger.warn(`Failed to send verification email to ${email}`);
      }
    } catch (emailError) {
      logger.error(`Error sending verification email to ${email}:`, emailError);
    }

    // Auto-login after successful registration
    ProductionDebugger.logSessionAction(req, 'pre_regenerate', { userId: newUser.id, email: newUser.email });
    req.session.regenerate(err => {
      if (err) {
        logger.error('Error regenerating session after registration:', err);
        ProductionDebugger.logError(err, 'session_regenerate_registration', req);
        return handleControllerError(err, 'register (session regenerate)', req, res, next);
      }

      ProductionDebugger.logSessionAction(req, 'post_regenerate', { userId: newUser.id, email: newUser.email, newSessionId: req.session.id });

      req.session.userId = newUser.id;
      req.session.userEmail = newUser.email;
      req.session.userName = first_name;
      req.session.userLastName = last_name;
      req.session.accountType = 'client';
      req.session.isAdminPortal = false;

      ProductionDebugger.logSessionAction(req, 'session_data_set', {
        userId: newUser.id,
        email: newUser.email,
        sessionId: req.session.id,
        accountType: 'client'
      });

      logger.info(`👤 AUTO-LOGIN AFTER REGISTRATION: ${newUser.email} (ID: ${newUser.id}), SessionID: ${req.session.id}`);
      ApiResponse.success(res, {
        user: {
          id: newUser.id,
          email: newUser.email,
          first_name: first_name,
          last_name: last_name,
          accountType: 'client',
          is_admin_portal: false,
          created_at: newUser.created_at
        }
      }, 201, 'User registered successfully!');
    });
  } catch (error) {
    handleControllerError(error, 'register', req, res, next);
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email) { return ApiResponse.badRequest(res, 'El correo electrónico es requerido'); }
  if (!password) { return ApiResponse.badRequest(res, 'La contraseña es requerida'); }

  try {
    logger.debug(`[Login Controller] Login attempt started for email: ${email}`);

    logger.debug(`[Login Controller] Checking account lockout status for email: ${email}`);
    const lockStatus = await authSecurity.checkLockStatus(email);
    logger.debug(`[Login Controller] Lock status for ${email}: ${JSON.stringify(lockStatus)}`);

    if (lockStatus.locked) {
      logger.warn(`[Login Controller] Login attempt for locked account: ${email}. Remaining lockout time: ${lockStatus.remainingSeconds} seconds`);
      await securityService.logActivity( null, 'login_account_locked', req.ip, req.headers['user-agent'], { email, remainingSeconds: lockStatus.remainingSeconds });
      return ApiResponse.tooManyRequests(res, `Cuenta bloqueada temporalmente. Intente nuevamente en ${lockStatus.remainingSeconds} segundos.`, { locked: true, remainingSeconds: lockStatus.remainingSeconds });
    }

    logger.debug(`[Login Controller] Checking rate limiting for IP: ${req.ip}`);
    const isLimited = await securityService.isRateLimitExceeded( req.ip, 'failed_login', 5, 15 );
    logger.debug(`[Login Controller] Rate limit check result for IP ${req.ip}: ${isLimited ? 'limited' : 'not limited'}`);

    if (isLimited) {
      logger.warn(`[Login Controller] Login rate limit exceeded for IP: ${req.ip}`);
      await securityService.logActivity( null, 'login_rate_limited', req.ip, req.headers['user-agent'], { email });
      return ApiResponse.tooManyRequests(res, 'Demasiados intentos de inicio de sesión fallidos. Por favor, inténtalo de nuevo más tarde.');
    }

    const isAdminPortal = req.get('X-Portal-Type') === 'admin';
    logger.info(`[Login Controller] Login attempt from ${isAdminPortal ? 'ADMIN PORTAL' : 'CLIENT PORTAL'} for user: ${email}`);

    logger.debug(`[Login Controller] Retrieving user data for email: ${email}`);
    const findUserQuery = `
      SELECT id, email, password_hash, first_name, last_name, account_type, role, is_admin_portal,
             is_email_verified, email_verification_token, email_verification_expires
      FROM users
      WHERE email = $1
    `;
    logger.debug(`[Login Controller] Executing SQL query: ${findUserQuery.replace(/\s+/g, ' ')}`);

    let queryResult;
    try {
      queryResult = await db.query(findUserQuery, [email]);
      logger.debug(`[Login Controller] Database query completed for ${email}, rows returned: ${queryResult.rows.length}`);
    } catch (dbError) {
      logger.error(`[Login Controller] Database error during user lookup for ${email}: ${dbError.message}`, {
        error: dbError,
        stack: dbError.stack,
        query: findUserQuery
      });
      throw dbError;
    }

    const { rows } = queryResult;
    if (rows.length === 0) {
      logger.warn(`[Login Controller] Login attempt failed: User not found for email ${email}`);
      await authSecurity.recordFailedAttempt(email);
      await securityService.logActivity( null, 'failed_login', req.ip, req.headers['user-agent'], { email, reason: 'user_not_found' });
      return ApiResponse.unauthorized(res, 'Invalid email or password.');
    }

    const user = rows[0];
    logger.debug(`[Login Controller] User found for email ${email}: ID=${user.id}, is_email_verified=${user.is_email_verified}, role=${user.role}`);
    logger.debug(`[Login Controller] Password hash exists: ${!!user.password_hash}`);

    logger.debug(`[Login Controller] Checking if email is verified for user ${email}`);
    if (user.is_email_verified === false) {
      logger.warn(`[Login Controller] Login attempt failed: Email ${email} is not verified`);
      await securityService.logActivity(user.id, 'login_unverified_email', req.ip, req.headers['user-agent'], { email });

      // Regenerate verification token if expired
      const now = new Date();
      if (!user.email_verification_expires || now > user.email_verification_expires) {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await db.query(
          'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
          [verificationToken, verificationExpires, user.id]
        );

        try {
          const verificationUrl = `${config.frontendUrl}/verify-email`;
          await emailService.sendEmailVerificationEmail(
            email,
            verificationToken,
            verificationUrl
          );
          logger.info(`New verification email sent to ${email}`);
        } catch (emailError) {
          logger.error(`Error sending new verification email to ${email}:`, emailError);
        }
      }

      return ApiResponse.forbidden(res, 'Necesitas verificar tu correo electrónico antes de iniciar sesión. Hemos enviado un nuevo enlace de verificación a tu correo. El enlace estará activo durante 24 horas.');
    }

    // Validate portal access
    if (isAdminPortal && (user.account_type !== 'admin' || user.is_admin_portal !== true)) {
      logger.warn(`Login attempt failed: Account ${email} attempted admin portal access without proper permissions`);
      await securityService.logActivity( user.id, 'unauthorized_portal_access', req.ip, req.headers['user-agent'], { email, attempted_portal: 'admin' });
      return ApiResponse.forbidden(res, 'Access Denied: Administrator privileges required for this portal.');
    }
    if (!isAdminPortal && user.account_type === 'admin') {
      logger.warn(`Login attempt failed: Admin account ${email} attempted client portal access`);
      await securityService.logActivity( user.id, 'unauthorized_portal_access', req.ip, req.headers['user-agent'], { email, attempted_portal: 'client' });
      return ApiResponse.forbidden(res, 'Access Denied: Admin accounts must use the admin portal.');
    }

    // Verify password
    logger.debug(`[Login Controller] About to verify password for user ${email}`);
    let isMatch = false;
    try {
      logger.debug(`[Login Controller] Calling verifyPassword function for user ${email}`);
      isMatch = await verifyPassword(password, user.password_hash);
      logger.debug(`[Login Controller] Password comparison result for ${email}: ${isMatch}`);
    } catch (verificationError) {
      logger.error(`[Login Controller] Error comparing passwords for ${email}: ${verificationError.message}`, {
        error: verificationError,
        stack: verificationError.stack,
        userId: user.id
      });
      await authSecurity.recordFailedAttempt(email);
      await securityService.logActivity(user.id, 'failed_login', req.ip, req.headers['user-agent'], { email, reason: 'password_verify_error' });
      // Return generic unauthorized for security, don't expose internal error details
      return ApiResponse.unauthorized(res, 'Authentication error occurred.');
    }

    if (!isMatch) {
      logger.warn(`[Login Controller] Login attempt failed: Invalid password for email ${email}`);
      await authSecurity.recordFailedAttempt(email);
      await securityService.logActivity( user.id, 'failed_login', req.ip, req.headers['user-agent'], { email, reason: 'invalid_password' });
      return ApiResponse.unauthorized(res, 'Invalid email or password.');
    }

    logger.debug(`[Login Controller] Password verified successfully for user ${email}`);

    // Reset failed attempts on successful login
    logger.debug(`[Login Controller] Resetting failed login attempts for user ${email}`);
    await authSecurity.resetAttempts(email);
    logger.debug(`[Login Controller] Failed login attempts reset completed for user ${email}`);

    // Password matches - Regenerate session and store user data
    logger.debug(`[Login Controller] About to regenerate session for user ${email}`);
    req.session.regenerate(err => {
      if (err) {
        logger.error(`[Login Controller] Error regenerating session during login for ${email}:`, {
          error: err,
          stack: err.stack,
          userId: user.id,
          sessionId: req.session?.id
        });
        // Destroy potentially partially populated session data if regenerate fails
        for (let key in req.session) { if (key !== 'cookie') delete req.session[key]; }
        return next(createError('Session initialization failed during login.', 500)); // Use createError helper
      }

      logger.debug(`[Login Controller] Session regenerated successfully for user ${email}, new session ID: ${req.session.id}`);

      // Set session data *after* successful regeneration
      logger.debug(`[Login Controller] Setting session data for user ${email}`);
      req.session.userId = user.id;
      logger.debug(`[Login Controller] Set req.session.userId = ${user.id}`);

      req.session.userEmail = user.email;
      logger.debug(`[Login Controller] Set req.session.userEmail = ${user.email}`);

      req.session.userName = user.first_name || ''; // Store consistently
      logger.debug(`[Login Controller] Set req.session.userName = ${user.first_name || ''}`);

      req.session.userLastName = user.last_name || ''; // Store consistently
      logger.debug(`[Login Controller] Set req.session.userLastName = ${user.last_name || ''}`);

      req.session.accountType = user.account_type || 'client';
      logger.debug(`[Login Controller] Set req.session.accountType = ${user.account_type || 'client'}`);

      req.session.isAdminPortal = isAdminPortal && user.account_type === 'admin'; // Ensure boolean
      logger.debug(`[Login Controller] Set req.session.isAdminPortal = ${isAdminPortal && user.account_type === 'admin'}`);

      logger.debug(`[Login Controller] About to save session with ID: ${req.session.id}`);

      // Explicitly save the session to ensure it's persisted
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error(`[Login Controller] Error saving session for user ${email}:`, {
            error: saveErr,
            stack: saveErr.stack,
            sessionId: req.session.id
          });
        } else {
          logger.debug(`[Login Controller] Session saved successfully for user ${email}, session ID: ${req.session.id}`);
        }
      });

      logger.info(`[Login Controller] ${isAdminPortal ? '🔐 ADMIN LOGIN SUCCESS' : '👤 USER LOGIN SUCCESS'}: ${user.email} (ID: ${user.id}) SessionID: ${req.session.id}`);
      if (isAdminPortal) {
        logger.info(`[Login Controller] Admin login details: account_type=${user.account_type}, is_admin_portal=${user.is_admin_portal}`);
      }

      // Log activity after session is confirmed stable
      securityService.logActivity(
        user.id,
        isAdminPortal ? 'admin_login' : 'client_login',
        req.ip,
        req.headers['user-agent'],
        { email: user.email, portal: isAdminPortal ? 'admin' : 'client' }
      ).catch(err => logger.error('Error logging login activity:', err));

      // Prepare user data for response (don't send hash)
      const isAdmin = user.account_type === 'admin';
      const hasAdminPortalAccess = isAdminPortal && isAdmin;
      logger.info(`Access details for response: isAdmin=${isAdmin}, hasAdminPortalAccess=${hasAdminPortalAccess}`);

      ApiResponse.success(res, {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          accountType: user.account_type, // camelCase
          is_admin_portal: user.is_admin_portal, // snake_case (or match DB consistently)
          accessDetails: { // Consistent nested structure
            isAdmin,
            hasAdminPortalAccess,
            sessionId: req.session.id
          }
        }
      }, 200, 'Login successful!'); // Consistent message
    });
  } catch (error) {
    // Catch errors from DB queries, security checks etc. before regenerate
    logger.error(`[Login Controller] Caught error in login controller for ${email}: ${error.message}`, {
      error: error,
      stack: error.stack,
      email: email,
      requestId: req.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    handleControllerError(error, 'login', req, res, next);
  }
};

// --- Logout Function ---
exports.logout = (req, res, next) => {
  const userId = req.session.userId;
  const userEmail = req.session.userEmail; // Log email for better context
  logger.info(`Logout requested for user: ${userEmail || 'N/A'} (ID: ${userId || 'N/A'})`);

  if (userId) {
    securityService.logActivity(userId, 'logout', req.ip, req.headers['user-agent'], { email: userEmail })
      .catch(err => logger.error('Error logging logout:', err));
  }

  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      logger.error(`Session destruction error for user ID ${userId || 'N/A'}:`, err);
      // Avoid sending response after error passed to next
      return next(createError('Failed to log out properly.', 500));
    }
    logger.info(`User logged out successfully: ID ${userId || 'N/A'}`);
    // Ensure cookie is cleared (adjust 'connect.sid' if using different name)
    res.clearCookie('connect.sid', { path: '/' }); // Add path etc. if needed
    ApiResponse.success(res, null, 200, 'Logout successful.');
  });
};

// --- Status Function ---
exports.status = (req, res, next) => { // Added next for potential errors
  try {
    if (req.session && req.session.userId) {
      logger.info(`Status check for authenticated user: ${req.session.userEmail} (ID: ${req.session.userId})`);
      // Consistently determine admin status based on session data
      const isAdmin = req.session.accountType === 'admin';
      const hasAdminPortalAccess = req.session.isAdminPortal === true && isAdmin;

      ApiResponse.success(res, {
        isLoggedIn: true,
        user: {
          id: req.session.userId,
          email: req.session.userEmail,
          first_name: req.session.userName, // Use consistent session variable names
          last_name: req.session.userLastName || null,
          accountType: req.session.accountType,
          is_admin_portal: req.session.isAdminPortal,
          accessDetails: {
            isAdmin,
            hasAdminPortalAccess,
            sessionId: req.session.id
          }
        }
      });
    } else {
      logger.info('Status check: No active session found');
      ApiResponse.success(res, { isLoggedIn: false });
    }
  } catch (error) {
    // Catch any unexpected errors during status check
    logger.error(`Error during status check: ${error.message}`);
    handleControllerError(error, 'status', req, res, next);
  }
};

// --- Resend Verification Email Function ---
exports.resendVerificationEmail = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return ApiResponse.badRequest(res, 'Correo electrónico no proporcionado.');
  }

  try {
    logger.debug(`Resend verification email requested for: ${email}`);

    // Check for rate limiting
    const isLimited = await securityService.isRateLimitExceeded(
      req.ip,
      'resend_verification_email',
      3, // Limit to 3 requests
      60  // per hour
    );

    if (isLimited) {
      await securityService.logActivity(
        null,
        'resend_verification_rate_limited',
        req.ip,
        req.headers['user-agent'],
        { email }
      );
      return ApiResponse.tooManyRequests(res, 'Demasiados intentos. Por favor intenta nuevamente más tarde.');
    }

    // Find user by email
    const findUserQuery = `
      SELECT id, email, is_email_verified, email_verification_token, email_verification_expires
      FROM users
      WHERE email = $1
    `;
    const { rows } = await db.query(findUserQuery, [email]);

    // If no user found with this email
    if (rows.length === 0) {
      // For security reasons, don't reveal that the email doesn't exist
      logger.warn(`Resend verification email requested for non-existent email: ${email}`);
      return ApiResponse.success(res, null, 200, 'Si tu correo electrónico está registrado, recibirás un enlace de verificación.');
    }

    const user = rows[0];

    // If email is already verified
    if (user.is_email_verified) {
      logger.info(`Resend verification email requested for already verified email: ${email}`);
      return ApiResponse.success(res, null, 200, 'Tu correo electrónico ya ha sido verificado.');
    }

    // Generate new token and expiry
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Update user with new token and expiry
    const updateUserQuery = `
      UPDATE users
      SET email_verification_token = $1,
          email_verification_expires = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;
    await db.query(updateUserQuery, [verificationToken, verificationExpires, user.id]);

    // Send verification email
    const verificationUrl = `${config.frontendUrl}/verify-email`;
    const emailSent = await emailService.sendEmailVerificationEmail(
      email,
      verificationToken,
      verificationUrl
    );

    if (emailSent) {
      logger.info(`Verification email resent to ${email}`);
    } else {
      logger.warn(`Failed to resend verification email to ${email}`);
      return ApiResponse.error(res, 'Error al enviar el correo de verificación. Por favor intenta nuevamente más tarde.', 500);
    }

    // Log the activity
    await securityService.logActivity(
      user.id,
      'verification_email_resent',
      req.ip,
      req.headers['user-agent'],
      { email }
    );

    return ApiResponse.success(res, null, 200, 'Hemos enviado un nuevo enlace de verificación a tu correo electrónico. El correo puede tardar hasta 5 minutos en llegar. El enlace estará activo durante 24 horas.');
  } catch (error) {
    handleControllerError(error, 'resendVerificationEmail', req, res, next);
  }
};

// --- Email Verification Function ---
exports.verifyEmail = async (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return ApiResponse.badRequest(res, 'Token de verificación no proporcionado.');
  }

  try {
    logger.debug(`Email verification attempt with token: ${token}`);

    // Find user with this verification token
    const findUserQuery = `
      SELECT id, email, is_email_verified, email_verification_expires
      FROM users
      WHERE email_verification_token = $1
    `;
    const { rows } = await db.query(findUserQuery, [token]);

    // If no user found with this token
    if (rows.length === 0) {
      logger.warn(`Email verification failed: Invalid token ${token}`);
      return ApiResponse.badRequest(res, 'El enlace de verificación es inválido o ha expirado.');
    }

    const user = rows[0];

    // If email is already verified
    if (user.is_email_verified) {
      logger.info(`Email already verified for user ${user.email}`);
      return ApiResponse.success(res, null, 200, 'Tu correo electrónico ya ha sido verificado.');
    }

    // Check if token is expired
    const now = new Date();
    if (!user.email_verification_expires || now > user.email_verification_expires) {
      logger.warn(`Email verification failed: Expired token for user ${user.email}`);
      return ApiResponse.badRequest(res, 'El enlace de verificación ha expirado. Los enlaces son válidos por 24 horas. Por favor solicita un nuevo enlace de verificación.');
    }

    // Update user to mark email as verified and clear token
    const updateUserQuery = `
      UPDATE users
      SET is_email_verified = true,
          email_verification_token = NULL,
          email_verification_expires = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await db.query(updateUserQuery, [user.id]);

    // Log the successful verification
    await securityService.logActivity(
      user.id,
      'email_verified',
      req.ip,
      req.headers['user-agent'],
      { email: user.email }
    );

    logger.info(`Email verified successfully for user ${user.email}`);
    return ApiResponse.success(res, null, 200, '¡Tu correo electrónico ha sido verificado exitosamente! Ahora puedes iniciar sesión y usar todos los servicios.');
  } catch (error) {
    handleControllerError(error, 'verifyEmail', req, res, next);
  }
};

// --- Change Password Function ---
exports.changePassword = async (req, res, next) => {
  const userId = req.session.userId;

  // Check if user is authenticated
  if (!userId) {
    logger.warn('Change password attempt without authentication');
    return ApiResponse.unauthorized(res, 'You must be logged in to change your password.');
  }

  const { currentPassword, newPassword } = req.body;

  try {
    logger.info(`Password change attempt for user ID: ${userId}`);

    // Call auth service to change password
    const result = await authSecurity.changePassword(userId, currentPassword, newPassword);

    if (!result.success) {
      logger.warn(`Password change failed for user ID: ${userId}: ${result.message}`);

      // Determine appropriate status code based on the error
      if (result.reason === 'INVALID_CURRENT_PASSWORD') {
        return ApiResponse.unauthorized(res, result.message || 'Current password is incorrect.');
      } else {
        return ApiResponse.badRequest(res, result.message || 'Failed to change password.');
      }
    }

    // Log the successful password change
    await securityService.logActivity(
      userId,
      'password_changed',
      req.ip,
      req.headers['user-agent'],
      { userId }
    );

    logger.info(`Password changed successfully for user ID: ${userId}`);
    return ApiResponse.success(res, null, 200, 'Password changed successfully.');
  } catch (error) {
    handleControllerError(error, 'changePassword', req, res, next);
  }
};