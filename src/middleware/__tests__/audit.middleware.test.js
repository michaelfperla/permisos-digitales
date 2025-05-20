/**
 * Unit Tests for Audit Middleware
 */
const { auditRequest } = require('../audit.middleware');
const { logger } = require('../../utils/enhanced-logger');

// Mock dependencies
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Audit Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock request, response, and next function
    req = {
      method: 'GET',
      originalUrl: '/api/test',
      ip: '127.0.0.1',
      get: jest.fn().mockImplementation((header) => {
        if (header === 'User-Agent') {
          return 'test-user-agent';
        }
        return null;
      }),
      session: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();
  });

  it('should log authenticated requests with user info', () => {
    // Arrange
    req.session.userId = '123';
    req.session.userEmail = 'test@example.com';

    // Act
    auditRequest(req, res, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'API Request: GET /api/test',
      expect.objectContaining({
        userId: '123',
        userEmail: 'test@example.com',
        ip: '127.0.0.1',
        userAgent: 'test-user-agent'
      })
    );
  });

  it('should log unauthenticated requests with default values', () => {
    // Arrange
    req.session = null;

    // Act
    auditRequest(req, res, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'API Request: GET /api/test',
      expect.objectContaining({
        userId: 'unauthenticated',
        userEmail: 'unknown',
        ip: '127.0.0.1',
        userAgent: 'test-user-agent'
      })
    );
  });

  it('should always call next() to continue request processing', () => {
    // Act
    auditRequest(req, res, next);

    // Assert
    expect(next).toHaveBeenCalled();
  });

  it('should handle missing User-Agent header', () => {
    // Arrange
    req.get.mockImplementation(() => null);

    // Act
    auditRequest(req, res, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'API Request: GET /api/test',
      expect.objectContaining({
        userAgent: null
      })
    );
  });
});
