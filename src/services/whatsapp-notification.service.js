/**
 * WhatsApp Notification Service
 * Centralizes all WhatsApp notifications for credential delivery and user management
 */

const { logger } = require('../utils/logger');
const axios = require('axios');

class WhatsAppNotificationService {
  constructor() {
    this.config = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      apiUrl: `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
    };
  }

  /**
   * Send portal access credentials after successful payment
   */
  async sendPortalCredentials(phoneNumber, userDetails, temporaryPassword) {
    try {
      const { firstName, email, whatsappPhone } = userDetails;
      
      const message = `✅ *PAGO EXITOSO* - Acceso al Portal\n\n` +
        `Hola ${firstName}! Tu permiso está siendo procesado.\n\n` +
        `🔐 *ACCESO AL PORTAL WEB:*\n` +
        `📱 Sitio: permisosdigitales.com.mx\n\n` +
        `Puedes entrar con:\n` +
        `• 📞 Teléfono: ${whatsappPhone}\n` +
        `• 🔑 Contraseña: ${temporaryPassword}\n\n` +
        (email ? `También puedes usar tu email: ${email}\n\n` : '') +
        `💡 *IMPORTANTE:* Guarda este mensaje\n` +
        `⚠️ Cambia tu contraseña al primer acceso\n\n` +
        `🔄 ¿Olvidaste tu contraseña? Escribe "contraseña"\n` +
        `❓ ¿Necesitas ayuda? Escribe "ayuda"`;

      await this.sendMessage(phoneNumber, message);
      
      logger.info('Portal credentials sent via WhatsApp', {
        phoneNumber,
        userEmail: email || 'none',
        hasPassword: !!temporaryPassword
      });

      return true;

    } catch (error) {
      logger.error('Error sending portal credentials via WhatsApp', {
        error: error.message,
        phoneNumber,
        userEmail: userDetails.email || 'none'
      });
      throw error;
    }
  }

  /**
   * Send password reset confirmation
   */
  async sendPasswordReset(phoneNumber, firstName, newPassword) {
    try {
      const message = `🔑 *NUEVA CONTRASEÑA*\n\n` +
        `Hola ${firstName}!\n\n` +
        `Tu nueva contraseña es:\n` +
        `*${newPassword}*\n\n` +
        `🔐 Úsala para entrar en:\n` +
        `permisosdigitales.com.mx\n\n` +
        `💡 Puedes entrar con tu teléfono o email\n` +
        `⚠️ Te recomendamos cambiarla al iniciar sesión\n\n` +
        `¿Necesitas ayuda? Escribe "ayuda"`;

      await this.sendMessage(phoneNumber, message);
      
      logger.info('Password reset sent via WhatsApp', {
        phoneNumber,
        firstName
      });

      return true;

    } catch (error) {
      logger.error('Error sending password reset via WhatsApp', {
        error: error.message,
        phoneNumber,
        firstName
      });
      throw error;
    }
  }

  /**
   * Send payment success notification with portal access
   */
  async sendPaymentSuccess(phoneNumber, firstName, applicationId, hasPortalAccess = false) {
    try {
      let message = `💳 *PAGO CONFIRMADO*\n\n` +
        `Hola ${firstName}!\n\n` +
        `✅ Tu pago fue procesado exitosamente\n` +
        `📋 Folio: ${applicationId}\n` +
        `⏳ Tu permiso está siendo generado\n\n` +
        `📬 Te notificaremos cuando esté listo\n`;

      if (hasPortalAccess) {
        message += `\n🔐 También puedes revisar en:\n` +
          `permisosdigitales.com.mx\n\n`;
      }

      message += `❓ ¿Necesitas ayuda? Escribe "ayuda"`;

      await this.sendMessage(phoneNumber, message);
      
      logger.info('Payment success notification sent via WhatsApp', {
        phoneNumber,
        applicationId,
        hasPortalAccess
      });

      return true;

    } catch (error) {
      logger.error('Error sending payment success notification via WhatsApp', {
        error: error.message,
        phoneNumber,
        applicationId
      });
      throw error;
    }
  }

  /**
   * Send permit ready notification
   */
  async sendPermitReady(phoneNumber, firstName, applicationId, downloadUrl) {
    try {
      const message = `🎉 *PERMISO LISTO*\n\n` +
        `Hola ${firstName}!\n\n` +
        `✅ Tu permiso digital está listo\n` +
        `📋 Folio: ${applicationId}\n\n` +
        `📥 *DESCARGAR:*\n` +
        `${downloadUrl}\n\n` +
        `📱 También disponible en:\n` +
        `permisosdigitales.com.mx\n\n` +
        `🔄 Para renovar, escribe "renovar"\n` +
        `❓ ¿Necesitas ayuda? Escribe "ayuda"`;

      await this.sendMessage(phoneNumber, message);
      
      logger.info('Permit ready notification sent via WhatsApp', {
        phoneNumber,
        applicationId
      });

      return true;

    } catch (error) {
      logger.error('Error sending permit ready notification via WhatsApp', {
        error: error.message,
        phoneNumber,
        applicationId
      });
      throw error;
    }
  }

  /**
   * Core message sending functionality
   */
  async sendMessage(phoneNumber, message) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      
      const payload = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        text: { body: message },
        type: 'text'
      };

      const response = await axios.post(this.config.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.messages) {
        logger.debug('WhatsApp message sent successfully', {
          to: normalizedPhone,
          messageId: response.data.messages[0].id
        });
        return response.data.messages[0].id;
      } else {
        throw new Error('Invalid response from WhatsApp API');
      }

    } catch (error) {
      logger.error('Failed to send WhatsApp message', {
        error: error.message,
        phoneNumber,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Normalize phone number to WhatsApp format
   */
  normalizePhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Remove all non-numeric characters
    const cleaned = phoneNumber.toString().replace(/[^\d]/g, '');
    
    // If already in 521 format, return as-is
    if (cleaned.startsWith('521') && cleaned.length === 13) {
      return cleaned;
    }
    
    // If starts with 52 (10 digits), convert to 521
    if (cleaned.startsWith('52') && cleaned.length === 12) {
      return '521' + cleaned.slice(2);
    }
    
    // If just 10 digits, add 521 prefix
    if (cleaned.length === 10) {
      return '521' + cleaned;
    }
    
    // Return original if can't normalize
    return cleaned;
  }

  /**
   * Check if WhatsApp service is configured
   */
  isConfigured() {
    return !!(this.config.phoneNumberId && this.config.accessToken);
  }
}

module.exports = new WhatsAppNotificationService();