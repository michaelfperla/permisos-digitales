/**
 * Base Controller Class
 * Provides common functionality for all controllers
 */

const { logger } = require('../utils/logger');
const ApiResponse = require('../utils/api-response');

class BaseController {
  constructor() {
    this.logger = logger;
  }

  /**
   * Handle async controller methods with error catching
   * @param {Function} fn - Async controller function
   * @returns {Function} - Express middleware function
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      return Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Send success response
   * @param {object} res - Express response object
   * @param {any} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   */
  sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
    return ApiResponse.success(res, data, message, statusCode);
  }

  /**
   * Send error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {any} details - Additional error details
   */
  sendError(res, message = 'Internal Server Error', statusCode = 500, details = null) {
    return ApiResponse.error(res, message, statusCode, details);
  }

  /**
   * Send validation error response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   * @param {array} errors - Validation errors array
   */
  sendValidationError(res, message = 'Validation Error', errors = []) {
    return ApiResponse.badRequest(res, message, errors);
  }

  /**
   * Send not found response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   */
  sendNotFound(res, message = 'Resource not found') {
    return ApiResponse.notFound(res, message);
  }

  /**
   * Send unauthorized response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   */
  sendUnauthorized(res, message = 'Unauthorized') {
    return ApiResponse.unauthorized(res, message);
  }

  /**
   * Send forbidden response
   * @param {object} res - Express response object
   * @param {string} message - Error message
   */
  sendForbidden(res, message = 'Forbidden') {
    return ApiResponse.forbidden(res, message);
  }

  /**
   * Extract pagination parameters from request
   * @param {object} req - Express request object
   * @param {number} defaultLimit - Default page size
   * @param {number} maxLimit - Maximum page size
   * @returns {object} - Pagination parameters
   */
  getPaginationParams(req, defaultLimit = 20, maxLimit = 100) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Extract sort parameters from request
   * @param {object} req - Express request object
   * @param {string} defaultSort - Default sort field
   * @param {array} allowedFields - Allowed sort fields
   * @returns {object} - Sort parameters
   */
  getSortParams(req, defaultSort = 'created_at', allowedFields = []) {
    const sortBy = allowedFields.includes(req.query.sortBy) ? req.query.sortBy : defaultSort;
    const sortOrder = req.query.sortOrder === 'desc' ? 'DESC' : 'ASC';

    return { sortBy, sortOrder };
  }

  /**
   * Log controller action
   * @param {string} action - Action being performed
   * @param {object} meta - Additional metadata
   */
  logAction(action, meta = {}) {
    this.logger.info(`Controller action: ${action}`, meta);
  }

  /**
   * Log controller error
   * @param {string} action - Action that failed
   * @param {Error} error - Error object
   * @param {object} meta - Additional metadata
   */
  logError(action, error, meta = {}) {
    this.logger.error(`Controller error in ${action}:`, {
      error: error.message,
      stack: error.stack,
      ...meta
    });
  }

  /**
   * Validate required fields in request body
   * @param {object} body - Request body
   * @param {array} requiredFields - Array of required field names
   * @returns {array} - Array of missing fields
   */
  validateRequiredFields(body, requiredFields) {
    const missing = [];
    
    for (const field of requiredFields) {
      if (!body[field] && body[field] !== 0 && body[field] !== false) {
        missing.push(field);
      }
    }

    return missing;
  }

  /**
   * Sanitize object by removing undefined/null values
   * @param {object} obj - Object to sanitize
   * @returns {object} - Cleaned object
   */
  sanitizeObject(obj) {
    const clean = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        clean[key] = value;
      }
    }

    return clean;
  }
}

module.exports = BaseController;