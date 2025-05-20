/**
 * Tests for CSRF Middleware
 */

// Mock dependencies
jest.mock('../../utils/enhanced-logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

// Get the real ApiResponse object
const ApiResponse = require('../../utils/api-response');

// Save the original forbidden function
const originalForbidden = ApiResponse.forbidden;

// Create a mock function for forbidden
const mockForbidden = jest.fn().mockImplementation((res, message) => {
  res.status(403).json({
    success: false,
    message: message || 'Forbidden'
  });
  return 'forbidden-response';
});

// Replace the original function with the mock
ApiResponse.forbidden = mockForbidden;

// Import modules after mocking
const { handleCsrfError, addCsrfToken } = require('../../middleware/csrf.middleware');
const { logger } = require('../../utils/enhanced-logger');

describe('CSRF Middleware', () => {
  let req, res, next;

  // Restore the original function after all tests
  afterAll(() => {
    ApiResponse.forbidden = originalForbidden;
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup request, response, and next function mocks
    req = {
      id: 'test-request-id',
      method: 'POST',
      originalUrl: '/api/auth/login',
      ip: '127.0.0.1',
      get: jest.fn().mockImplementation(header => {
        if (header === 'User-Agent') return 'test-user-agent';
        if (header === 'Accept') return 'application/json';
        return null;
      }),
      headers: {
        'x-csrf-token': 'invalid-token'
      },
      body: {
        _csrf: 'invalid-token'
      },
      cookies: {},
      session: {}
    };

    res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      locals: {}
    };

    next = jest.fn();
  });

  describe('handleCsrfError', () => {
    it('should pass non-CSRF errors to next middleware', () => {
      // Arrange
      const error = new Error('Some other error');
      error.code = 'OTHER_ERROR';

      // Act
      handleCsrfError(error, req, res, next);

      // Assert
      expect(next).toHaveBeenCalledWith(error);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(mockForbidden).not.toHaveBeenCalled();
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should log CSRF errors with detailed information', () => {
      // Arrange
      const error = new Error('Invalid CSRF token');
      error.code = 'EBADCSRFTOKEN';

      // Act
      handleCsrfError(error, req, res, next);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('CSRF error for POST /api/auth/login'),
        expect.objectContaining({
          ip: '127.0.0.1',
          userAgent: 'test-user-agent',
          requestId: 'test-request-id',
          csrfToken: 'invalid-token'
        })
      );
    });

    it('should return JSON error for API requests', () => {
      // Arrange
      const error = new Error('Invalid CSRF token');
      error.code = 'EBADCSRFTOKEN';

      // Set API request indicators
      req.xhr = true;
      req.originalUrl = '/api/auth/login';
      req.get = jest.fn().mockReturnValue('application/json');

      // Act
      const result = handleCsrfError(error, req, res, next);

      // Assert
      expect(mockForbidden).toHaveBeenCalledWith(res, 'Invalid or missing CSRF token');
      expect(result).toBe('forbidden-response');
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('should redirect to login page for regular requests', () => {
      // Arrange
      const error = new Error('Invalid CSRF token');
      error.code = 'EBADCSRFTOKEN';

      // Change request to non-API
      req.originalUrl = '/login';
      req.get = jest.fn().mockReturnValue('text/html');
      req.xhr = false;

      // Act
      handleCsrfError(error, req, res, next);

      // Assert
      expect(res.redirect).toHaveBeenCalledWith('/login?error=csrf');
      expect(mockForbidden).not.toHaveBeenCalled();
    });

    it('should redirect to admin login page for admin requests', () => {
      // Arrange
      const error = new Error('Invalid CSRF token');
      error.code = 'EBADCSRFTOKEN';

      // Change request to admin page
      req.originalUrl = '/admin/dashboard';
      req.get = jest.fn().mockReturnValue('text/html');
      req.xhr = false;

      // Act
      handleCsrfError(error, req, res, next);

      // Assert
      expect(res.redirect).toHaveBeenCalledWith('/admin-login?error=csrf');
      expect(mockForbidden).not.toHaveBeenCalled();
    });
  });

  describe('addCsrfToken', () => {
    it('should add CSRF token to response locals', () => {
      // Arrange
      req.csrfToken = jest.fn().mockReturnValue('generated-csrf-token');

      // Act
      addCsrfToken(req, res, next);

      // Assert
      expect(res.locals.csrfToken).toBe('generated-csrf-token');
      expect(req.csrfToken).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
});
