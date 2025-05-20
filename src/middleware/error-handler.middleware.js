/**
 * Global Error Handler Middleware
 * Handles all errors in a consistent way
 */
const { logger } = require('../utils/enhanced-logger');
const { AppError } = require('../utils/errors');

/**
 * Development error handler - includes stack trace and details
 */
const developmentErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  logger.error(`[${req.method}] ${req.path} - Status: ${statusCode}, Error: ${err.message}`, {
    error: err.stack,
    requestId: req.id,
    userId: req.session?.userId
  });

  // Prepare detailed error response for development
  const errorResponse = {
    success: false,
    error: {
      message: err.message,
      code: errorCode,
      status: statusCode
    }
  };

  // Add validation errors if available
  if (err.errors) {
    errorResponse.error.errors = err.errors;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error.stack = err.stack;

    // Add original error for database errors
    if (err.originalError) {
      errorResponse.error.originalError = {
        message: err.originalError.message,
        code: err.originalError.code
      };
    }
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Production error handler - hides implementation details
 */
const productionErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  // Log error details for debugging
  logger.error(`[${req.method}] ${req.path} - Status: ${statusCode}, Error: ${err.message}`, {
    error: err.stack,
    requestId: req.id,
    userId: req.session?.userId
  });

  // Determine if this is an operational error (expected) or programming error (unexpected)
  const isOperationalError = err instanceof AppError && err.isOperational;

  // For non-operational errors in production, use a generic message
  const errorMessage = isOperationalError
    ? err.message
    : 'Algo salió mal. Por favor, inténtalo de nuevo más tarde.';

  // Prepare sanitized error response for production
  const errorResponse = {
    success: false,
    error: {
      message: errorMessage,
      code: isOperationalError ? errorCode : 'INTERNAL_ERROR',
      status: statusCode
    }
  };

  // Include validation errors even in production
  if (err.errors) {
    errorResponse.error.errors = err.errors;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Main error handler middleware
 * Chooses appropriate handler based on environment
 */
const errorHandler = (err, req, res, next) => {
  // If headers already sent, delegate to Express default error handler
  if (res.headersSent) {
    return next(err);
  }

  // Choose appropriate error handler based on environment
  if (process.env.NODE_ENV === 'production') {
    return productionErrorHandler(err, req, res, next);
  } else {
    return developmentErrorHandler(err, req, res, next);
  }
};

module.exports = errorHandler;
