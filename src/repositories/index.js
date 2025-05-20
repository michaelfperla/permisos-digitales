/**
 * Repository Index
 * Exports all repositories for easy access
 */
const userRepository = require('./user.repository');
const applicationRepository = require('./application.repository');
const securityRepository = require('./security.repository');
const paymentRepository = require('./payment.repository');

module.exports = {
  userRepository,
  applicationRepository,
  securityRepository,
  paymentRepository
};
