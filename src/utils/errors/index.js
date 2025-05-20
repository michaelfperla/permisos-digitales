/**
 * Centralized Error Handling System
 * Provides standardized error classes for consistent error handling
 */

/**
 * Base application error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    // Capture stack trace, excluding the constructor call from the stack
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Invalid input or parameters
 */
class BadRequestError extends AppError {
  constructor(message = 'Datos incorrectos', code = null) {
    super(message, 400, code);
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Necesitas iniciar sesión', code = null) {
    super(message, 401, code);
  }
}

/**
 * 403 Forbidden - Authenticated but not authorized
 */
class ForbiddenError extends AppError {
  constructor(message = 'Acceso prohibido', code = null) {
    super(message, 403, code);
  }
}

/**
 * 404 Not Found - Resource not found
 */
class NotFoundError extends AppError {
  constructor(message = 'No se encontró lo que buscas', code = null) {
    super(message, 404, code);
  }
}

/**
 * 409 Conflict - Resource conflict
 */
class ConflictError extends AppError {
  constructor(message = 'Hay un conflicto con los datos', code = null) {
    super(message, 409, code);
  }
}

/**
 * 422 Unprocessable Entity - Validation error
 */
class ValidationError extends AppError {
  constructor(message = 'Los datos no son válidos', errors = [], code = null) {
    super(message, 422, code);
    this.errors = errors;
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
class RateLimitError extends AppError {
  constructor(message = 'Límite de solicitudes excedido', code = null) {
    super(message, 429, code);
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
class InternalServerError extends AppError {
  constructor(message = 'Error interno del servidor', code = null) {
    super(message, 500, code);
  }
}

/**
 * 503 Service Unavailable - Service temporarily unavailable
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Servicio temporalmente no disponible', code = null) {
    super(message, 503, code);
  }
}

/**
 * Database error - Wraps database-specific errors
 */
class DatabaseError extends AppError {
  constructor(message = 'Error de base de datos', originalError = null, code = null) {
    super(message, 500, code);
    this.originalError = originalError;
  }
}

/**
 * External Service Error - Error from external service
 */
class ExternalServiceError extends AppError {
  constructor(message = 'Error de servicio externo', service = null, code = null) {
    super(message, 502, code);
    this.service = service;
  }
}

/**
 * File System Error - Error related to file operations
 */
class FileSystemError extends AppError {
  constructor(message = 'Error del sistema de archivos', path = null, code = null) {
    super(message, 500, code);
    this.path = path;
  }
}

/**
 * Map PostgreSQL error codes to custom error classes
 * @param {Error} error - Original error
 * @returns {AppError} - Mapped error
 */
function mapDatabaseError(error) {
  // Check if it's a PostgreSQL error with a code
  if (error.code) {
    switch (error.code) {
    // Unique violation
    case '23505':
      return new ConflictError(
        error.detail || 'Valor duplicado viola restricción de unicidad',
        error.code
      );

      // Foreign key violation
    case '23503':
      return new BadRequestError(
        error.detail || 'Violación de llave foránea',
        error.code
      );

      // Not null violation
    case '23502':
      return new BadRequestError(
        error.detail || 'Violación de no nulo',
        error.code
      );

      // Check violation
    case '23514':
      return new BadRequestError(
        error.detail || 'Violación de restricción de verificación',
        error.code
      );

      // Invalid text representation
    case '22P02':
      return new BadRequestError(
        'Sintaxis de entrada inválida',
        error.code
      );

      // Connection errors
    case '08000':
    case '08003':
    case '08006':
    case '08001':
    case '08004':
      return new ServiceUnavailableError(
        'Error de conexión a la base de datos',
        error.code
      );

      // Default database error
    default:
      return new DatabaseError(
        error.message || 'Error de base de datos',
        error,
        error.code
      );
    }
  }

  // If it's not a PostgreSQL error or doesn't have a code
  return new DatabaseError(error.message || 'Error de base de datos', error);
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError,
  ExternalServiceError,
  FileSystemError,
  mapDatabaseError
};
