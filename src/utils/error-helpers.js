// src/utils/error.helpers.js
const { logger } = require('./enhanced-logger');
const {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError,
  mapDatabaseError
} = require('./errors');

/**
 * Standard error handler for controller methods
 *
 * @param {Error} error - The error object
 * @param {string} context - Context information about where the error occurred
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @param {Object} options - Additional options
 * @param {Object} options.errorMappings - Map error codes to status codes and messages
 * @returns {void}
 */
function handleControllerError(error, context, req, res, next, options = {}) {
  // Get user ID for logging if available
  const userId = req.session?.userId || 'anonymous';

  // Log the error with context
  logger.error(`Error in ${context} for user ${userId}:`, error);

  // If it's already an AppError, pass it to the global error handler
  if (error instanceof AppError) {
    return next(error);
  }

  // Default error mappings
  const defaultErrorMappings = {
    // Custom application error codes
    'INVALID_INPUT': { status: 400, message: 'Los datos que ingresaste no son válidos.' },
    'NOT_FOUND': { status: 404, message: 'No se encontró lo que buscas.' },
    'UNAUTHORIZED': { status: 401, message: 'Necesitas iniciar sesión.' },
    'FORBIDDEN': { status: 403, message: 'No tienes permiso para realizar esta acción.' },
  };

  // Merge default mappings with custom mappings
  const errorMappings = { ...defaultErrorMappings, ...(options.errorMappings || {}) };

  // Check if this is a database error
  if (error.code && error.code.match(/^\d\d\w\d\d$/)) {
    // Map database error to AppError
    const mappedError = mapDatabaseError(error);
    return next(mappedError);
  }

  // Check if this is a known error type with a code
  if (error.code && errorMappings[error.code]) {
    const { status, message } = errorMappings[error.code];

    // Create appropriate error based on status code
    let appError;
    switch (status) {
    case 400:
      appError = new BadRequestError(message || error.message, error.code);
      break;
    case 401:
      appError = new UnauthorizedError(message || error.message, error.code);
      break;
    case 403:
      appError = new ForbiddenError(message || error.message, error.code);
      break;
    case 404:
      appError = new NotFoundError(message || error.message, error.code);
      break;
    case 409:
      appError = new ConflictError(message || error.message, error.code);
      break;
    default:
      appError = new AppError(message || error.message, status, error.code);
    }

    return next(appError);
  }

  // If it's a custom error with status
  if (error.status) {
    const appError = new AppError(error.message || 'Ocurrió un error.', error.status, error.code);
    return next(appError);
  }

  // For unhandled errors, create an InternalServerError
  const internalError = new InternalServerError(
    error.message || 'Ocurrió un error inesperado.',
    error.code || 'INTERNAL_ERROR'
  );

  // Pass to the global error handler
  next(internalError);
}

/**
 * Create a custom error with status code
 *
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string} code - Error code
 * @returns {AppError} Custom error object
 */
function createError(message, status = 500, code = null) {
  // Create appropriate error based on status code
  switch (status) {
  case 400:
    return new BadRequestError(message, code);
  case 401:
    return new UnauthorizedError(message, code);
  case 403:
    return new ForbiddenError(message, code);
  case 404:
    return new NotFoundError(message, code);
  case 409:
    return new ConflictError(message, code);
  case 422:
    return new ValidationError(message, [], code);
  case 500:
    return new InternalServerError(message, code);
  default:
    return new AppError(message, status, code);
  }
}

module.exports = {
  handleControllerError,
  createError
  // Error classes should be imported directly from utils/errors
};
