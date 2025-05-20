/**
 * Notification Controller
 * Handles API endpoints for notifications
 */
const { logger } = require('../utils/enhanced-logger');
const applicationService = require('../services/application.service');
const securityService = require('../services/security.service');
const ApiResponse = require('../utils/api-response');
const config = require('../config');

/**
 * Process expiring OXXO payments and send notifications
 * This endpoint is intended to be called by a scheduled task
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
exports.processExpiringOxxoPayments = async (req, res, next) => {
  try {
    // Extract parameters
    const { hours = 24, apiKey } = req.query;
    
    // Validate API key for security
    if (!apiKey || apiKey !== config.internalApiKey) {
      logger.warn('Unauthorized attempt to access notification endpoint', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Log security event
      await securityService.logActivity(
        null,
        'unauthorized_notification_access',
        req.ip,
        req.headers['user-agent'],
        { endpoint: 'processExpiringOxxoPayments' }
      );
      
      return ApiResponse.unauthorized(res);
    }
    
    // Parse hours parameter
    const hoursUntilExpiration = parseInt(hours, 10);
    
    // Validate hours parameter
    if (isNaN(hoursUntilExpiration) || hoursUntilExpiration < 1 || hoursUntilExpiration > 72) {
      return ApiResponse.badRequest(res, 'Invalid hours parameter. Must be between 1 and 72.');
    }
    
    // Process expiring OXXO payments
    const result = await applicationService.notifyExpiringOxxoPayments(hoursUntilExpiration);
    
    // Return response
    return ApiResponse.success(res, result);
  } catch (error) {
    logger.error('Error processing expiring OXXO payments:', error);
    return ApiResponse.error(res, 'Error processing expiring OXXO payments', 500);
  }
};
