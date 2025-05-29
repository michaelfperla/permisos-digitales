/**
 * Unit Tests for Error Helpers
 */
const { logger } = require('../enhanced-logger');
const {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError,
  ServiceUnavailableError,
  mapDatabaseError
} = require('../errors');

// Mock dependencies
jest.mock('../enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Import the module under test after mocking dependencies
const { handleControllerError, createError } = require('../error-helpers');

describe('Error Helpers', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create mock request, response, and next function
    req = {
      session: {
        userId: 123
      },
      path: '/test/path',
      method: 'GET'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  describe('handleControllerError', () => {
    it('should pass AppError instances directly to next', () => {
      // Arrange
      const appError = new AppError('Test error', 400, 'TEST_ERROR');
      const context = 'test context';

      // Act
      handleControllerError(appError, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(appError);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        appError
      );
    });

    it('should handle database errors with SQL error codes', () => {
      // Arrange
      const dbError = new Error('Database error');
      dbError.code = '23505'; // Unique violation
      dbError.detail = 'Key (email)=(test@example.com) already exists';
      const context = 'database operation';

      // Act
      handleControllerError(dbError, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ConflictError));
      expect(next.mock.calls[0][0].statusCode).toBe(409);
      expect(next.mock.calls[0][0].message).toBe(dbError.detail);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        dbError
      );
    });

    it('should handle database errors with foreign key violation', () => {
      // Arrange
      const dbError = new Error('Database error');
      dbError.code = '23503'; // Foreign key violation
      dbError.detail = 'Key (user_id)=(999) is not present in table "users"';
      const context = 'database operation';

      // Act
      handleControllerError(dbError, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(next.mock.calls[0][0].message).toBe(dbError.detail);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        dbError
      );
    });

    it('should handle database errors with not null violation', () => {
      // Arrange
      const dbError = new Error('Database error');
      dbError.code = '23502'; // Not null violation
      dbError.detail = 'Null value in column "email" violates not-null constraint';
      const context = 'database operation';

      // Act
      handleControllerError(dbError, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        dbError
      );
    });

    it('should handle errors with known error codes', () => {
      // Arrange
      const error = new Error('Resource not found');
      error.code = 'NOT_FOUND';
      const context = 'finding resource';

      // Act
      handleControllerError(error, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
      expect(next.mock.calls[0][0].message).toBe('No se encontró lo que buscas.');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        error
      );
    });

    it('should handle errors with custom error mappings', () => {
      // Arrange
      const error = new Error('Custom error');
      error.code = 'CUSTOM_ERROR';
      const context = 'custom operation';
      const options = {
        errorMappings: {
          'CUSTOM_ERROR': { status: 418, message: 'I am a teapot' }
        }
      };

      // Act
      handleControllerError(error, context, req, res, next, options);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(418);
      expect(next.mock.calls[0][0].message).toBe('I am a teapot');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        error
      );
    });

    it('should handle errors with status property', () => {
      // Arrange
      const error = new Error('Forbidden');
      error.status = 403;
      const context = 'authorization';

      // Act
      handleControllerError(error, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(next.mock.calls[0][0].message).toBe('Forbidden');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        error
      );
    });

    it('should create InternalServerError for unhandled errors', () => {
      // Arrange
      const error = new Error('Unexpected error');
      const context = 'unknown operation';

      // Act
      handleControllerError(error, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(InternalServerError));
      expect(next.mock.calls[0][0].statusCode).toBe(500);
      expect(next.mock.calls[0][0].message).toBe('Unexpected error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        error
      );
    });

    it('should handle anonymous users (no session)', () => {
      // Arrange
      req.session = null;
      const error = new Error('Unauthorized');
      const context = 'authentication';

      // Act
      handleControllerError(error, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(InternalServerError));
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user anonymous:`),
        error
      );
    });

    it('should handle errors with code but no matching mapping', () => {
      // Arrange
      const error = new Error('Unknown error code');
      error.code = 'UNKNOWN_CODE';
      const context = 'unknown operation';

      // Act
      handleControllerError(error, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(InternalServerError));
      // The code from the original error is preserved
      expect(next.mock.calls[0][0].code).toBe('UNKNOWN_CODE');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        error
      );
    });

    it('should handle UNAUTHORIZED error code', () => {
      // Arrange
      const error = new Error('Authentication required');
      error.code = 'UNAUTHORIZED';
      const context = 'authentication';

      // Act
      handleControllerError(error, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toBe('Necesitas iniciar sesión.');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        error
      );
    });

    it('should handle FORBIDDEN error code', () => {
      // Arrange
      const error = new Error('Access denied');
      error.code = 'FORBIDDEN';
      const context = 'authorization';

      // Act
      handleControllerError(error, context, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(next.mock.calls[0][0].message).toBe('No tienes permiso para realizar esta acción.');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error in ${context} for user ${req.session.userId}:`),
        error
      );
    });
  });

  describe('createError', () => {
    it('should create BadRequestError for status 400', () => {
      // Act
      const error = createError('Bad request', 400, 'INVALID_INPUT');

      // Assert
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
      expect(error.code).toBe('INVALID_INPUT');
    });

    it('should create UnauthorizedError for status 401', () => {
      // Act
      const error = createError('Unauthorized', 401);

      // Assert
      expect(error).toBeInstanceOf(UnauthorizedError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });

    it('should create ForbiddenError for status 403', () => {
      // Act
      const error = createError('Forbidden', 403);

      // Assert
      expect(error).toBeInstanceOf(ForbiddenError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
    });

    it('should create NotFoundError for status 404', () => {
      // Act
      const error = createError('Not found', 404);

      // Assert
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
    });

    it('should create ConflictError for status 409', () => {
      // Act
      const error = createError('Conflict', 409);

      // Assert
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Conflict');
    });

    it('should create ValidationError for status 422', () => {
      // Act
      const error = createError('Validation failed', 422);

      // Assert
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual([]);
    });

    it('should create InternalServerError for status 500', () => {
      // Act
      const error = createError('Internal server error', 500);

      // Assert
      expect(error).toBeInstanceOf(InternalServerError);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Internal server error');
    });

    it('should create AppError for status 503', () => {
      // Act
      const error = createError('Service unavailable', 503);

      // Assert
      // Note: The error.helpers.js doesn't have a case for 503, so it creates a generic AppError
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(503);
      expect(error.message).toBe('Service unavailable');
    });

    it('should create generic AppError for other status codes', () => {
      // Act
      const error = createError('Custom error', 418);

      // Assert
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(418);
      expect(error.message).toBe('Custom error');
    });

    it('should use default status 500 when not provided', () => {
      // Act
      const error = createError('Error without status');

      // Assert
      expect(error).toBeInstanceOf(InternalServerError);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Error without status');
    });
  });
});
