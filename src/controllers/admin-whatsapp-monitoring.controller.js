/**
 * Admin WhatsApp Monitoring Controller
 * Handles admin interface for WhatsApp message monitoring
 */

const { logger } = require('../utils/logger');
const apiResponse = require('../utils/api-response');
const db = require('../db');
const whatsappMonitoringService = require('../services/whatsapp-monitoring.service');
const { createSafePreview, maskPhoneNumber } = require('../utils/data-sanitizer');

class AdminWhatsAppMonitoringController {
  /**
   * Get recent WhatsApp messages with filtering
   */
  async getMessages(req, res) {
    try {
      // Return mock data temporarily to avoid database issues
      const {
        page = 1,
        limit = 50
      } = req.query;

      // Validate admin permissions
      const adminLevel = this.getAdminLevel(req.session);

      return res.json({
        success: true,
        data: {
          messages: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
          adminLevel
        }
      });
      const canViewSensitiveData = adminLevel === 'super';

      // Build query conditions
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      // Direction filter
      if (direction !== 'all') {
        conditions.push(`direction = $${paramIndex}`);
        params.push(direction);
        paramIndex++;
      }

      // Conversation filter
      if (conversation_id) {
        conditions.push(`conversation_id = $${paramIndex}`);
        params.push(conversation_id);
        paramIndex++;
      }

      // Phone number filter
      if (phone_number) {
        conditions.push(`phone_number = $${paramIndex}`);
        params.push(phone_number);
        paramIndex++;
      }

      // Date range filter
      if (date_from) {
        conditions.push(`message_timestamp >= $${paramIndex}`);
        params.push(new Date(date_from));
        paramIndex++;
      }

      if (date_to) {
        conditions.push(`message_timestamp <= $${paramIndex}`);
        params.push(new Date(date_to));
        paramIndex++;
      }

      // Message type filter
      if (message_type !== 'all') {
        conditions.push(`message_type = $${paramIndex}`);
        params.push(message_type);
        paramIndex++;
      }

      // Sensitive data filter
      if (has_sensitive_data !== null) {
        conditions.push(`contains_sensitive_data = $${paramIndex}`);
        params.push(has_sensitive_data === 'true');
        paramIndex++;
      }

      // Search filter
      if (search) {
        conditions.push(`(message_preview ILIKE $${paramIndex} OR user_name ILIKE $${paramIndex} OR intent ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Build WHERE clause
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM whatsapp_message_logs
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Get messages
      const messagesQuery = `
        SELECT 
          id,
          message_id,
          conversation_id,
          direction,
          message_type,
          message_preview,
          message_length,
          contains_sensitive_data,
          user_id,
          phone_number,
          user_name,
          conversation_state,
          intent,
          metadata,
          processing_status,
          processing_error,
          user_consented,
          consent_date,
          message_timestamp,
          processed_at,
          created_at
        FROM whatsapp_message_logs
        ${whereClause}
        ORDER BY message_timestamp DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(limit, offset);
      const messagesResult = await db.query(messagesQuery, params);

      // Process messages for display
      const messages = messagesResult.rows.map(message => {
        const safePreview = createSafePreview(message.message_preview, {
          maxLength: 150,
          showSensitiveData: canViewSensitiveData && message.user_consented,
          adminLevel
        });

        return {
          id: message.id,
          messageId: message.message_id,
          conversationId: message.conversation_id,
          direction: message.direction,
          messageType: message.message_type,
          preview: safePreview.preview,
          messageLength: message.message_length,
          hasSensitiveData: message.contains_sensitive_data,
          userId: message.user_id,
          phoneNumber: maskPhoneNumber(message.phone_number),
          userName: message.user_name,
          conversationState: message.conversation_state,
          intent: message.intent,
          processingStatus: message.processing_status,
          processingError: message.processing_error,
          userConsented: message.user_consented,
          consentDate: message.consent_date,
          messageTimestamp: message.message_timestamp,
          processedAt: message.processed_at,
          createdAt: message.created_at,
          privacyInfo: {
            canViewFull: canViewSensitiveData && message.user_consented,
            sanitizationLevel: safePreview.sanitizationLevel,
            isTruncated: safePreview.isTruncated
          }
        };
      });

      return apiResponse.success(res, {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          direction,
          conversation_id,
          phone_number,
          date_from,
          date_to,
          message_type,
          has_sensitive_data,
          search
        },
        adminLevel
      }, 'Messages retrieved successfully');

    } catch (error) {
      logger.error('Error getting WhatsApp messages:', error);
      return apiResponse.error(res, 'Failed to retrieve messages', 500);
    }
  }

  /**
   * Get conversation list with summary
   */
  async getConversations(req, res) {
    try {
      // Return mock data temporarily
      const {
        page = 1,
        limit = 20
      } = req.query;

      const adminLevel = this.getAdminLevel(req.session);

      return res.json({
        success: true,
        data: {
          conversations: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0,
          adminLevel
        }
      });

    } catch (error) {
      logger.error('Error getting conversations:', error);
      return apiResponse.error(res, 'Failed to retrieve conversations', 500);
    }
  }

  /**
   * Get conversation list with full implementation
   */
  async getConversationsFullImplementation(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        is_active = null,
        has_application = null,
        search = null,
        sort_by = 'last_activity_at',
        sort_order = 'desc'
      } = req.query;

      const adminLevel = this.getAdminLevel(req.session);

      // Build query conditions
      const conditions = [];
      const params = [];
      let paramIndex = 1;

      if (is_active !== null) {
        conditions.push(`is_active = $${paramIndex}`);
        params.push(is_active === 'true');
        paramIndex++;
      }

      if (has_application !== null) {
        if (has_application === 'true') {
          conditions.push(`application_id IS NOT NULL`);
        } else {
          conditions.push(`application_id IS NULL`);
        }
      }

      if (search) {
        conditions.push(`(phone_number ILIKE $${paramIndex} OR user_name ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM whatsapp_conversations ${whereClause}`;
      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Validate sort parameters
      const validSortColumns = ['last_activity_at', 'created_at', 'total_messages', 'phone_number'];
      const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'last_activity_at';
      const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      // Get conversations
      const conversationsQuery = `
        SELECT 
          c.*,
          u.first_name,
          u.last_name,
          u.account_email,
          pa.status as application_status,
          pa.vehicle_brand,
          pa.vehicle_model
        FROM whatsapp_conversations c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN permit_applications pa ON c.application_id = pa.id
        ${whereClause}
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);
      const conversationsResult = await db.query(conversationsQuery, params);

      // Process conversations for display
      const conversations = conversationsResult.rows.map(conv => ({
        id: conv.id,
        conversationId: conv.conversation_id,
        phoneNumber: maskPhoneNumber(conv.phone_number),
        userId: conv.user_id,
        userName: conv.user_name || `${conv.first_name || ''} ${conv.last_name || ''}`.trim(),
        userEmail: conv.account_email,
        totalMessages: conv.total_messages,
        incomingMessages: conv.incoming_messages,
        outgoingMessages: conv.outgoing_messages,
        firstMessageAt: conv.first_message_at,
        lastMessageAt: conv.last_message_at,
        lastActivityAt: conv.last_activity_at,
        currentState: conv.conversation_state,
        lastIntent: conv.last_intent,
        isActive: conv.is_active,
        isCompleted: conv.is_completed,
        applicationId: conv.application_id,
        applicationStatus: conv.application_status,
        vehicleInfo: conv.vehicle_brand && conv.vehicle_model ? 
          `${conv.vehicle_brand} ${conv.vehicle_model}` : null,
        userConsented: conv.user_consented,
        consentDate: conv.consent_date,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at
      }));

      return apiResponse.success(res, {
        conversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          is_active,
          has_application,
          search,
          sort_by: sortColumn,
          sort_order: sortDirection
        },
        adminLevel
      }, 'Conversations retrieved successfully');

    } catch (error) {
      logger.error('Error getting WhatsApp conversations:', error);
      return apiResponse.error(res, 'Failed to retrieve conversations', 500);
    }
  }

  /**
   * Get conversation details with message history
   */
  async getConversationDetails(req, res) {
    try {
      const { conversationId } = req.params;
      const { limit = 100 } = req.query;

      const adminLevel = this.getAdminLevel(req.session);
      const canViewSensitiveData = adminLevel === 'super';

      // Get conversation summary
      const conversationQuery = `
        SELECT c.*, u.first_name, u.last_name, u.account_email
        FROM whatsapp_conversations c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.conversation_id = $1
      `;
      const conversationResult = await db.query(conversationQuery, [conversationId]);

      if (conversationResult.rows.length === 0) {
        return apiResponse.notFound(res, 'Conversation not found');
      }

      const conversation = conversationResult.rows[0];

      // Get message history
      const messagesQuery = `
        SELECT *
        FROM whatsapp_message_logs
        WHERE conversation_id = $1
        ORDER BY message_timestamp ASC
        LIMIT $2
      `;
      const messagesResult = await db.query(messagesQuery, [conversationId, limit]);

      // Process messages
      const messages = messagesResult.rows.map(message => {
        const safePreview = createSafePreview(message.message_preview, {
          maxLength: 500,
          showSensitiveData: canViewSensitiveData && message.user_consented,
          adminLevel
        });

        return {
          id: message.id,
          messageId: message.message_id,
          direction: message.direction,
          messageType: message.message_type,
          content: safePreview.preview,
          messageLength: message.message_length,
          hasSensitiveData: message.contains_sensitive_data,
          conversationState: message.conversation_state,
          intent: message.intent,
          processingStatus: message.processing_status,
          messageTimestamp: message.message_timestamp,
          createdAt: message.created_at,
          privacyInfo: {
            canViewFull: canViewSensitiveData && message.user_consented,
            sanitizationLevel: safePreview.sanitizationLevel,
            isTruncated: safePreview.isTruncated
          }
        };
      });

      return apiResponse.success(res, {
        conversation: {
          id: conversation.id,
          conversationId: conversation.conversation_id,
          phoneNumber: maskPhoneNumber(conversation.phone_number),
          userId: conversation.user_id,
          userName: conversation.user_name || `${conversation.first_name || ''} ${conversation.last_name || ''}`.trim(),
          userEmail: conversation.account_email,
          totalMessages: conversation.total_messages,
          incomingMessages: conversation.incoming_messages,
          outgoingMessages: conversation.outgoing_messages,
          firstMessageAt: conversation.first_message_at,
          lastMessageAt: conversation.last_message_at,
          lastActivityAt: conversation.last_activity_at,
          currentState: conversation.current_state,
          lastIntent: conversation.last_intent,
          isActive: conversation.is_active,
          isCompleted: conversation.is_completed,
          applicationId: conversation.application_id,
          userConsented: conversation.user_consented,
          consentDate: conversation.consent_date
        },
        messages,
        adminLevel
      }, 'Conversation details retrieved successfully');

    } catch (error) {
      logger.error('Error getting conversation details:', error);
      return apiResponse.error(res, 'Failed to retrieve conversation details', 500);
    }
  }

  /**
   * Get monitoring statistics
   */
  async getStatistics(req, res) {
    try {
      // Return mock statistics temporarily
      const { period = '24h' } = req.query;
      const adminLevel = this.getAdminLevel(req.session);

      return res.json({
        success: true,
        data: {
          period,
          totalMessages: 0,
          incomingMessages: 0,
          outgoingMessages: 0,
          activeConversations: 0,
          completedConversations: 0,
          averageResponseTime: 0,
          messagesByHour: [],
          messagesByType: {
            text: 0,
            audio: 0,
            image: 0,
            document: 0,
            interactive: 0,
            system: 0
          },
          topIntents: [],
          adminLevel
        }
      });
      let startDate;
      
      switch (period) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      // Get message statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE direction = 'incoming') as incoming_messages,
          COUNT(*) FILTER (WHERE direction = 'outgoing') as outgoing_messages,
          COUNT(*) FILTER (WHERE contains_sensitive_data = true) as sensitive_messages,
          COUNT(*) FILTER (WHERE processing_status = 'failed') as failed_messages,
          COUNT(DISTINCT conversation_id) as active_conversations,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users,
          AVG(message_length) FILTER (WHERE message_length > 0) as avg_message_length
        FROM whatsapp_message_logs
        WHERE message_timestamp >= $1
      `;
      const statsResult = await db.query(statsQuery, [startDate]);
      const stats = statsResult.rows[0];

      // Get hourly breakdown for charts
      const hourlyQuery = `
        SELECT 
          DATE_TRUNC('hour', message_timestamp) as hour,
          COUNT(*) as message_count,
          COUNT(*) FILTER (WHERE direction = 'incoming') as incoming_count,
          COUNT(*) FILTER (WHERE direction = 'outgoing') as outgoing_count
        FROM whatsapp_message_logs
        WHERE message_timestamp >= $1
        GROUP BY hour
        ORDER BY hour
      `;
      const hourlyResult = await db.query(hourlyQuery, [startDate]);

      // Get top intents
      const intentsQuery = `
        SELECT 
          intent,
          COUNT(*) as count
        FROM whatsapp_message_logs
        WHERE message_timestamp >= $1 AND intent IS NOT NULL
        GROUP BY intent
        ORDER BY count DESC
        LIMIT 10
      `;
      const intentsResult = await db.query(intentsQuery, [startDate]);

      return apiResponse.success(res, {
        period,
        timeRange: {
          start: startDate.toISOString(),
          end: now.toISOString()
        },
        summary: {
          totalMessages: parseInt(stats.total_messages),
          incomingMessages: parseInt(stats.incoming_messages),
          outgoingMessages: parseInt(stats.outgoing_messages),
          sensitiveMessages: parseInt(stats.sensitive_messages),
          failedMessages: parseInt(stats.failed_messages),
          activeConversations: parseInt(stats.active_conversations),
          uniqueUsers: parseInt(stats.unique_users),
          avgMessageLength: parseFloat(stats.avg_message_length) || 0
        },
        hourlyBreakdown: hourlyResult.rows,
        topIntents: intentsResult.rows
      }, 'Statistics retrieved successfully');

    } catch (error) {
      logger.error('Error getting WhatsApp statistics:', error);
      return apiResponse.error(res, 'Failed to retrieve statistics', 500);
    }
  }

  /**
   * Server-Sent Events endpoint for real-time message updates
   */
  async streamMessages(req, res) {
    try {
      // Simplified SSE endpoint - just send connection established
      const adminLevel = this.getAdminLevel(req.session);

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial connection confirmation
      res.write(`data: ${JSON.stringify({
        type: 'connection',
        timestamp: new Date().toISOString(),
        adminLevel
      })}\n\n`);

      // Set up message event listener
      const messageHandler = (eventData) => {
        try {
          const { type, data } = eventData;

          // Apply privacy filtering based on admin level
          const safeData = this.filterEventDataForAdmin(data, adminLevel);

          const sseData = {
            type,
            timestamp: eventData.timestamp,
            data: safeData
          };

          res.write(`data: ${JSON.stringify(sseData)}\n\n`);
        } catch (error) {
          logger.error('Error sending SSE message:', error);
        }
      };

      // Subscribe to WhatsApp message events
      whatsappMonitoringService.onMessageEvent(messageHandler);

      // Handle client disconnect
      req.on('close', () => {
        whatsappMonitoringService.offMessageEvent(messageHandler);
        logger.info('SSE client disconnected');
      });

      // Keep connection alive with periodic heartbeat
      const heartbeat = setInterval(() => {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString()
          })}\n\n`);
        } catch (error) {
          clearInterval(heartbeat);
        }
      }, 30000); // 30 seconds

      // Clean up on disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
      });

    } catch (error) {
      logger.error('Error setting up SSE stream:', error);
      res.status(500).json({ error: 'Failed to establish real-time connection' });
    }
  }

  /**
   * Filter event data based on admin level
   */
  filterEventDataForAdmin(data, adminLevel) {
    if (!data) return data;

    const canViewSensitiveData = adminLevel === 'super';

    return {
      ...data,
      phoneNumber: maskPhoneNumber(data.phoneNumber),
      sanitizedContent: data.sanitizedContent || data.content,
      // Remove full content if admin can't view sensitive data
      content: (canViewSensitiveData && data.user_consented) ? data.content : undefined,
      privacyInfo: {
        canViewFull: canViewSensitiveData && data.user_consented,
        adminLevel
      }
    };
  }

  /**
   * Get admin level from session
   */
  getAdminLevel(session) {
    // Determine admin level based on session data
    // This should be configured based on your admin role system
    if (session?.role === 'super_admin') {
      return 'super';
    } else if (session?.role === 'senior_admin') {
      return 'senior';
    }
    return 'standard';
  }
}

module.exports = new AdminWhatsAppMonitoringController();
