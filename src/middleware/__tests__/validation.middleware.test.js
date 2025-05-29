/**
 * Unit Tests for Validation Middleware
 */
const { logger } = require('../../utils/enhanced-logger');

// Mock dependencies
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Create mock validation result
const mockValidationResult = {
  isEmpty: jest.fn(),
  array: jest.fn()
};

// Mock express-validator before requiring the middleware
jest.mock('express-validator', () => ({
  validationResult: jest.fn().mockReturnValue(mockValidationResult)
}));

// Import the middleware after mocking dependencies
const { handleValidationErrors } = require('../validation.middleware');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockValidationResult.isEmpty.mockReset();
    mockValidationResult.array.mockReset();

    // Create mock request, response, and next function
    req = {};

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  it('should call next() when there are no validation errors', () => {
    // Arrange
    mockValidationResult.isEmpty.mockReturnValue(true);

    // Act
    handleValidationErrors(req, res, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('should return 400 status with error details when validation fails', () => {
    // Arrange
    const validationErrors = [
      { param: 'email', msg: 'Invalid email format' },
      { param: 'password', msg: 'Password too short' }
    ];

    mockValidationResult.isEmpty.mockReturnValue(false);
    mockValidationResult.array.mockReturnValue(validationErrors);

    // Act
    handleValidationErrors(req, res, next);

    // Assert
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Los datos no son válidos',
      errors: validationErrors
    });
    expect(logger.debug).toHaveBeenCalledWith(
      `Validation errors: ${JSON.stringify(validationErrors)}`
    );
  });

  it('should handle empty validation errors array', () => {
    // Arrange
    mockValidationResult.isEmpty.mockReturnValue(false);
    mockValidationResult.array.mockReturnValue([]);

    // Act
    handleValidationErrors(req, res, next);

    // Assert
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Los datos no son válidos',
      errors: []
    });
    expect(logger.debug).toHaveBeenCalledWith('Validation errors: []');
  });
});
