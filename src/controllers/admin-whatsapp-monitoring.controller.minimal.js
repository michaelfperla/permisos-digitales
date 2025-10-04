/**
 * Admin WhatsApp Monitoring Controller - Minimal Version
 * Returns mock data to avoid database issues
 */

const { logger } = require('../utils/logger');

class AdminWhatsAppMonitoringController {
  /**
   * Get admin permission level from session
   */
  getAdminLevel(req) {
    try {
      if (!req || !req.session) return 'standard';

      const session = req.session;
      if (!session.user && !session.userRole) return 'standard';

      const userRole = session.userRole || (session.user && session.user.role);
      if (userRole === 'super_admin') return 'super';
      if (userRole === 'senior_admin') return 'senior';
      return 'standard';
    } catch (error) {
      logger.error('Error getting admin level:', error);
      return 'standard';
    }
  }

  /**
   * Get WhatsApp messages with filtering and pagination
   */
  async getMessages(req, res) {
    try {
      const {
        page = 1,
        limit = 50
      } = req.query;

      const adminLevel = this.getAdminLevel(req);

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

    } catch (error) {
      logger.error('Error fetching WhatsApp messages:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Get WhatsApp conversations with filtering and pagination
   */
  async getConversations(req, res) {
    try {
      const {
        page = 1,
        limit = 20
      } = req.query;

      const adminLevel = this.getAdminLevel(req);

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
      logger.error('Error fetching WhatsApp conversations:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Get conversation details with message history
   */
  async getConversationDetails(req, res) {
    try {
      const { conversationId } = req.params;
      const adminLevel = this.getAdminLevel(req);

      return res.json({
        success: true,
        data: {
          conversation: {
            id: conversationId,
            phone_number: '521XXXXXXXXXX',
            total_messages: 0,
            is_active: false
          },
          messages: [],
          adminLevel
        }
      });

    } catch (error) {
      logger.error('Error fetching conversation details:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Get WhatsApp monitoring statistics
   */
  async getStatistics(req, res) {
    try {
      const { period = '24h' } = req.query;
      const adminLevel = this.getAdminLevel(req);

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

    } catch (error) {
      logger.error('Error fetching WhatsApp statistics:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  /**
   * Stream real-time WhatsApp messages via Server-Sent Events
   */
  async streamMessages(req, res) {
    try {
      const adminLevel = this.getAdminLevel(req);

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true'
      });

      // Send initial connection event
      res.write(`data: ${JSON.stringify({
        type: 'connection',
        data: { status: 'connected', adminLevel }
      })}\n\n`);

      // Send heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({
          type: 'heartbeat',
          data: { timestamp: new Date().toISOString() }
        })}\n\n`);
      }, 30000);

      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        logger.info('WhatsApp monitoring SSE client disconnected');
      });

    } catch (error) {
      logger.error('Error setting up WhatsApp message stream:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new AdminWhatsAppMonitoringController();
