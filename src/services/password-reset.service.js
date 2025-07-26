// src/services/password-reset.service.js
const crypto = require('crypto');
const { userRepository } = require('../repositories');
const { logger } = require('../utils/logger');
const emailService = require('./email.service');
const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();

/**
 * Generate a random token for password reset
 * @returns {string} Random token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a password reset token for a user
 * @param {number} userId - User ID
 * @returns {Promise<string|null>} Reset token or null if failed
 */
async function createResetToken(userId) {
  try {
    // Generate a random token
    const token = generateResetToken();

    // Set expiration time (1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Use repository to create the reset token
    return await userRepository.createPasswordResetToken(userId, token, expiresAt);
  } catch (error) {
    logger.error(`Error creating reset token for user ${userId}:`, error);
    return null;
  }
}

/**
 * Validate a password reset token
 * @param {string} token - Reset token
 * @returns {Promise<number|null>} User ID if token is valid, null otherwise
 */
async function validateResetToken(token) {
  try {
    // Use repository to find user by reset token
    const tokenData = await userRepository.findUserByResetToken(token);
    
    if (!tokenData) {
      logger.warn('Invalid reset token provided');
      return null;
    }

    const { id: user_id, expires_at, used_at } = tokenData;

    // Check if token is expired
    if (new Date() > new Date(expires_at)) {
      logger.warn(`Expired reset token for user ${user_id}`);
      return null;
    }

    // Check if token has already been used
    if (used_at) {
      logger.warn(`Already used reset token for user ${user_id}`);
      return null;
    }

    return user_id;
  } catch (error) {
    logger.error('Error validating reset token:', error);
    return null;
  }
}

/**
 * Mark a reset token as used
 * @param {string} token - Reset token
 * @returns {Promise<boolean>} True if successful
 */
async function markTokenAsUsed(token) {
  try {
    return await userRepository.invalidateResetToken(token);
  } catch (error) {
    logger.error('Error marking reset token as used:', error);
    return false;
  }
}

/**
 * Request a password reset for a user
 * @param {string} email - User email
 * @param {string} ipAddress - IP address of the request
 * @returns {Promise<boolean>} True if reset request was successful
 */
async function requestPasswordReset(email, ipAddress = 'unknown') {
  try {
    // Use repository to find user with security context
    const user = await userRepository.findUserForPasswordReset(email);

    // If user not found, return true anyway for security
    if (!user) {
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      // Log security event for monitoring
      await userRepository.logSecurityEvent(
        null,
        'password_reset_nonexistent_user',
        ipAddress,
        { email, reason: 'user_not_found' }
      );
      return true;
    }

    // Intelligent verification checks
    
    // Check if email is verified
    if (!user.is_email_verified) {
      logger.warn(`Password reset requested for unverified email: ${email}`);
      // Instead of blocking, send a different email encouraging verification
      try {
        const verificationUrl = `${config.frontendUrl}/verify-email`;
        await emailService.sendEmailVerificationReminderWithPasswordReset(
          user.email,
          user.first_name,
          verificationUrl
        );
      } catch (emailError) {
        logger.error(`Error sending verification reminder to ${email}:`, emailError);
      }
      return true;
    }

    // Check if account is active
    if (user.account_status && user.account_status !== 'active') {
      logger.warn(`Password reset requested for ${user.account_status} account: ${email}`);
      if (user.account_status === 'suspended' || user.account_status === 'banned') {
        // Don't send password reset for suspended/banned accounts
        await userRepository.logSecurityEvent(
          user.id,
          'password_reset_blocked_account',
          ipAddress,
          { email, account_status: user.account_status }
        );
        return true;
      }
    }

    // Check for too many active reset tokens
    if (user.active_reset_tokens > 0) {
      logger.warn(`User ${email} already has ${user.active_reset_tokens} active reset token(s)`);
      
      // Check if last request was very recent (within 5 minutes)
      if (user.last_reset_request) {
        const minutesSinceLastRequest = 
          (new Date() - new Date(user.last_reset_request)) / (1000 * 60);
        
        if (minutesSinceLastRequest < 5) {
          logger.warn(`Password reset requested too soon for ${email} (${minutesSinceLastRequest.toFixed(1)} minutes ago)`);
          // Don't create new token, just return success
          return true;
        }
      }
    }

    // Additional security check: account age
    const accountAgeHours = (new Date() - new Date(user.created_at)) / (1000 * 60 * 60);
    if (accountAgeHours < 1) {
      logger.warn(`Password reset requested for very new account: ${email} (${accountAgeHours.toFixed(1)} hours old)`);
      // Log this as a potential security event
      await userRepository.logSecurityEvent(
        user.id,
        'password_reset_new_account',
        ipAddress,
        { email, account_age_hours: accountAgeHours }
      );
    }

    // Create reset token
    const token = await createResetToken(user.id);
    if (!token) {
      logger.error(`Failed to create reset token for user ${user.id}`);
      return false;
    }

    // Prepare personalized email data
    const resetUrl = `${config.appUrl}/#/reset-password`;
    const emailData = {
      userName: user.first_name || 'Usuario',
      lastLoginInfo: user.last_login_at 
        ? `Tu último inicio de sesión fue el ${new Date(user.last_login_at).toLocaleDateString('es-MX')}`
        : null,
      securityTip: accountAgeHours < 24 
        ? 'Si no creaste esta cuenta recientemente, por favor contáctanos inmediatamente.'
        : null
    };

    // Send reset email with additional context
    const emailSent = await emailService.sendPasswordResetEmail(
      user.email,
      token,
      resetUrl,
      emailData
    );

    // Log successful password reset request
    if (emailSent) {
      await userRepository.logSecurityEvent(
        user.id,
        'password_reset_requested',
        ipAddress,
        { 
          email,
          token_created: true,
          account_age_hours: accountAgeHours,
          has_previous_tokens: user.active_reset_tokens > 0
        }
      );
      
      logger.info(`Password reset email sent successfully to ${email}`);
    }

    return emailSent;
  } catch (error) {
    logger.error(`Error requesting password reset for ${email}:`, error);
    return false;
  }
}

/**
 * Reset a user's password using a valid token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password (already hashed)
 * @returns {Promise<boolean>} True if password was reset successfully
 */
async function resetPassword(token, newPasswordHash) {
  try {
    // Use repository to execute password reset with transaction safety
    const result = await userRepository.executePasswordReset(token, newPasswordHash);
    
    if (result.success) {
      logger.info(`Password reset successful for user ${result.userId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Error resetting password:', error);
    return false;
  }
}

module.exports = {
  requestPasswordReset,
  validateResetToken,
  resetPassword
};
