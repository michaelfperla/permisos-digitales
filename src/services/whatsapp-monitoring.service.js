/**
 * WhatsApp Monitoring Service
 * Handles message logging and monitoring for admin interface
 */

const { logger } = require('../utils/logger');
const db = require('../db');
const { sanitizeForDisplay, detectSensitiveData } = require('../utils/data-sanitizer');

class WhatsAppMonitoringService {
  constructor() {
    this.eventEmitter = require('events');
    this.emitter = new this.eventEmitter();
    this.maxListeners = 100;
    this.emitter.setMaxListeners(this.maxListeners);
  }

  /**
   * Log incoming WhatsApp message
   */
  async logIncomingMessage(messageData) {
    try {
      // Check if monitoring tables exist before attempting to log
      if (!(await this.ensureTablesExist())) {
        logger.warn('WhatsApp monitoring tables not available, skipping message logging');
        return null;
      }
      const {
        messageId,
        from,
        messageType = 'text',
        content,
        timestamp,
        userContext = {}
      } = messageData;

      // Sanitize content for storage
      const sanitizedContent = this.sanitizeMessageContent(content, messageType);
      const containsSensitiveData = detectSensitiveData(content);

      // Create conversation ID (normalized phone number)
      const conversationId = this.normalizePhoneNumber(from);

      const messageLog = {
        message_id: messageId,
        conversation_id: conversationId,
        direction: 'incoming',
        message_type: messageType,
        message_preview: sanitizedContent.preview,
        message_length: content ? content.length : 0,
        contains_sensitive_data: containsSensitiveData,
        user_id: userContext.userId || null,
        phone_number: from,
        user_name: userContext.userName || null,
        conversation_state: userContext.state || null,
        intent: userContext.intent || null,
        metadata: {
          originalTimestamp: timestamp,
          userAgent: userContext.userAgent,
          sessionId: userContext.sessionId
        },
        processing_status: 'received',
        user_consented: userContext.hasConsent || false,
        consent_date: userContext.consentDate || null,
        message_timestamp: new Date(timestamp || Date.now()),
        created_at: new Date()
      };

      // Insert message log
      const result = await db.query(`
        INSERT INTO whatsapp_message_logs (
          message_id, conversation_id, direction, message_type, message_preview,
          message_length, contains_sensitive_data, user_id, phone_number, user_name,
          conversation_state, intent, metadata, processing_status, user_consented,
          consent_date, message_timestamp, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) RETURNING id
      `, [
        messageLog.message_id, messageLog.conversation_id, messageLog.direction,
        messageLog.message_type, messageLog.message_preview, messageLog.message_length,
        messageLog.contains_sensitive_data, messageLog.user_id, messageLog.phone_number,
        messageLog.user_name, messageLog.conversation_state, messageLog.intent,
        JSON.stringify(messageLog.metadata), messageLog.processing_status,
        messageLog.user_consented, messageLog.consent_date, messageLog.message_timestamp,
        messageLog.created_at
      ]);

      const logId = result.rows[0].id;

      // Update conversation summary
      await this.updateConversationSummary(conversationId, from, userContext, 'incoming');

      // Emit real-time event for admin interface
      this.emitMessageEvent('message_received', {
        id: logId,
        ...messageLog,
        sanitizedContent: sanitizedContent
      });

      logger.info('WhatsApp incoming message logged', {
        messageId,
        conversationId,
        messageType,
        containsSensitiveData
      });

      return logId;

    } catch (error) {
      logger.error('Error logging incoming WhatsApp message:', error);
      // Don't throw error to prevent breaking the main WhatsApp flow
      return null;
    }
  }

  /**
   * Log outgoing WhatsApp message
   */
  async logOutgoingMessage(messageData) {
    try {
      // Check if monitoring tables exist before attempting to log
      if (!(await this.ensureTablesExist())) {
        logger.warn('WhatsApp monitoring tables not available, skipping message logging');
        return null;
      }
      const {
        messageId,
        to,
        messageType = 'text',
        content,
        timestamp,
        status = 'sent',
        userContext = {}
      } = messageData;

      const sanitizedContent = this.sanitizeMessageContent(content, messageType);
      const conversationId = this.normalizePhoneNumber(to);

      const messageLog = {
        message_id: messageId,
        conversation_id: conversationId,
        direction: 'outgoing',
        message_type: messageType,
        message_preview: sanitizedContent.preview,
        message_length: content ? content.length : 0,
        contains_sensitive_data: false, // Outgoing messages shouldn't contain sensitive user data
        user_id: userContext.userId || null,
        phone_number: to,
        user_name: userContext.userName || null,
        conversation_state: userContext.state || null,
        intent: userContext.intent || 'bot_response',
        metadata: {
          originalTimestamp: timestamp,
          status: status,
          botVersion: userContext.botVersion
        },
        processing_status: 'completed',
        user_consented: userContext.hasConsent || false,
        consent_date: userContext.consentDate || null,
        message_timestamp: new Date(timestamp || Date.now()),
        processed_at: new Date(),
        created_at: new Date()
      };

      // Insert message log
      const result = await db.query(`
        INSERT INTO whatsapp_message_logs (
          message_id, conversation_id, direction, message_type, message_preview,
          message_length, contains_sensitive_data, user_id, phone_number, user_name,
          conversation_state, intent, metadata, processing_status, user_consented,
          consent_date, message_timestamp, processed_at, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        ) RETURNING id
      `, [
        messageLog.message_id, messageLog.conversation_id, messageLog.direction,
        messageLog.message_type, messageLog.message_preview, messageLog.message_length,
        messageLog.contains_sensitive_data, messageLog.user_id, messageLog.phone_number,
        messageLog.user_name, messageLog.conversation_state, messageLog.intent,
        JSON.stringify(messageLog.metadata), messageLog.processing_status,
        messageLog.user_consented, messageLog.consent_date, messageLog.message_timestamp,
        messageLog.processed_at, messageLog.created_at
      ]);

      const logId = result.rows[0].id;

      // Update conversation summary
      await this.updateConversationSummary(conversationId, to, userContext, 'outgoing');

      // Emit real-time event
      this.emitMessageEvent('message_sent', {
        id: logId,
        ...messageLog,
        sanitizedContent: sanitizedContent
      });

      return logId;

    } catch (error) {
      logger.error('Error logging outgoing WhatsApp message:', error);
      // Don't throw error to prevent breaking the main WhatsApp flow
      return null;
    }
  }

  /**
   * Update conversation summary
   */
  async updateConversationSummary(conversationId, phoneNumber, userContext, direction) {
    try {
      const now = new Date();
      
      // Upsert conversation summary
      await db.query(`
        INSERT INTO whatsapp_conversations (
          conversation_id, phone_number, user_id, user_name, total_messages,
          incoming_messages, outgoing_messages, first_message_at, last_message_at,
          last_activity_at, current_state, last_intent, is_active, application_id,
          user_consented, consent_date, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 1, $5, $6, $7, $7, $7, $8, $9, true, $10, $11, $12, $7, $7
        )
        ON CONFLICT (conversation_id) DO UPDATE SET
          total_messages = whatsapp_conversations.total_messages + 1,
          incoming_messages = whatsapp_conversations.incoming_messages + $5,
          outgoing_messages = whatsapp_conversations.outgoing_messages + $6,
          last_message_at = $7,
          last_activity_at = $7,
          current_state = COALESCE($8, whatsapp_conversations.current_state),
          last_intent = COALESCE($9, whatsapp_conversations.last_intent),
          is_active = true,
          user_id = COALESCE($3, whatsapp_conversations.user_id),
          user_name = COALESCE($4, whatsapp_conversations.user_name),
          application_id = COALESCE($10, whatsapp_conversations.application_id),
          user_consented = COALESCE($11, whatsapp_conversations.user_consented),
          consent_date = COALESCE($12, whatsapp_conversations.consent_date),
          updated_at = $7
      `, [
        conversationId,
        phoneNumber,
        userContext.userId || null,
        userContext.userName || null,
        direction === 'incoming' ? 1 : 0,
        direction === 'outgoing' ? 1 : 0,
        now,
        userContext.state || null,
        userContext.intent || null,
        userContext.applicationId || null,
        userContext.hasConsent || false,
        userContext.consentDate || null
      ]);

    } catch (error) {
      logger.error('Error updating conversation summary:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Sanitize message content for display
   */
  sanitizeMessageContent(content, messageType) {
    if (!content) {
      return { preview: `[${messageType} message]`, isSanitized: true };
    }

    if (messageType !== 'text') {
      return { preview: `[${messageType} message]`, isSanitized: true };
    }

    // Create safe preview (first 100 characters)
    const preview = sanitizeForDisplay(content, 100);
    
    return {
      preview,
      isSanitized: preview !== content,
      originalLength: content.length
    };
  }

  /**
   * Normalize phone number for consistent conversation IDs
   */
  normalizePhoneNumber(phoneNumber) {
    // Remove all non-digits and ensure consistent format
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Handle Mexican numbers (add 52 if missing)
    if (digits.length === 10) {
      return `52${digits}`;
    }
    
    return digits;
  }

  /**
   * Emit real-time event for admin interface
   */
  emitMessageEvent(eventType, data) {
    try {
      this.emitter.emit('whatsapp_message', {
        type: eventType,
        timestamp: new Date().toISOString(),
        data
      });
    } catch (error) {
      logger.error('Error emitting WhatsApp message event:', error);
    }
  }

  /**
   * Subscribe to real-time message events
   */
  onMessageEvent(callback) {
    this.emitter.on('whatsapp_message', callback);
  }

  /**
   * Unsubscribe from real-time message events
   */
  offMessageEvent(callback) {
    this.emitter.off('whatsapp_message', callback);
  }

  /**
   * Check if monitoring tables exist in database
   * @returns {Promise<boolean>}
   */
  async ensureTablesExist() {
    try {
      const result = await db.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('whatsapp_message_logs', 'whatsapp_conversations', 'whatsapp_monitoring_settings')
      `);

      const existingTables = result.rows.map(row => row.table_name);
      const requiredTables = ['whatsapp_message_logs', 'whatsapp_conversations', 'whatsapp_monitoring_settings'];

      const allTablesExist = requiredTables.every(table => existingTables.includes(table));

      if (!allTablesExist) {
        logger.warn('WhatsApp monitoring tables missing:', {
          required: requiredTables,
          existing: existingTables,
          missing: requiredTables.filter(table => !existingTables.includes(table))
        });
      }

      return allTablesExist;

    } catch (error) {
      logger.error('Error checking WhatsApp monitoring tables:', error);
      return false;
    }
  }
}

module.exports = new WhatsAppMonitoringService();
