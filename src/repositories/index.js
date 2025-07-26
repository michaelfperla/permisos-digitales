/**
 * Repository Index
 * Exports all repositories for easy access
 */
const userRepository = require('./user.repository');
const applicationRepository = require('./application.repository');
const securityRepository = require('./security.repository');
const paymentRepository = require('./payment.repository');
const monitoringRepository = require('./monitoring.repository');
const paymentRecoveryRepository = require('./payment-recovery.repository');
const queueRepository = require('./queue.repository');
const reminderRepository = require('./reminder.repository');
const configurationRepository = require('./configuration.repository');

module.exports = {
  userRepository,
  applicationRepository,
  securityRepository,
  paymentRepository,
  monitoringRepository,
  paymentRecoveryRepository,
  queueRepository,
  reminderRepository,
  configurationRepository
};
