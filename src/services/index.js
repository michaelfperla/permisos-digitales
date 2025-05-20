/**
 * Services Index
 *
 * This file exports all services from the services directory.
 */

const applicationService = require('./application.service');
const authSecurityService = require('./auth-security.service');
const emailService = require('./email.service');
const passwordResetService = require('./password-reset.service');
const pdfService = require('./pdf-service');
const securityService = require('./security.service');
const storageService = require('./storage.service');
const paymentService = require('./payment.service');

// Create an auth service that combines auth-related functionality
const authService = {
  /**
   * Verify a password against a hash
   * @param {string} password - The plain text password
   * @param {string} hash - The password hash to compare against
   * @returns {Promise<boolean>} - True if the password matches the hash
   */
  verifyPassword: async (password, hash) => {
    return authSecurityService.verifyPassword(password, hash);
  },

  /**
   * Hash a password
   * @param {string} password - The plain text password to hash
   * @returns {Promise<string>} - The hashed password
   */
  hashPassword: async (password) => {
    return authSecurityService.hashPassword(password);
  }
};

module.exports = {
  applicationService,
  authService,
  emailService,
  passwordResetService,
  pdfService,
  securityService,
  storageService,
  paymentService
};
