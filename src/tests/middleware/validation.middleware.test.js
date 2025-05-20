/**
 * Tests for Validation Middleware
 */

// Mock dependencies before requiring the module under test
const mockLogger = {
  debug: jest.fn()
};

const mockErrors = {
  isEmpty: jest.fn(),
  array: jest.fn()
};

const mockValidationResult = jest.fn().mockReturnValue(mockErrors);

// Mock dependencies
jest.mock('express-validator', () => ({
  validationResult: mockValidationResult
}));

jest.mock('../../utils/enhanced-logger', () => ({
  logger: mockLogger
}));

// Import the module under test after mocking dependencies
const { handleValidationErrors } = require('../../middleware/validation.middleware');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup request, response, and next function mocks
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('handleValidationErrors', () => {
    it('should call next() when there are no validation errors', () => {
      // Arrange
      mockErrors.isEmpty.mockReturnValue(true);

      // Act
      handleValidationErrors(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should return 400 status with error details when validation fails', () => {
      // Arrange
      const validationErrors = [
        { param: 'email', msg: 'Invalid email format' },
        { param: 'password', msg: 'Password too short' }
      ];

      mockErrors.isEmpty.mockReturnValue(false);
      mockErrors.array.mockReturnValue(validationErrors);

      // Act
      handleValidationErrors(req, res, next);

      // Assert
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: validationErrors
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Validation errors:')
      );
    });

    it('should log validation errors with JSON.stringify', () => {
      // Arrange
      const validationErrors = [
        { param: 'email', msg: 'Invalid email format' }
      ];

      mockErrors.isEmpty.mockReturnValue(false);
      mockErrors.array.mockReturnValue(validationErrors);

      // Act
      handleValidationErrors(req, res, next);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Validation errors: ${JSON.stringify(validationErrors)}`
      );
    });

    it('should handle empty validation errors array', () => {
      // Arrange
      mockErrors.isEmpty.mockReturnValue(false);
      mockErrors.array.mockReturnValue([]);

      // Act
      handleValidationErrors(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        errors: []
      });
    });
  });
});
