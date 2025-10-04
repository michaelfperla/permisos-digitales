const crypto = require('crypto');
const db = require('../db');
const { logger } = require('../utils/logger');
const { utils: sanitizerUtils } = require('../utils/log-sanitizer');
const securityService = require('../services/security.service');
const authSecurity = require('../services/auth-security.service');
const emailService = require('../services/email.service');
const { getConfig } = require('../utils/config');
const config = getConfig();
const { hashPassword, verifyPassword } = require('../utils/password-utils');
const { userRepository } = require('../repositories');
const { handleControllerError, createError } = require('../utils/error-helpers');
const ApiResponse = require('../utils/api-response');
const ProductionDebugger = require('../utils/production-debug');
const metricsCollector = require('../monitoring/metrics-collector');
const { normalizePhoneForStorage, getPhoneVariants } = require('../utils/phone-utils');

// Will be injected by dependency container
let auditService = null;
const setAuditService = (service) => {
  auditService = service;
};
exports.setAuditService = setAuditService;

exports.register = async (req, res, next) => {
  const { email, password, first_name, last_name, whatsapp_phone } = req.body;

  ProductionDebugger.logRequestDetails(req, 'registration');
  ProductionDebugger.logRegistrationAttempt(req, { email, first_name, last_name, password: '[REDACTED]' });

  if (!email || !password || !first_name || !last_name) {
    logger.warn('Registration attempt failed: Missing required fields', { 
      email: sanitizerUtils.sanitizeUser({ email }).email,
      hasPassword: !!password,
      hasFirstName: !!first_name,
      hasLastName: !!last_name
    });
    ProductionDebugger.logError(new Error('Missing required fields'), 'registration_validation', req);
    return ApiResponse.badRequest(res, 'Faltan campos requeridos (correo, contraseña, nombre, apellido).');
  }

  try {
    logger.debug('Registration attempt started', { 
      email: sanitizerUtils.sanitizeUser({ email }).email 
    });

    const isLimited = await securityService.isRateLimitExceeded(req.ip, 'registration', 5, 60);
    if (isLimited) {
      await securityService.logActivity(null, 'registration_rate_limited', req.ip, req.headers['user-agent'], { email });
      return ApiResponse.tooManyRequests(res, 'Demasiados intentos de registro. Por favor, inténtalo de nuevo más tarde.');
    }

    const checkUserQuery = 'SELECT id FROM users WHERE account_email = $1';
    ProductionDebugger.logDatabaseOperation('user_check', true, { email, query: 'SELECT id FROM users WHERE account_email = $1' });
    const { rows: existingUsers } = await db.query(checkUserQuery, [email]);
    ProductionDebugger.logDatabaseOperation('user_check_result', true, { email, existingUsersCount: existingUsers.length });

    if (existingUsers.length > 0) {
      logger.warn('Registration failed: Email already exists', { 
        email: sanitizerUtils.sanitizeUser({ email }).email,
        reason: 'email_exists'
      });
      ProductionDebugger.logDatabaseOperation('registration_failed', false, { email, reason: 'email_exists' });
      await securityService.logActivity(null, 'registration_failed', req.ip, req.headers['user-agent'], { email, reason: 'email_exists' });
      return ApiResponse.conflict(res, 'Ya existe un usuario con este correo electrónico.');
    }

    // Check if phone number already exists (including WhatsApp accounts)
    if (whatsapp_phone) {
      const phoneVariants = getPhoneVariants(whatsapp_phone);
      const checkPhoneQuery = 'SELECT id, account_email, source FROM users WHERE phone = ANY($1) OR whatsapp_phone = ANY($1)';
      const { rows: existingPhoneUsers } = await db.query(checkPhoneQuery, [phoneVariants]);
      
      if (existingPhoneUsers.length > 0) {
        const existingUser = existingPhoneUsers[0];
        logger.warn('Registration failed: Phone already exists', { 
          phone: whatsapp_phone,
          existingSource: existingUser.source,
          reason: 'phone_exists'
        });
        
        if (existingUser.source === 'whatsapp') {
          // WhatsApp account exists - upgrade to full account
          logger.info('Upgrading WhatsApp account to full account', { 
            phone: whatsapp_phone,
            existingUserId: existingUser.id,
            newEmail: email
          });
          
          // Check if the WhatsApp user already has an account_email
          if (existingUser.account_email) {
            return ApiResponse.conflict(res, 
              'Este número ya tiene una cuenta web. ' +
              'Inicia sesión con tu teléfono o email, o usa "Olvidé mi contraseña" si no recuerdas tu contraseña.'
            );
          }
          
          // Check if email is already in use by another account
          const emailCheckQuery = 'SELECT id, first_name, last_name FROM users WHERE account_email = $1 AND id != $2';
          const { rows: emailConflicts } = await db.query(emailCheckQuery, [email, existingUser.id]);

          if (emailConflicts.length > 0) {
            logger.warn('Email already in use by another account during WhatsApp upgrade', {
              email: sanitizerUtils.sanitizeUser({ email }).email,
              whatsappUserId: existingUser.id,
              conflictingUserId: emailConflicts[0].id,
              conflictingUserName: `${emailConflicts[0].first_name} ${emailConflicts[0].last_name}`
            });
            
            return ApiResponse.conflict(res, 
              'Este correo ya está registrado con otra cuenta. ' +
              'Por favor usa un correo diferente o inicia sesión con la cuenta existente usando ' +
              '"Olvidé mi contraseña" si no recuerdas tu contraseña.'
            );
          }

          // Upgrade the WhatsApp account with email and password
          try {
            const passwordHash = await hashPassword(password);
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
            
            const upgradeQuery = `
              UPDATE users SET 
                account_email = $1,
                password_hash = $2,
                first_name = $3,
                last_name = $4,
                is_email_verified = false,
                email_verification_token = $5,
                email_verification_expires = $6,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $7
              RETURNING id, account_email as email, created_at
            `;
            
            const { rows: updatedUserRows } = await db.query(upgradeQuery, [
              email, passwordHash, first_name, last_name, 
              verificationToken, verificationExpires, existingUser.id
            ]);
            
            if (updatedUserRows.length === 0) {
              logger.error('Failed to upgrade WhatsApp account', { existingUserId: existingUser.id });
              throw new Error('Failed to upgrade WhatsApp account');
            }
            
            const upgradedUser = updatedUserRows[0];
            logger.info('WhatsApp account upgraded successfully', {
              userId: upgradedUser.id,
              email: sanitizerUtils.sanitizeUser({ email: upgradedUser.email }).email
            });

            await securityService.logActivity(upgradedUser.id, 'whatsapp_account_upgraded', req.ip, req.headers['user-agent'], { 
              email: upgradedUser.email,
              phone: whatsapp_phone
            });

            // Send verification email (non-blocking)
            try {
              const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
              const emailSent = await emailService.sendEmailVerificationEmail(
                email,
                verificationUrl
              );

              if (emailSent) {
                logger.info('Verification email sent for upgraded account', {
                  email: sanitizerUtils.sanitizeUser({ email }).email
                });
              } else {
                logger.warn('Failed to send verification email for upgraded account', {
                  email: sanitizerUtils.sanitizeUser({ email }).email
                });
              }
            } catch (emailError) {
              logger.error('Error sending verification email for upgraded account', {
                email: sanitizerUtils.sanitizeUser({ email }).email,
                error: emailError.message
              });
            }

            // Auto-login the upgraded user
            ProductionDebugger.logSessionAction(req, 'pre_regenerate_upgrade', { userId: upgradedUser.id, email: upgradedUser.email });
            req.session.regenerate(err => {
              if (err) {
                logger.error('Error regenerating session after account upgrade:', err);
                ProductionDebugger.logError(err, 'session_regenerate_upgrade', req);
                req.session.destroy(destroyErr => {
                  if (destroyErr) {
                    logger.error('Failed to destroy session after upgrade regeneration error:', destroyErr);
                  }
                });
                return handleControllerError(err, 'register (account upgrade)', req, res, next);
              }

              ProductionDebugger.logSessionAction(req, 'post_regenerate_upgrade', { userId: upgradedUser.id, email: upgradedUser.email, newSessionId: req.session.id });

              req.session.userId = upgradedUser.id;
              req.session.userEmail = upgradedUser.email;
              req.session.userName = first_name;
              req.session.userLastName = last_name;
              req.session.accountType = 'client';
              req.session.isAdminPortal = false;
              req.session.createdAt = new Date();
              req.session.lastActivity = new Date();
              req.session.lastRegeneration = new Date();
              req.session.regenerationCount = 1;

              ProductionDebugger.logSessionAction(req, 'session_data_set_upgrade', {
                userId: upgradedUser.id,
                email: upgradedUser.email,
                sessionId: req.session.id,
                accountType: 'client'
              });

              logger.info('Auto-login after account upgrade successful', {
                userId: upgradedUser.id,
                email: sanitizerUtils.sanitizeUser({ email: upgradedUser.email }).email,
                sessionId: sanitizerUtils.sanitizeSession({ id: req.session.id }).id
              });
              
              // Track user registration metric
              metricsCollector.recordUserRegistration();
              
              ApiResponse.success(res, {
                message: 'Cuenta de WhatsApp actualizada exitosamente. Tu cuenta ya tiene acceso completo al portal web.',
                user: {
                  id: upgradedUser.id,
                  email: upgradedUser.email,
                  firstName: first_name,
                  lastName: last_name,
                  isEmailVerified: false,
                  isUpgraded: true
                }
              });
            });
            
            return; // Exit the registration function
            
          } catch (upgradeError) {
            logger.error('Error upgrading WhatsApp account', {
              error: upgradeError.message,
              existingUserId: existingUser.id,
              email: sanitizerUtils.sanitizeUser({ email }).email
            });
            return ApiResponse.internalServerError(res, 'Error al actualizar tu cuenta. Por favor, inténtalo de nuevo.');
          }
          
        } else {
          return ApiResponse.conflict(res, 'Ya existe un usuario con este número de teléfono.');
        }
      }
    }

    logger.debug('Hashing password for registration', { 
      email: sanitizerUtils.sanitizeUser({ email }).email 
    });
    const passwordHash = await hashPassword(password);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Normalize phone for consistent storage
    const normalizedPhone = whatsapp_phone ? normalizePhoneForStorage(whatsapp_phone) : null;
    
    const insertUserQuery = `
            INSERT INTO users (
              email, password_hash, first_name, last_name, whatsapp_phone, phone, account_type, role, is_admin_portal, account_created_at,
              is_email_verified, email_verification_token, email_verification_expires
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'client', 'client', false, CURRENT_TIMESTAMP, false, $7, $8)
            RETURNING id, email, created_at;
        `;
    const insertParams = [
      email, passwordHash, first_name, last_name, normalizedPhone, normalizedPhone,
      verificationToken, verificationExpires
    ];

    const { rows: insertedUserRows } = await db.query(insertUserQuery, insertParams);
    if (insertedUserRows.length === 0) {
      logger.error('User registration failed during database insert unexpectedly.');
      throw new Error('User registration failed during insert.');
    }
    const newUser = insertedUserRows[0];
    logger.info('User registered successfully', {
      userId: newUser.id,
      email: sanitizerUtils.sanitizeUser({ email: newUser.email }).email,
      createdAt: newUser.created_at
    });

    await securityService.logActivity(newUser.id, 'registration_successful', req.ip, req.headers['user-agent'], { email: newUser.email });

    // Send verification email (non-blocking)
    try {
      const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
      const emailSent = await emailService.sendEmailVerificationEmail(
        email,
        verificationUrl
      );

      if (emailSent) {
        logger.info('Verification email sent successfully', {
          email: sanitizerUtils.sanitizeUser({ email }).email
        });
      } else {
        logger.warn('Failed to send verification email', {
          email: sanitizerUtils.sanitizeUser({ email }).email
        });
      }
    } catch (emailError) {
      logger.error('Error sending verification email', {
        email: sanitizerUtils.sanitizeUser({ email }).email,
        error: emailError.message
      });
    }

    // Auto-login after successful registration
    ProductionDebugger.logSessionAction(req, 'pre_regenerate', { userId: newUser.id, email: newUser.email });
    req.session.regenerate(err => {
      if (err) {
        logger.error('Error regenerating session after registration:', err);
        ProductionDebugger.logError(err, 'session_regenerate_registration', req);
        // Properly destroy the session on regeneration failure
        req.session.destroy(destroyErr => {
          if (destroyErr) {
            logger.error('Failed to destroy session after registration regeneration error:', destroyErr);
          }
        });
        return handleControllerError(err, 'register (session regenerate)', req, res, next);
      }

      ProductionDebugger.logSessionAction(req, 'post_regenerate', { userId: newUser.id, email: newUser.email, newSessionId: req.session.id });

      req.session.userId = newUser.id;
      req.session.userEmail = newUser.email;
      req.session.userName = first_name;
      req.session.userLastName = last_name;
      req.session.accountType = 'client';
      req.session.isAdminPortal = false;
      req.session.createdAt = new Date();
      req.session.lastActivity = new Date();
      req.session.lastRegeneration = new Date();
      req.session.regenerationCount = 1;

      ProductionDebugger.logSessionAction(req, 'session_data_set', {
        userId: newUser.id,
        email: newUser.email,
        sessionId: req.session.id,
        accountType: 'client'
      });

      logger.info('Auto-login after registration successful', {
        userId: newUser.id,
        email: sanitizerUtils.sanitizeUser({ email: newUser.email }).email,
        sessionId: sanitizerUtils.sanitizeSession({ id: req.session.id }).id
      });
      
      // Track user registration metric
      metricsCollector.recordUserRegistration();
      
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
      }, 201, '¡Usuario registrado exitosamente!');
    });
  } catch (error) {
    handleControllerError(error, 'register', req, res, next);
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email) { return ApiResponse.badRequest(res, 'El correo electrónico o teléfono es requerido'); }
  if (!password) { return ApiResponse.badRequest(res, 'La contraseña es requerida'); }

  try {
    // Determine if input is email or phone
    const isEmail = email.includes('@');
    const identifier = isEmail ? email : email.replace(/\D/g, ''); // Clean phone number
    
    logger.debug('Login attempt started', {
      identifier: isEmail ? sanitizerUtils.sanitizeUser({ email }).email : 'phone',
      type: isEmail ? 'email' : 'phone'
    });

    logger.debug('Checking account lockout status', {
      identifier: isEmail ? sanitizerUtils.sanitizeUser({ email }).email : 'phone'
    });
    const lockStatus = await authSecurity.checkLockStatus(email);
    logger.debug('Lock status check completed', {
      identifier: isEmail ? sanitizerUtils.sanitizeUser({ email }).email : 'phone',
      isLocked: lockStatus.locked,
      remainingSeconds: lockStatus.remainingSeconds
    });

    if (lockStatus.locked) {
      logger.warn('Login attempt for locked account', {
        identifier: isEmail ? sanitizerUtils.sanitizeUser({ email }).email : 'phone',
        remainingSeconds: lockStatus.remainingSeconds
      });
      await securityService.logActivity( null, 'login_account_locked', req.ip, req.headers['user-agent'], { email, remainingSeconds: lockStatus.remainingSeconds });
      return ApiResponse.tooManyRequests(res, `Cuenta bloqueada temporalmente. Intente nuevamente en ${lockStatus.remainingSeconds} segundos.`, { locked: true, remainingSeconds: lockStatus.remainingSeconds });
    }

    logger.debug(`[Login Controller] Checking rate limiting for IP: ${req.ip}`);
    const isLimited = await securityService.isRateLimitExceeded( req.ip, 'failed_login', 5, 15 );
    logger.debug(`[Login Controller] Rate limit check result for IP ${req.ip}: ${isLimited ? 'limited' : 'not limited'}`);

    if (process.env.NODE_ENV !== 'development' && isLimited) {
      logger.warn(`[Login Controller] Login rate limit exceeded for IP: ${req.ip}`);
      await securityService.logActivity( null, 'login_rate_limited', req.ip, req.headers['user-agent'], { email });
      return ApiResponse.tooManyRequests(res, 'Demasiados intentos de inicio de sesión fallidos. Por favor, inténtalo de nuevo más tarde.');
    }

    const isAdminPortal = req.get('X-Portal-Type') === 'admin';
    logger.info('Login attempt portal detection', {
      email: sanitizerUtils.sanitizeUser({ email }).email,
      portal: isAdminPortal ? 'ADMIN PORTAL' : 'CLIENT PORTAL'
    });

    logger.debug(`[Login Controller] Retrieving user data for: ${isEmail ? email : 'phone'}`);
    
    let user;
    try {
      if (isEmail) {
        user = await userRepository.findByEmail(email);
      } else {
        // Phone login - use normalized WhatsApp phone format
        const normalizedPhone = userRepository.normalizeWhatsAppPhone(identifier);
        user = await userRepository.findByWhatsAppPhone(normalizedPhone);
        
        // Fallback to old phone lookup for legacy users
        if (!user) {
          const phoneVariants = getPhoneVariants(identifier);
          const phoneQuery = 'SELECT * FROM users WHERE phone = ANY($1) LIMIT 1';
          const { rows } = await db.query(phoneQuery, [phoneVariants]);
          user = rows[0];
        }
        
        logger.debug(`[Login Controller] Phone lookup with normalized: ${normalizedPhone}, found: ${!!user}`);
      }
      logger.debug(`[Login Controller] Database query completed, user found: ${!!user}`);
    } catch (dbError) {
      logger.error(`[Login Controller] Database error during user lookup: ${dbError.message}`, {
        error: dbError,
        stack: dbError.stack
      });
      throw dbError;
    }

    if (!user) {
      logger.warn(`[Login Controller] Login attempt failed: User not found for ${isEmail ? 'email' : 'phone'} ${email}`);
      await authSecurity.recordFailedAttempt(email, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        userId: null
      });
      return ApiResponse.unauthorized(res, 'Correo electrónico/teléfono o contraseña incorrectos.');
    }
    logger.debug(`[Login Controller] User found for email ${email}: ID=${user.id}, is_email_verified=${user.is_email_verified}, role=${user.role}`);
    logger.debug(`[Login Controller] Password hash exists: ${!!user.password_hash}`);

    logger.debug(`[Login Controller] Checking if email is verified for user ${email}`);
    if (user.is_email_verified === false) {
      logger.warn(`[Login Controller] Login attempt failed: Email ${email} is not verified`);
      await securityService.logActivity(user.id, 'login_unverified_email', req.ip, req.headers['user-agent'], { email });

      // Always regenerate verification token when user tries to login with unverified email
      // This ensures they get a working link even if their old token hasn't expired
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await userRepository.updateEmailVerification(user.id, verificationToken, verificationExpires);

      try {
        const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
        await emailService.sendEmailVerificationEmail(
          email,
          verificationUrl
        );
        logger.info(`New verification email sent to ${email} (login attempt with unverified account)`);
      } catch (emailError) {
        logger.error(`Error sending new verification email to ${email}:`, emailError);
      }

      return ApiResponse.forbidden(res, 'Necesitas verificar tu correo electrónico antes de iniciar sesión. Hemos enviado un nuevo enlace de verificación a tu correo. El enlace estará activo durante 24 horas.', 'EMAIL_NOT_VERIFIED');
    }

    // Validate portal access
    if (isAdminPortal && (user.account_type !== 'admin' || user.is_admin_portal !== true)) {
      logger.warn(`Login attempt failed: Account ${email} attempted admin portal access without proper permissions`);
      await securityService.logActivity( user.id, 'unauthorized_portal_access', req.ip, req.headers['user-agent'], { email, attempted_portal: 'admin' });
      return ApiResponse.forbidden(res, 'Acceso denegado: Se requieren privilegios de administrador para este portal.');
    }
    if (!isAdminPortal && user.account_type === 'admin') {
      logger.warn(`Login attempt failed: Admin account ${email} attempted client portal access`);
      await securityService.logActivity( user.id, 'unauthorized_portal_access', req.ip, req.headers['user-agent'], { email, attempted_portal: 'client' });
      return ApiResponse.forbidden(res, 'Acceso denegado: Las cuentas de administrador deben usar el portal de administración.');
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
      await authSecurity.recordFailedAttempt(email, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        userId: user.id
      });
      
      // Log failed admin login to audit trail
      if (auditService && user.role === 'admin') {
        try {
          await auditService.logAdminAction(
            user.id,
            'failed_login',
            'auth',
            null,
            { email, reason: 'password_verification_error' },
            req
          );
        } catch (auditError) {
          logger.warn('Failed to log failed login to audit:', auditError.message);
        }
      }
      
      // Return generic unauthorized for security, don't expose internal error details
      return ApiResponse.unauthorized(res, 'Ocurrió un error de autenticación.');
    }

    if (!isMatch) {
      logger.warn(`[Login Controller] Login attempt failed: Invalid password for email ${email}`);
      await authSecurity.recordFailedAttempt(email, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        userId: user.id
      });
      
      // Log failed admin login to audit trail
      if (auditService && user.role === 'admin') {
        try {
          await auditService.logAdminAction(
            user.id,
            'failed_login',
            'auth',
            null,
            { email, reason: 'invalid_password' },
            req
          );
        } catch (auditError) {
          logger.warn('Failed to log invalid password to audit:', auditError.message);
        }
      }
      
      return ApiResponse.unauthorized(res, 'Correo electrónico o contraseña incorrectos.');
    }

    logger.debug(`[Login Controller] Password verified successfully for user ${email}`);

    // Record successful login (this also resets failed attempts)
    logger.debug(`[Login Controller] Recording successful login for user ${email}`);
    await authSecurity.recordSuccessfulLogin(email, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      userId: user.id
    });
    logger.debug(`[Login Controller] Successful login recorded for user ${email}`);
    
    // Log successful admin login to audit trail
    if (auditService && user.role === 'admin') {
      try {
        await auditService.logAdminAction(
          user.id,
          'login',
          'auth',
          null,
          { email, portal: isAdminPortal ? 'admin' : 'client' },
          req
        );
      } catch (auditError) {
        logger.warn('Failed to log successful login to audit:', auditError.message);
      }
    }
    
    // Update last login timestamp
    try {
      await db.query(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      logger.debug(`[Login Controller] Updated last login timestamp for user ${email}`);
    } catch (updateError) {
      logger.error(`[Login Controller] Error updating last login timestamp for ${email}:`, updateError);
      // Don't fail the login if timestamp update fails
    }

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
        // Properly destroy the session on regeneration failure to prevent session fixation
        req.session.destroy(destroyErr => {
          if (destroyErr) {
            logger.error(`[Login Controller] Failed to destroy session after regeneration error for ${email}:`, destroyErr);
          }
          return next(createError('Error al inicializar la sesión durante el inicio de sesión. Por favor, intente nuevamente.', 500));
        });
        return; // Prevent further execution
      }

      logger.debug(`[Login Controller] Session regenerated successfully for user ${email}, new session ID: ${req.session.id}`);

      // Set session data *after* successful regeneration
      logger.debug(`[Login Controller] Setting session data for user ${email}`);
      req.session.userId = user.id;
      logger.debug(`[Login Controller] Set req.session.userId = ${user.id}`);

      req.session.userEmail = user.account_email;
      logger.debug(`[Login Controller] Set req.session.userEmail = ${user.account_email}`);

      req.session.userName = user.first_name || ''; // Store consistently
      logger.debug(`[Login Controller] Set req.session.userName = ${user.first_name || ''}`);

      req.session.userLastName = user.last_name || ''; // Store consistently
      logger.debug(`[Login Controller] Set req.session.userLastName = ${user.last_name || ''}`);

      req.session.accountType = user.account_type || 'client';
      logger.debug(`[Login Controller] Set req.session.accountType = ${user.account_type || 'client'}`);

      req.session.isAdminPortal = isAdminPortal && user.account_type === 'admin'; // Ensure boolean
      logger.debug(`[Login Controller] Set req.session.isAdminPortal = ${isAdminPortal && user.account_type === 'admin'}`);

      // Enhanced session security tracking
      req.session.createdAt = new Date();
      req.session.lastActivity = new Date();
      req.session.lastRegeneration = new Date();
      req.session.regenerationCount = (req.session.regenerationCount || 0) + 1;
      req.session.loginIP = req.ip;
      req.session.userAgent = req.headers['user-agent'];
      logger.debug(`[Login Controller] Set session security tracking fields`);

      logger.debug(`[Login Controller] About to save session with ID: ${req.session.id}`);

      // Explicitly save the session and wait for it to complete before sending response
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error(`[Login Controller] Error saving session for user ${email}:`, {
            error: saveErr,
            stack: saveErr.stack,
            sessionId: req.session.id
          });
          // Return error response if session save fails
          return ApiResponse.error(res, 'Error al guardar la sesión. Por favor, intenta nuevamente.', 500);
        }

        logger.debug(`[Login Controller] Session saved successfully for user ${email}, session ID: ${req.session.id}`);

        logger.info(`[Login Controller] ${isAdminPortal ? '🔐 ADMIN LOGIN SUCCESS' : '👤 USER LOGIN SUCCESS'}: ${user.account_email} (ID: ${user.id}) SessionID: ${req.session.id}`);
        if (isAdminPortal) {
          logger.info(`[Login Controller] Admin login details: account_type=${user.account_type}, is_admin_portal=${user.is_admin_portal}`);
        }

        // Track user login metric
        metricsCollector.recordUserLogin(user.id);

        // Log activity after session is confirmed stable
        securityService.logActivity(
          user.id,
          isAdminPortal ? 'admin_login' : 'client_login',
          req.ip,
          req.headers['user-agent'],
          { email: user.account_email, portal: isAdminPortal ? 'admin' : 'client' }
        ).catch(err => logger.error('Error logging login activity:', err));

        // Prepare user data for response (don't send hash)
        const isAdmin = user.account_type === 'admin';
        const hasAdminPortalAccess = isAdminPortal && isAdmin;
        logger.info(`Access details for response: isAdmin=${isAdmin}, hasAdminPortalAccess=${hasAdminPortalAccess}`);

        // Send response only after session is fully saved
        ApiResponse.success(res, {
          user: {
            id: user.id,
            email: user.account_email, // Use correct database column name
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
        }, 200, '¡Inicio de sesión exitoso!'); // Consistent message
      });
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
exports.logout = async (req, res, next) => {
  const userId = req.session.userId;
  const userEmail = req.session.userEmail;
  const sessionId = req.session.id;
  const sessionAge = req.session.createdAt ? 
    Math.round((Date.now() - new Date(req.session.createdAt).getTime()) / 60000) : null;
  
  logger.info(`[SESSION-SECURITY] Logout requested for user: ${userEmail || 'N/A'} (ID: ${userId || 'N/A'})`, {
    sessionId: sessionId,
    sessionAge: sessionAge ? sessionAge + ' minutes' : 'unknown',
    logoutIP: req.ip,
    userAgent: req.headers['user-agent']
  });

  if (userId) {
    securityService.logActivity(userId, 'logout', req.ip, req.headers['user-agent'], { 
      email: userEmail,
      sessionId: sessionId,
      sessionAge: sessionAge
    }).catch(err => logger.error('Error logging logout:', err));
    
    // Log admin logout to audit trail
    if (auditService && req.session.accountType === 'admin') {
      try {
        await auditService.logAdminAction(
          userId,
          'logout',
          'auth',
          null,
          { email: userEmail, sessionAge: sessionAge },
          req
        );
      } catch (auditError) {
        logger.warn('Failed to log logout to audit:', auditError.message);
      }
    }
  }

  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      logger.error(`[SESSION-SECURITY] Session destruction error for user ID ${userId || 'N/A'}:`, {
        error: err.message,
        sessionId: sessionId,
        userId: userId,
        userEmail: userEmail
      });
      return next(createError('Error al cerrar sesión correctamente.', 500));
    }
    
    logger.info(`[SESSION-SECURITY] User logged out successfully: ID ${userId || 'N/A'}`, {
      sessionDestroyed: true,
      sessionId: sessionId,
      sessionDuration: sessionAge ? sessionAge + ' minutes' : 'unknown'
    });
    
    // Clear session cookies (both possible cookie names)
    res.clearCookie('connect.sid', { path: '/' });
    res.clearCookie('permisos.sid', { path: '/' });
    
    ApiResponse.success(res, null, 200, 'Cierre de sesión exitoso.');
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
      SELECT id, account_email as email, is_email_verified, email_verification_token, email_verification_expires
      FROM users
      WHERE account_email = $1
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
    const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;
    const emailSent = await emailService.sendEmailVerificationEmail(
      email,
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
      SELECT id, account_email as email, is_email_verified, email_verification_expires
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
    return ApiResponse.unauthorized(res, 'Debes iniciar sesión para cambiar tu contraseña.');
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
        return ApiResponse.unauthorized(res, result.message || 'La contraseña actual es incorrecta.');
      } else {
        return ApiResponse.badRequest(res, result.message || 'Error al cambiar la contraseña.');
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
    return ApiResponse.success(res, null, 200, 'Contraseña cambiada exitosamente.');
  } catch (error) {
    handleControllerError(error, 'changePassword', req, res, next);
  }
};