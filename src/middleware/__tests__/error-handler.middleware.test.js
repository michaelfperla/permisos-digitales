/**
 * Unit Tests for Error Handler Middleware
 */
const errorHandler = require('../error-handler.middleware');
const { logger } = require('../../utils/enhanced-logger');
const { AppError } = require('../../utils/errors');

// Mock dependencies
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Error Handler Middleware', () => {
  let req, res, next;
  let originalNodeEnv;

  beforeEach(() => {
    // Store original NODE_ENV
    originalNodeEnv = process.env.NODE_ENV;

    // Reset all mocks
    jest.clearAllMocks();

    // Create mock request, response, and next function
    req = {
      method: 'GET',
      path: '/api/test',
      id: 'test-request-id',
      session: {
        userId: 'test-user-id'
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: false
    };

    next = jest.fn();
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should handle AppError with correct status code', () => {
    // Arrange
    const error = new AppError('Test error', 418, 'TEST_ERROR');
    error.isOperational = true;

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(logger.error).toHaveBeenCalledWith(
      '[GET] /api/test - Status: 418, Error: Test error',
      expect.objectContaining({
        error: expect.any(String),
        requestId: 'test-request-id',
        userId: 'test-user-id'
      })
    );
    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: 'Test error',
          code: 'TEST_ERROR',
          status: 418
        })
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle generic Error with 500 status', () => {
    // Arrange
    const error = new Error('Something went wrong');

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: 'Something went wrong',
          code: 'INTERNAL_ERROR',
          status: 500
        })
      })
    );
  });

  it('should sanitize error messages in production', () => {
    // Arrange
    process.env.NODE_ENV = 'production';
    const error = new Error('Database connection failed: password incorrect');

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: 'Algo salió mal. Por favor, inténtalo de nuevo más tarde.',
          code: 'INTERNAL_ERROR'
        })
      })
    );
  });

  it('should call next if headers already sent', () => {
    // Arrange
    res.headersSent = true;
    const error = new Error('Test error');

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('should include validation errors in the response', () => {
    // Arrange
    const validationErrors = [
      { field: 'email', message: 'Formato de correo electrónico inválido' },
      { field: 'password', message: 'Contraseña muy corta' }
    ];
    const error = new Error('Los datos no son válidos');
    error.errors = validationErrors;
    error.statusCode = 422;

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: 'Los datos no son válidos',
          errors: validationErrors
        })
      })
    );
  });

  it('should include stack trace in development environment', () => {
    // Arrange
    process.env.NODE_ENV = 'development';
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at TestFunction';

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          stack: error.stack
        })
      })
    );
  });

  it('should not include stack trace in production environment', () => {
    // Arrange
    process.env.NODE_ENV = 'production';
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at TestFunction';

    // Act
    errorHandler(error, req, res, next);

    // Assert
    const responseArg = res.json.mock.calls[0][0];
    expect(responseArg.error).not.toHaveProperty('stack');
  });

  it('should handle errors with originalError property in development', () => {
    // Arrange
    process.env.NODE_ENV = 'development';
    const originalError = new Error('SQL syntax error');
    originalError.code = 'ER_PARSE_ERROR';
    const error = new Error('Database query failed');
    error.originalError = originalError;

    // Act
    errorHandler(error, req, res, next);

    // Assert
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          originalError: expect.objectContaining({
            message: 'SQL syntax error',
            code: 'ER_PARSE_ERROR'
          })
        })
      })
    );
  });
});
