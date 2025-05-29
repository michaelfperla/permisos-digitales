const { logger } = require('../utils/enhanced-logger');
const { AppError } = require('../utils/errors');

const developmentErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  logger.error(`[${req.method}] ${req.path} - Status: ${statusCode}, Error: ${err.message}`, {
    error: err.stack,
    requestId: req.id,
    userId: req.session?.userId
  });

  const errorResponse = {
    success: false,
    error: {
      message: err.message,
      code: errorCode,
      status: statusCode
    }
  };

  if (err.errors) {
    errorResponse.error.errors = err.errors;
  }

  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error.stack = err.stack;

    if (err.originalError) {
      errorResponse.error.originalError = {
        message: err.originalError.message,
        code: err.originalError.code
      };
    }
  }

  res.status(statusCode).json(errorResponse);
};

const productionErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  logger.error(`[${req.method}] ${req.path} - Status: ${statusCode}, Error: ${err.message}`, {
    error: err.stack,
    requestId: req.id,
    userId: req.session?.userId
  });

  const isOperationalError = err instanceof AppError && err.isOperational;

  const errorMessage = isOperationalError
    ? err.message
    : 'Algo salió mal. Por favor, inténtalo de nuevo más tarde.';

  const errorResponse = {
    success: false,
    error: {
      message: errorMessage,
      code: isOperationalError ? errorCode : 'INTERNAL_ERROR',
      status: statusCode
    }
  };

  if (err.errors) {
    errorResponse.error.errors = err.errors;
  }

  res.status(statusCode).json(errorResponse);
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (process.env.NODE_ENV === 'production') {
    return productionErrorHandler(err, req, res, next);
  } else {
    return developmentErrorHandler(err, req, res, next);
  }
};

module.exports = errorHandler;
