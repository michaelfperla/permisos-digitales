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

function handleControllerError(error, context, req, res, next, options = {}) {
  const userId = req.session?.userId || 'anonymous';

  logger.error(`Error in ${context} for user ${userId}:`, error);

  if (error instanceof AppError) {
    return next(error);
  }

  const defaultErrorMappings = {
    'INVALID_INPUT': { status: 400, message: 'Los datos que ingresaste no son válidos.' },
    'NOT_FOUND': { status: 404, message: 'No se encontró lo que buscas.' },
    'UNAUTHORIZED': { status: 401, message: 'Necesitas iniciar sesión.' },
    'FORBIDDEN': { status: 403, message: 'No tienes permiso para realizar esta acción.' },
  };

  const errorMappings = { ...defaultErrorMappings, ...(options.errorMappings || {}) };

  if (error.code && error.code.match(/^\d\d\w\d\d$/)) {
    const mappedError = mapDatabaseError(error);
    return next(mappedError);
  }

  if (error.code && errorMappings[error.code]) {
    const { status, message } = errorMappings[error.code];

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

  if (error.status) {
    const appError = new AppError(error.message || 'Ocurrió un error.', error.status, error.code);
    return next(appError);
  }

  const internalError = new InternalServerError(
    error.message || 'Ocurrió un error inesperado.',
    error.code || 'INTERNAL_ERROR'
  );

  next(internalError);
}

function createError(message, status = 500, code = null) {
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
};
