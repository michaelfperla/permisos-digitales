/**
 * Notification Service Compatibility Layer
 * Provides backward compatibility for existing code that expects boolean returns
 */

const notificationService = require('./notification.service');
const { CHANNELS } = require('./notification-channels.service');

/**
 * Legacy wrapper for sendOxxoExpirationReminder
 * @param {Object} paymentDetails - Payment details
 * @returns {Promise<boolean>} - True if email was sent successfully
 */
async function sendOxxoExpirationReminderLegacy(paymentDetails) {
  const results = await notificationService.sendOxxoExpirationReminder(
    paymentDetails,
    [CHANNELS.EMAIL]
  );
  return results[CHANNELS.EMAIL]?.success || false;
}

/**
 * Legacy wrapper for sendPermitExpirationReminder
 * @param {Object} permitDetails - Permit details
 * @returns {Promise<boolean>} - True if email was sent successfully
 */
async function sendPermitExpirationReminderLegacy(permitDetails) {
  const results = await notificationService.sendPermitExpirationReminder(
    permitDetails,
    [CHANNELS.EMAIL]
  );
  return results[CHANNELS.EMAIL]?.success || false;
}

/**
 * Legacy wrapper for sendPermitReadyNotification
 * @param {Object} notificationData - Notification data
 * @returns {Promise<boolean>} - True if email was sent successfully
 */
async function sendPermitReadyNotificationLegacy(notificationData) {
  const results = await notificationService.sendPermitReadyNotification(
    notificationData,
    [CHANNELS.EMAIL]
  );
  return results[CHANNELS.EMAIL]?.success || false;
}

module.exports = {
  sendOxxoExpirationReminder: sendOxxoExpirationReminderLegacy,
  sendPermitExpirationReminder: sendPermitExpirationReminderLegacy,
  sendPermitReadyNotification: sendPermitReadyNotificationLegacy
};