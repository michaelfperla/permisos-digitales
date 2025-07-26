/**
 * WhatsApp Cloud API Client Service
 * Handles all direct communication with Meta's WhatsApp Business API
 * Adapted from chambabot's architecture for Permisos Digitales
 */

const axios = require('axios');
const FormData = require('form-data');
const { logger } = require('../../utils/logger');
const redisClient = require('../../utils/redis-client');
const { RateLimiterRedis } = require('rate-limiter-flexible');

class WhatsAppClientService {
  constructor() {
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v17.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    
    // Initialize rate limiters
    this.initializeRateLimiters();
  }

  initializeRateLimiters() {
    // Per-phone rate limiter (50 messages per hour)
    this.phoneRateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'whatsapp_phone_rl',
      points: 50,
      duration: 3600, // 1 hour
    });

    // Global rate limiter (1000 messages per hour)
    this.globalRateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'whatsapp_global_rl',
      points: 1000,
      duration: 3600,
    });
  }

  /**
   * Send a text message via WhatsApp
   * @param {string} to - Recipient phone number
   * @param {string} message - Message content
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} WhatsApp API response
   */
  async sendTextMessage(to, message, options = {}) {
    try {
      // Check rate limits
      await this.checkRateLimits(to);

      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.normalizePhoneNumber(to),
        type: 'text',
        text: {
          preview_url: options.previewUrl || false,
          body: message
        }
      };

      // Add context if replying to a message
      if (options.replyToMessageId) {
        payload.context = {
          message_id: options.replyToMessageId
        };
      }

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('WhatsApp message sent successfully', {
        to,
        messageId: response.data.messages[0].id,
        status: response.data.messages[0].message_status
      });

      return response.data;
    } catch (error) {
      logger.error('Error sending WhatsApp message', {
        error: error.message,
        to,
        response: error.response?.data
      });
      throw this.handleApiError(error);
    }
  }

  /**
   * Send a message with interactive buttons
   * @param {string} to - Recipient phone number
   * @param {string} body - Message body
   * @param {Array} buttons - Array of button objects
   * @returns {Promise<Object>} WhatsApp API response
   */
  async sendInteractiveButtons(to, body, buttons, header = null) {
    try {
      await this.checkRateLimits(to);

      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.normalizePhoneNumber(to),
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: body
          },
          action: {
            buttons: buttons.map((btn, index) => ({
              type: 'reply',
              reply: {
                id: btn.id || `btn_${index}`,
                title: btn.title.substring(0, 20) // WhatsApp limit
              }
            }))
          }
        }
      };

      if (header) {
        payload.interactive.header = {
          type: 'text',
          text: header
        };
      }

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error sending interactive message', {
        error: error.message,
        to
      });
      throw this.handleApiError(error);
    }
  }

  /**
   * Send a document (PDF permit)
   * @param {string} to - Recipient phone number
   * @param {string} documentUrl - URL of the document
   * @param {string} caption - Document caption
   * @param {string} filename - Document filename
   * @returns {Promise<Object>} WhatsApp API response
   */
  async sendDocument(to, documentUrl, caption, filename) {
    try {
      await this.checkRateLimits(to);

      // First, upload the document to WhatsApp
      const mediaId = await this.uploadMedia(documentUrl, 'application/pdf');

      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.normalizePhoneNumber(to),
        type: 'document',
        document: {
          id: mediaId,
          caption: caption,
          filename: filename
        }
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info('Document sent successfully', {
        to,
        filename,
        messageId: response.data.messages[0].id
      });

      return response.data;
    } catch (error) {
      logger.error('Error sending document', {
        error: error.message,
        to,
        documentUrl
      });
      throw this.handleApiError(error);
    }
  }

  /**
   * Upload media to WhatsApp
   * @param {string} mediaUrl - URL of the media
   * @param {string} mimeType - MIME type of the media
   * @returns {Promise<string>} Media ID
   */
  async uploadMedia(mediaUrl, mimeType) {
    try {
      // Download the file
      const response = await axios.get(mediaUrl, {
        responseType: 'stream'
      });

      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('type', mimeType);
      form.append('file', response.data, {
        contentType: mimeType
      });

      const uploadUrl = `${this.baseUrl}/${this.phoneNumberId}/media`;
      
      const uploadResponse = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      return uploadResponse.data.id;
    } catch (error) {
      logger.error('Error uploading media', {
        error: error.message,
        mediaUrl
      });
      throw error;
    }
  }

  /**
   * Download media from WhatsApp (for voice messages)
   * @param {string} mediaId - WhatsApp media ID
   * @returns {Promise<Buffer>} Media buffer
   */
  async downloadMedia(mediaId) {
    try {
      // Get media URL
      const urlResponse = await axios.get(
        `${this.baseUrl}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      // Download media
      const mediaResponse = await axios.get(urlResponse.data.url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        responseType: 'arraybuffer'
      });

      return Buffer.from(mediaResponse.data);
    } catch (error) {
      logger.error('Error downloading media', {
        error: error.message,
        mediaId
      });
      throw error;
    }
  }

  /**
   * Mark message as read
   * @param {string} messageId - WhatsApp message ID
   * @returns {Promise<Object>} API response
   */
  async markAsRead(messageId) {
    try {
      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      
      const payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error marking message as read', {
        error: error.message,
        messageId
      });
      // Don't throw - this is not critical
    }
  }

  /**
   * Normalize phone number for WhatsApp
   * @param {string} phoneNumber - Phone number to normalize
   * @returns {string} Normalized phone number
   */
  normalizePhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    let normalized = phoneNumber.replace(/\D/g, '');
    
    // Handle Mexican numbers (remove extra 1 after 52)
    if (normalized.startsWith('521') && normalized.length === 13) {
      normalized = '52' + normalized.substring(3);
    }
    
    // Ensure it starts with country code
    if (!normalized.startsWith('52') && normalized.length === 10) {
      normalized = '52' + normalized;
    }
    
    return normalized;
  }

  /**
   * Check rate limits before sending message
   * @param {string} phoneNumber - Recipient phone number
   * @throws {Error} If rate limit exceeded
   */
  async checkRateLimits(phoneNumber) {
    try {
      // Check per-phone rate limit
      await this.phoneRateLimiter.consume(phoneNumber);
      
      // Check global rate limit
      await this.globalRateLimiter.consume('global');
    } catch (error) {
      if (error.remainingPoints !== undefined) {
        const resetTime = new Date(Date.now() + error.msBeforeNext);
        throw new Error(`Rate limit exceeded. Try again at ${resetTime.toLocaleTimeString()}`);
      }
      throw error;
    }
  }

  /**
   * Handle WhatsApp API errors
   * @param {Error} error - Axios error
   * @returns {Error} Formatted error
   */
  handleApiError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 429) {
        return new Error('WhatsApp API rate limit exceeded. Please try again later.');
      }
      
      if (data?.error?.message) {
        return new Error(`WhatsApp API Error: ${data.error.message}`);
      }
      
      return new Error(`WhatsApp API Error: ${status} - ${JSON.stringify(data)}`);
    }
    
    return error;
  }

  /**
   * Validate webhook signature from WhatsApp
   * @param {string} signature - X-Hub-Signature-256 header
   * @param {string} body - Request body
   * @returns {boolean} Whether signature is valid
   */
  validateWebhookSignature(signature, body) {
    const crypto = require('crypto');
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    
    if (!appSecret || !signature) {
      return false;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(body)
      .digest('hex');
    
    return `sha256=${expectedSignature}` === signature;
  }
}

module.exports = WhatsAppClientService;