const { logger } = require('../utils/logger');
const applicationService = require('../services/application.service');
const securityService = require('../services/security.service');
const ApiResponse = require('../utils/api-response');
const unifiedConfig = require('../config/unified-config');
const config = unifiedConfig.getSync();

exports.processExpiringOxxoPayments = async (req, res, next) => {
  try {
    const { hours = 24, apiKey } = req.query;

    if (!apiKey || apiKey !== config.internalApiKey) {
      logger.warn('Unauthorized attempt to access notification endpoint', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      await securityService.logActivity(
        null,
        'unauthorized_notification_access',
        req.ip,
        req.headers['user-agent'],
        { endpoint: 'processExpiringOxxoPayments' }
      );

      return ApiResponse.unauthorized(res);
    }

    const hoursUntilExpiration = parseInt(hours, 10);

    if (isNaN(hoursUntilExpiration) || hoursUntilExpiration < 1 || hoursUntilExpiration > 72) {
      return ApiResponse.badRequest(res, 'Invalid hours parameter. Must be between 1 and 72.');
    }

    const result = await applicationService.notifyExpiringOxxoPayments(hoursUntilExpiration);

    return ApiResponse.success(res, result);
  } catch (error) {
    logger.error('Error processing expiring OXXO payments:', error);
    return ApiResponse.error(res, 'Error processing expiring OXXO payments', 500);
  }
};

exports.processExpiringPermits = async (req, res, next) => {
  try {
    const { days = 5, apiKey } = req.query;

    if (!apiKey || apiKey !== config.internalApiKey) {
      logger.warn('Unauthorized attempt to access notification endpoint', {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      await securityService.logActivity(
        null,
        'unauthorized_notification_access',
        req.ip,
        req.headers['user-agent'],
        { endpoint: 'processExpiringPermits' }
      );

      return ApiResponse.unauthorized(res);
    }

    const daysUntilExpiration = parseInt(days, 10);

    if (isNaN(daysUntilExpiration) || daysUntilExpiration < 1 || daysUntilExpiration > 30) {
      return ApiResponse.badRequest(res, 'Invalid days parameter. Must be between 1 and 30.');
    }

    const result = await applicationService.notifyExpiringPermits(daysUntilExpiration);

    return ApiResponse.success(res, result);
  } catch (error) {
    logger.error('Error processing expiring permits:', error);
    return ApiResponse.error(res, 'Error processing expiring permits', 500);
  }
};
