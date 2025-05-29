// src/controllers/password-reset.controller.js
const bcrypt = require('bcrypt');
const passwordResetService = require('../services/password-reset.service');
const { logger } = require('../utils/enhanced-logger');
const { handleControllerError } = require('../utils/error-helpers');
const securityService = require('../services/security.service');
const ApiResponse = require('../utils/api-response');

const SALT_ROUNDS = 10;

/**
 * Request a password reset
 * POST /api/auth/forgot-password
 */
exports.requestReset = async (req, res, next) => {
  const { email } = req.body;

  try {
    logger.debug(`Password reset requested for email: ${email}`);

    // Check for rate limiting
    const isLimited = await securityService.isRateLimitExceeded(
      req.ip,
      'password_reset_request',
      3, // Limit to 3 requests
      60  // per hour
    );

    if (isLimited) {
      await securityService.logActivity(
        null,
        'password_reset_rate_limited',
        req.ip,
        req.headers['user-agent'],
        { email }
      );
      return ApiResponse.tooManyRequests(res, 'Demasiados intentos de restablecimiento de contraseña. Por favor, inténtalo de nuevo más tarde.');
    }

    // Request password reset
    await passwordResetService.requestPasswordReset(email);

    // Log the activity
    await securityService.logActivity(
      null, // We don't know the user ID yet
      'password_reset_requested',
      req.ip,
      req.headers['user-agent'],
      { email }
    );

    // Always return success for security (even if email doesn't exist)
    ApiResponse.success(res, 'Si tu correo electrónico está registrado, recibirás un enlace para restablecer tu contraseña.');
  } catch (error) {
    handleControllerError(error, 'requestReset', req, res, next);
  }
};

/**
 * Validate a password reset token
 * GET /api/auth/reset-password/:token
 */
exports.validateResetToken = async (req, res, next) => {
  const { token } = req.params;

  try {
    logger.debug(`Validating password reset token: ${token}`);

    // Validate token
    const userId = await passwordResetService.validateResetToken(token);

    if (!userId) {
      return ApiResponse.badRequest(res, 'El enlace de restablecimiento de contraseña es inválido o ha expirado.');
    }

    // Token is valid
    ApiResponse.success(res, 'Token de restablecimiento válido.', { valid: true });
  } catch (error) {
    handleControllerError(error, 'validateResetToken', req, res, next);
  }
};

/**
 * Reset password with a valid token
 * POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res, next) => {
  const { token, password } = req.body;

  try {
    logger.debug(`Resetting password with token: ${token}`);

    // Validate token first
    const userId = await passwordResetService.validateResetToken(token);

    if (!userId) {
      return ApiResponse.badRequest(res, 'El enlace de restablecimiento de contraseña es inválido o ha expirado.');
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Reset the password
    const success = await passwordResetService.resetPassword(token, passwordHash);

    if (!success) {
      return ApiResponse.error(res, 'Error al restablecer la contraseña. Por favor, intenta nuevamente.', 500);
    }

    // Log the activity
    await securityService.logActivity(
      userId,
      'password_reset_completed',
      req.ip,
      req.headers['user-agent'],
      {}
    );

    // Password reset successful
    ApiResponse.success(res, 'Contraseña restablecida exitosamente. Ahora puedes iniciar sesión con tu nueva contraseña.');
  } catch (error) {
    handleControllerError(error, 'resetPassword', req, res, next);
  }
};
