/**
 * Notification Channels Service
 * Manages different notification channels and provides a unified interface
 * for sending notifications through multiple channels
 */

const { logger } = require('../utils/logger');

// Lazy-load services to avoid circular dependencies
let emailService = null;

/**
 * Channel types enum
 */
const CHANNELS = {
  EMAIL: 'email',
  SMS: 'sms',
  WHATSAPP: 'whatsapp',
  PUSH: 'push'
};

/**
 * Channel availability configuration
 * This can be moved to config/environment variables later
 */
const CHANNEL_CONFIG = {
  [CHANNELS.EMAIL]: {
    enabled: true,
    provider: 'emailService'
  },
  [CHANNELS.SMS]: {
    enabled: false,
    provider: 'twilioService' // Future implementation
  },
  [CHANNELS.WHATSAPP]: {
    enabled: false,
    provider: 'whatsappBusinessApi' // Future implementation
  },
  [CHANNELS.PUSH]: {
    enabled: false,
    provider: 'firebaseCloudMessaging' // Future implementation
  }
};

/**
 * Base notification class that all notifications should extend
 */
class BaseNotification {
  constructor(type, data) {
    this.type = type;
    this.data = data;
    this.timestamp = new Date();
  }

  /**
   * Get available channels for this notification type
   * Can be overridden by specific notification types
   */
  getAvailableChannels() {
    return Object.keys(CHANNEL_CONFIG)
      .filter(channel => CHANNEL_CONFIG[channel].enabled);
  }

  /**
   * Validate notification data
   * Should be implemented by each notification type
   */
  validate() {
    throw new Error('validate() must be implemented by notification type');
  }
}

/**
 * Send notification through specified channels
 * @param {BaseNotification} notification - Notification instance
 * @param {Array<string>} channels - Array of channel names to use
 * @param {Object} options - Additional options per channel
 * @returns {Object} Results per channel
 */
async function sendNotification(notification, channels = null, options = {}) {
  try {
    // Validate notification
    notification.validate();

    // Get channels to use
    const targetChannels = channels || notification.getAvailableChannels();
    const results = {};

    // Send through each channel
    for (const channel of targetChannels) {
      if (!CHANNEL_CONFIG[channel] || !CHANNEL_CONFIG[channel].enabled) {
        logger.warn(`Channel ${channel} is not available or disabled`);
        results[channel] = { success: false, error: 'Channel not available' };
        continue;
      }

      try {
        results[channel] = await sendThroughChannel(
          channel,
          notification,
          options[channel] || {}
        );
      } catch (error) {
        logger.error(`Failed to send notification through ${channel}:`, error);
        results[channel] = { success: false, error: error.message };
      }
    }

    return results;
  } catch (error) {
    logger.error('Error sending notification:', error);
    throw error;
  }
}

/**
 * Send notification through a specific channel
 * @param {string} channel - Channel name
 * @param {BaseNotification} notification - Notification instance
 * @param {Object} options - Channel-specific options
 * @returns {Object} Send result
 */
async function sendThroughChannel(channel, notification, options) {
  switch (channel) {
    case CHANNELS.EMAIL:
      // Lazy load email service on first use
      if (!emailService) {
        emailService = require('./email.service');
      }
      return await emailService.sendEmail({
        to: notification.data.recipient,
        subject: notification.data.subject,
        text: notification.data.text,
        html: notification.data.html,
        ...options
      });

    case CHANNELS.SMS:
      // Future implementation
      logger.info(`SMS channel called for ${notification.type}`);
      return { success: false, error: 'SMS channel not yet implemented' };

    case CHANNELS.WHATSAPP:
      // Future implementation
      logger.info(`WhatsApp channel called for ${notification.type}`);
      return { success: false, error: 'WhatsApp channel not yet implemented' };

    case CHANNELS.PUSH:
      // Future implementation
      logger.info(`Push channel called for ${notification.type}`);
      return { success: false, error: 'Push channel not yet implemented' };

    default:
      throw new Error(`Unknown channel: ${channel}`);
  }
}

/**
 * Get user's notification preferences
 * @param {number} userId - User ID
 * @returns {Object} User preferences per notification type
 */
async function getUserNotificationPreferences(userId) {
  // For now, return default preferences
  // In the future, this would query user preferences from database
  return {
    payment_reminders: [CHANNELS.EMAIL],
    permit_ready: [CHANNELS.EMAIL],
    permit_expiration: [CHANNELS.EMAIL],
    marketing: [] // User opted out of marketing
  };
}

/**
 * Check if a channel is available
 * @param {string} channel - Channel name
 * @returns {boolean} True if channel is available
 */
function isChannelAvailable(channel) {
  return CHANNEL_CONFIG[channel] && CHANNEL_CONFIG[channel].enabled;
}

/**
 * Get all available channels
 * @returns {Array<string>} Array of available channel names
 */
function getAvailableChannels() {
  return Object.keys(CHANNEL_CONFIG)
    .filter(channel => CHANNEL_CONFIG[channel].enabled);
}

module.exports = {
  CHANNELS,
  BaseNotification,
  sendNotification,
  getUserNotificationPreferences,
  isChannelAvailable,
  getAvailableChannels
};