/**
 * Admin WhatsApp Monitoring Routes
 * Provides endpoints for WhatsApp message monitoring interface
 */

const express = require('express');
const adminWhatsAppMonitoringController = require('../controllers/admin-whatsapp-monitoring.controller');
const { isAuthenticated, isAdminPortal } = require('../middleware/auth.middleware');
const rateLimiters = require('../middleware/rate-limit.middleware');

const router = express.Router();

// All WhatsApp monitoring routes require admin authentication
router.use(isAuthenticated, isAdminPortal);

// Apply rate limiting for admin endpoints
router.use(rateLimiters.admin);

/**
 * @route GET /admin/whatsapp/messages
 * @desc Get WhatsApp messages with filtering and pagination
 * @access Admin
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 50, max: 100)
 * @query {string} direction - Message direction: 'incoming', 'outgoing', 'all'
 * @query {string} conversation_id - Filter by conversation ID
 * @query {string} phone_number - Filter by phone number
 * @query {string} date_from - Start date (ISO string)
 * @query {string} date_to - End date (ISO string)
 * @query {string} message_type - Message type: 'text', 'audio', 'image', etc.
 * @query {boolean} has_sensitive_data - Filter by sensitive data presence
 * @query {string} search - Search in message content, user name, or intent
 */
router.get('/messages', adminWhatsAppMonitoringController.getMessages);

/**
 * @route GET /admin/whatsapp/conversations
 * @desc Get WhatsApp conversations with summary information
 * @access Admin
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 20, max: 50)
 * @query {boolean} is_active - Filter by active status
 * @query {boolean} has_application - Filter by application presence
 * @query {string} search - Search in phone number or user name
 * @query {string} sort_by - Sort column: 'last_activity_at', 'created_at', 'total_messages'
 * @query {string} sort_order - Sort order: 'asc', 'desc'
 */
router.get('/conversations', adminWhatsAppMonitoringController.getConversations);

/**
 * @route GET /admin/whatsapp/conversations/:conversationId
 * @desc Get detailed conversation with message history
 * @access Admin
 * @param {string} conversationId - Conversation identifier
 * @query {number} limit - Maximum messages to return (default: 100)
 */
router.get('/conversations/:conversationId', adminWhatsAppMonitoringController.getConversationDetails);

/**
 * @route GET /admin/whatsapp/statistics
 * @desc Get WhatsApp monitoring statistics
 * @access Admin
 * @query {string} period - Time period: '1h', '24h', '7d', '30d'
 */
router.get('/statistics', adminWhatsAppMonitoringController.getStatistics);

/**
 * @route GET /admin/whatsapp/stream
 * @desc Server-Sent Events endpoint for real-time message updates
 * @access Admin
 * @description Establishes SSE connection for real-time WhatsApp message monitoring
 */
router.get('/stream', adminWhatsAppMonitoringController.streamMessages);

module.exports = router;
