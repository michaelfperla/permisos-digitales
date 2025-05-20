// src/services/password-reset.service.js
const crypto = require('crypto');
const db = require('../db');
const { logger } = require('../utils/enhanced-logger');
const emailService = require('./email.service');
const config = require('../config');

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

    // Delete any existing tokens for this user
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
    // Find token in database
    const query = `
            SELECT user_id, expires_at, used_at
            FROM password_reset_tokens
            WHERE token = $1
        `;
    const { rows } = await db.query(query, [token]);

    // If token not found
    if (rows.length === 0) {
      logger.warn(`Invalid reset token: ${token}`);
      return null;
    }

    const { user_id, expires_at, used_at } = rows[0];

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
    const query = `
            UPDATE password_reset_tokens
            SET used_at = CURRENT_TIMESTAMP
            WHERE token = $1
        `;
    await db.query(query, [token]);
    logger.info(`Marked reset token as used: ${token}`);
    return true;
  } catch (error) {
    logger.error('Error marking reset token as used:', error);
    return false;
  }
}

/**
 * Request a password reset for a user
 * @param {string} email - User email
 * @returns {Promise<boolean>} True if reset request was successful
 */
async function requestPasswordReset(email) {
  try {
    // Find user by email
    const { rows } = await db.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    // If user not found, return true anyway for security
    if (rows.length === 0) {
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      return true;
    }

    const user = rows[0];

    // Create reset token
    const token = await createResetToken(user.id);
    if (!token) {
      return false;
    }

    // Send reset email
    const resetUrl = `${config.appUrl}/#/reset-password`;
    const emailSent = await emailService.sendPasswordResetEmail(
      user.email,
      token,
      resetUrl
    );

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
    // Validate token and get user ID
    const userId = await validateResetToken(token);
    if (!userId) {
      return false;
    }

    // Start transaction
    await db.query('BEGIN');

    // Update user's password
    const updateQuery = `
            UPDATE users
            SET password_hash = $1
            WHERE id = $2
        `;
    await db.query(updateQuery, [newPasswordHash, userId]);

    // Mark token as used
    await markTokenAsUsed(token);

    // Commit transaction
    await db.query('COMMIT');

    logger.info(`Password reset successful for user ${userId}`);
    return true;
  } catch (error) {
    // Rollback transaction on error
    await db.query('ROLLBACK');
    logger.error('Error resetting password:', error);
    return false;
  }
}

module.exports = {
  requestPasswordReset,
  validateResetToken,
  resetPassword
};
