/**
 * Notification Service
 * Handles sending notifications to users through various channels
 */
const { logger } = require('../utils/logger');
const emailService = require('./email.service');
const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();
const { formatDate } = require('../utils/formatters');
const oxxoReminderTemplate = require('../templates/email/oxxo-reminder.template');
const { CHANNELS, isChannelAvailable } = require('./notification-channels.service');

/**
 * Send an OXXO payment expiration reminder
 * @param {Object} paymentDetails - Payment details
 * @param {number} paymentDetails.application_id - Application ID
 * @param {string} paymentDetails.user_email - User email
 * @param {string} paymentDetails.first_name - User first name
 * @param {string} paymentDetails.last_name - User last name
 * @param {string} paymentDetails.oxxo_reference - OXXO reference number
 * @param {number} paymentDetails.expires_at - Expiration timestamp (Unix timestamp)
 * @param {string} paymentDetails.expires_at_date - Formatted expiration date
 * @param {number} paymentDetails.amount - Payment amount
 * @param {string} paymentDetails.marca - Vehicle make
 * @param {string} paymentDetails.linea - Vehicle model
 * @param {string} paymentDetails.ano_modelo - Vehicle year
 * @param {Array<string>} [channels] - Optional array of channels to use
 * @returns {Promise<Object>} - Results per channel
 */
async function sendOxxoExpirationReminder(paymentDetails, channels = [CHANNELS.EMAIL]) {
  try {
    logger.debug(`Sending OXXO expiration reminder for application ${paymentDetails.application_id} via channels: ${channels.join(', ')}`);

    const results = {};

    // Process each channel
    for (const channel of channels) {
      if (!isChannelAvailable(channel)) {
        logger.warn(`Channel ${channel} is not available for OXXO reminders`);
        results[channel] = { success: false, error: 'Channel not available' };
        continue;
      }

      switch (channel) {
        case CHANNELS.EMAIL:
          try {
            // Add frontendUrl to the data for the template
            const templateData = {
              ...paymentDetails,
              frontendUrl: config.frontendUrl
            };

            // Generate email content using template
            const emailContent = oxxoReminderTemplate.render(templateData);

            // Send email notification
            const emailSent = await emailService.sendEmail({
              to: paymentDetails.user_email,
              ...emailContent
            });

            results[channel] = { 
              success: emailSent, 
              error: emailSent ? null : 'Email delivery failed' 
            };

            if (emailSent) {
              logger.info(`OXXO expiration reminder sent via email to ${paymentDetails.user_email} for application ${paymentDetails.application_id}`);
            } else {
              logger.warn(`Failed to send OXXO expiration reminder via email to ${paymentDetails.user_email} for application ${paymentDetails.application_id}`);
            }
          } catch (emailError) {
            logger.error(`Error processing email channel:`, {
              error: emailError.message,
              applicationId: paymentDetails.application_id,
              channel: CHANNELS.EMAIL
            });
            results[channel] = { 
              success: false, 
              error: `Email processing failed: ${emailError.message}` 
            };
          }
          break;

        case CHANNELS.SMS:
          // Future SMS implementation
          logger.info(`SMS notification for OXXO reminder would be sent to user ${paymentDetails.application_id}`);
          results[channel] = { success: false, error: 'SMS not yet implemented' };
          break;

        case CHANNELS.WHATSAPP:
          // Future WhatsApp implementation
          logger.info(`WhatsApp notification for OXXO reminder would be sent to user ${paymentDetails.application_id}`);
          results[channel] = { success: false, error: 'WhatsApp not yet implemented' };
          break;

        default:
          results[channel] = { success: false, error: 'Unknown channel' };
      }
    }

    // Return results for all channels
    return results;
  } catch (error) {
    logger.error(`Error sending OXXO expiration reminder for application ${paymentDetails.application_id}:`, {
      error: error.message,
      applicationId: paymentDetails.application_id,
      userEmail: paymentDetails.user_email
    });
    // Return error for all requested channels
    const errorResults = {};
    for (const channel of channels) {
      errorResults[channel] = { success: false, error: error.message };
    }
    return errorResults;
  }
}

/**
 * Send a permit expiration reminder
 * @param {Object} permitDetails - Permit details
 * @param {number} permitDetails.application_id - Application ID
 * @param {string} permitDetails.user_email - User email
 * @param {string} permitDetails.first_name - User first name
 * @param {string} permitDetails.last_name - User last name
 * @param {string} permitDetails.folio - Permit folio number
 * @param {string} permitDetails.marca - Vehicle make
 * @param {string} permitDetails.linea - Vehicle model
 * @param {string} permitDetails.ano_modelo - Vehicle year
 * @param {string} permitDetails.fecha_vencimiento - Expiration date
 * @param {number} permitDetails.days_remaining - Days until expiration
 * @param {Array<string>} [channels] - Optional array of channels to use
 * @returns {Promise<Object>} - Results per channel
 */
async function sendPermitExpirationReminder(permitDetails, channels = [CHANNELS.EMAIL]) {
  try {
    logger.debug(`Sending permit expiration reminder for application ${permitDetails.application_id} via channels: ${channels.join(', ')}`);

    const results = {};

    // Process each channel
    for (const channel of channels) {
      if (!isChannelAvailable(channel)) {
        logger.warn(`Channel ${channel} is not available for permit expiration reminders`);
        results[channel] = { success: false, error: 'Channel not available' };
        continue;
      }

      switch (channel) {
        case CHANNELS.EMAIL:
          try {
            // Format expiration date for display
            const expirationDate = new Date(permitDetails.fecha_vencimiento);
            const formattedDate = formatDate(expirationDate);

            // Get user's name or use a default
            const userName = permitDetails.first_name
              ? `${permitDetails.first_name} ${permitDetails.last_name || ''}`.trim()
              : 'Estimado usuario';

            // Vehicle description
            const vehicleDescription = `${permitDetails.marca} ${permitDetails.linea} ${permitDetails.ano_modelo}`;

            // Construct the renewal URL
            const renewalUrl = `${config.frontendUrl}/applications/${permitDetails.application_id}/renew`;

            // Prepare email details
            const emailDetails = {
              userName,
              folio: permitDetails.folio || `APP-${permitDetails.application_id}`,
              vehicleDescription,
              expirationDate: formattedDate,
              daysRemaining: permitDetails.days_remaining,
              renewalUrl
            };

            // Send email notification
            const emailSent = await emailService.sendPermitExpirationReminder(
              permitDetails.user_email,
              emailDetails
            );

            results[channel] = {
              success: emailSent,
              error: emailSent ? null : 'Email delivery failed'
            };

            if (emailSent) {
              logger.info(`Permit expiration reminder sent via email to ${permitDetails.user_email} for application ${permitDetails.application_id}`);
            } else {
              logger.warn(`Failed to send permit expiration reminder via email to ${permitDetails.user_email} for application ${permitDetails.application_id}`);
            }
          } catch (emailError) {
            logger.error(`Error processing email channel for permit expiration:`, {
              error: emailError.message,
              applicationId: permitDetails.application_id,
              channel: CHANNELS.EMAIL
            });
            results[channel] = {
              success: false,
              error: `Email processing failed: ${emailError.message}`
            };
          }
          break;

        case CHANNELS.SMS:
          // Future SMS implementation
          logger.info(`SMS notification for permit expiration would be sent to user ${permitDetails.application_id}`);
          results[channel] = { success: false, error: 'SMS not yet implemented' };
          break;

        case CHANNELS.WHATSAPP:
          // Future WhatsApp implementation
          logger.info(`WhatsApp notification for permit expiration would be sent to user ${permitDetails.application_id}`);
          results[channel] = { success: false, error: 'WhatsApp not yet implemented' };
          break;

        default:
          results[channel] = { success: false, error: 'Unknown channel' };
      }
    }

    // Return results for all channels
    return results;
  } catch (error) {
    logger.error(`Error sending permit expiration reminder for application ${permitDetails.application_id}:`, {
      error: error.message,
      applicationId: permitDetails.application_id,
      userEmail: permitDetails.user_email
    });
    // Return error for all requested channels
    const errorResults = {};
    for (const channel of channels) {
      errorResults[channel] = { success: false, error: error.message };
    }
    return errorResults;
  }
}

/**
 * Send notification when permit is ready
 * @param {Object} notificationData - Notification data
 * @param {Object} notificationData.user - User object with email, first_name, last_name
 * @param {Object} notificationData.application - Application object with details
 * @param {Array<string>} [channels] - Optional array of channels to use
 * @returns {Promise<Object>} - Results per channel
 */
async function sendPermitReadyNotification(notificationData, channels = [CHANNELS.EMAIL]) {
  try {
    const { user, application } = notificationData;
    
    if (!user || !application) {
      logger.error(`User or application not provided for permit ready notification`);
      // Return error for all requested channels
      const errorResults = {};
      for (const channel of channels) {
        errorResults[channel] = { success: false, error: 'Missing user or application data' };
      }
      return errorResults;
    }

    logger.debug(`Sending permit ready notification for application ${application.id} via channels: ${channels.join(', ')}`);

    const results = {};

    // Process each channel
    for (const channel of channels) {
      if (!isChannelAvailable(channel)) {
        logger.warn(`Channel ${channel} is not available for permit ready notifications`);
        results[channel] = { success: false, error: 'Channel not available' };
        continue;
      }

      switch (channel) {
        case CHANNELS.EMAIL:
          try {
            // Format user name
            const userName = user.first_name 
              ? `${user.first_name} ${user.last_name || ''}`.trim()
              : 'Estimado usuario';
            
            // Vehicle description
            const vehicleDescription = `${application.marca} ${application.linea} ${application.ano_modelo}`;
            
            // Construct the permit URL
            const permitUrl = `${config.frontendUrl}/permits/${application.id}`;
            
            const emailDetails = {
              userName,
              vehicleDescription,
              marca: application.marca,
              linea: application.linea,
              anoModelo: application.ano_modelo,
              permitUrl,
              downloadUrl: permitUrl,
              supportEmail: config.supportEmail || 'soporte@permisos-digitales.mx'
            };

            // Send email notification
            const emailSent = await emailService.sendPermitReadyNotification(
              user.email,
              emailDetails
            );

            results[channel] = {
              success: emailSent,
              error: emailSent ? null : 'Email delivery failed'
            };

            if (emailSent) {
              logger.info(`Permit ready notification sent via email to ${user.email} for application ${application.id}`);
            } else {
              logger.warn(`Failed to send permit ready notification via email to ${user.email} for application ${application.id}`);
            }
          } catch (emailError) {
            logger.error(`Error processing email channel for permit ready:`, {
              error: emailError.message,
              applicationId: application.id,
              channel: CHANNELS.EMAIL
            });
            results[channel] = {
              success: false,
              error: `Email processing failed: ${emailError.message}`
            };
          }
          break;

        case CHANNELS.SMS:
          // Future SMS implementation - could send a short message with permit folio
          logger.info(`SMS notification for permit ready would be sent to user ${user.email}`);
          results[channel] = { success: false, error: 'SMS not yet implemented' };
          break;

        case CHANNELS.WHATSAPP:
          // Future WhatsApp implementation - could send permit PDF directly
          logger.info(`WhatsApp notification for permit ready would be sent to user ${user.email}`);
          results[channel] = { success: false, error: 'WhatsApp not yet implemented' };
          break;

        default:
          results[channel] = { success: false, error: 'Unknown channel' };
      }
    }

    // Return results for all channels
    return results;
  } catch (error) {
    logger.error(`Error sending permit ready notification:`, {
      error: error.message
    });
    // Return error for all requested channels
    const errorResults = {};
    for (const channel of channels) {
      errorResults[channel] = { success: false, error: error.message };
    }
    return errorResults;
  }
}

module.exports = {
  sendOxxoExpirationReminder,
  sendPermitExpirationReminder,
  sendPermitReadyNotification
};
